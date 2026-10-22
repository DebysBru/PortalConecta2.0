/**
 * ==============================================================================
 * IMPORTAÇÃO DO CORPUS DO SITE INSTITUCIONAL PARA O RAG DA IFIZINHA
 * ==============================================================================
 *
 * Lê os arquivos markdown produzidos pelo extrator do site do IFPR Campus
 * Ivaiporã (https://ifpr.edu.br/ivaipora) e transforma cada um em um
 * `documentos_kb` + seus `chunks_kb`, prontos para a busca vetorial/textual do
 * chat da IFizinha.
 *
 * O que o extrator garante e este script usa:
 *   - YAML frontmatter com `id`, `titulo`, `categoria`, `tipo_documento`,
 *     `url_fonte`, `pagina_de_origem`, `data_publicacao`...;
 *   - corpo já convertido de HTML/PDF para markdown.
 *
 * Decisões que importam (e o porquê):
 *
 * 1. **URL da fonte em cada chunk.** É `metadata.url_fonte` que permite a
 *    IFizinha mostrar "confira na fonte oficial" em toda resposta. Vai no chunk
 *    (e não só no documento) porque é o chunk que a busca devolve.
 *
 * 2. **Idempotência por `ref_id` + hash do conteúdo.** O extrator roda de novo
 *    toda semana; rodar esta importação duas vezes não pode duplicar a base.
 *    Se o texto mudou, o documento é versionado e os chunks antigos são
 *    substituídos (e não empilhados).
 *
 * 3. **Sem `GEMINI_API_KEY` a importação NÃO inventa embedding.** O
 *    `generateBatchEmbeddings` cai num vetor determinístico de hash quando não
 *    há chave — 1536 dimensões de ruído, que passam na validação e fazem a
 *    busca vetorial devolver qualquer coisa. Aqui a importação simplesmente
 *    grava os chunks sem vetor e avisa; a busca textual (prisma/
 *    busca-textual-setup.sql) assume o atendimento até alguém reimportar com a
 *    chave configurada.
 *
 * 4. **Sem curadoria por LLM.** A curadoria (`curarDocumentoKb`) faz uma
 *    chamada ao DeepSeek por documento — 3 mil documentos seriam 3 mil
 *    chamadas pagas para enriquecer metadados. Fica de fora do lote; quem
 *    quiser enriquecer um documento usa /admin/rag.
 *
 * Uso:
 *   npm run rag:importar
 *   npm run rag:importar -- --limite=50 --verboso
 *   npm run rag:importar -- --categorias=edital,curso
 *   npm run rag:importar -- --dry-run
 *   npm run rag:importar -- --forcar          # reindexa mesmo sem mudança
 *   npm run rag:importar -- --sem-embeddings  # só grava o texto
 *
 * Variáveis:
 *   MARKDOWN_DIR   pasta do corpus (padrão: ../ExtratorIFPR/data/markdown)
 *   GEMINI_API_KEY gera os embeddings (sem ela, importa em modo textual)
 * ==============================================================================
 */

import './_env';

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { load as carregarYaml } from 'js-yaml';
import fg from 'fast-glob';

import { chunkDocument } from '@/lib/chunking';
import { generateBatchEmbeddings, validateEmbedding } from '@/lib/embeddings';
import { saveChunksWithEmbeddings } from '@/lib/busca-vetorial';

// ==============================================================================
// Tipos
// ==============================================================================

interface Opcoes {
  dir: string;
  categorias: string[] | null;
  limite: number | null;
  dryRun: boolean;
  forcar: boolean;
  semEmbeddings: boolean;
  apenasIndice: boolean;
  verboso: boolean;
}

interface DocumentoExtraido {
  /** Caminho relativo à raiz do corpus — vira `metadata.caminho_arquivo`. */
  arquivo: string;
  /** Categoria = nome da pasta (edital, curso, ppc...). */
  categoria: string;
  frontmatter: Record<string, unknown>;
  titulo: string;
  texto: string;
}

interface Resumo {
  documentosLidos: number;
  documentosIgnorados: number;
  documentosImportados: number;
  documentosAtualizados: number;
  documentosSemMudanca: number;
  documentosComErro: number;
  chunksGravados: number;
  chunksComEmbedding: number;
  erros: Array<{ arquivo: string; erro: string }>;
  ignorados: Array<{ arquivo: string; motivo: string }>;
  duracaoMs: number;
}

// ==============================================================================
// Argumentos
// ==============================================================================

function lerOpcoes(): Opcoes {
  const args = process.argv.slice(2);
  const pegar = (nome: string): string | null => {
    const comIgual = args.find((a) => a.startsWith(`--${nome}=`));
    if (comIgual) return comIgual.slice(nome.length + 3);
    const indice = args.indexOf(`--${nome}`);
    if (indice >= 0 && args[indice + 1] && !args[indice + 1].startsWith('--')) {
      return args[indice + 1];
    }
    return null;
  };

  // O npm 11 no Windows consome argumentos depois de `--` em alguns casos
  // ("Unknown cli config --limite"). Por isso cada opção também existe como
  // variável de ambiente: `RAG_LIMITE=20 npm run rag:importar` funciona sempre.
  const ligado = (nome: string, env: string): boolean =>
    args.includes(`--${nome}`) || /^(1|true|sim|yes)$/i.test(process.env[env] ?? '');

  const dirPadrao = path.resolve(process.cwd(), '..', 'ExtratorIFPR', 'data', 'markdown');
  const categorias = pegar('categorias') ?? process.env.RAG_CATEGORIAS ?? null;
  const limite = pegar('limite') ?? process.env.RAG_LIMITE ?? null;

  return {
    dir: path.resolve(pegar('dir') ?? process.env.MARKDOWN_DIR ?? dirPadrao),
    categorias: categorias ? categorias.split(',').map((c) => c.trim()).filter(Boolean) : null,
    limite: limite ? Number(limite) : null,
    dryRun: ligado('dry-run', 'RAG_DRY_RUN'),
    forcar: ligado('forcar', 'RAG_FORCAR'),
    semEmbeddings: ligado('sem-embeddings', 'RAG_SEM_EMBEDDINGS'),
    apenasIndice: ligado('apenas-indice', 'RAG_APENAS_INDICE'),
    verboso: ligado('verboso', 'RAG_VERBOSO'),
  };
}

// ==============================================================================
// Leitura e limpeza dos arquivos
// ==============================================================================

/** Separa o YAML frontmatter do corpo markdown. */
function separarFrontmatter(bruto: string): { frontmatter: Record<string, unknown>; corpo: string } {
  const conteudo = bruto.replace(/^\uFEFF/, '');
  const achado = conteudo.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!achado) return { frontmatter: {}, corpo: conteudo };

  try {
    const dados = carregarYaml(achado[1]);
    return {
      frontmatter: dados && typeof dados === 'object' ? (dados as Record<string, unknown>) : {},
      corpo: conteudo.slice(achado[0].length),
    };
  } catch {
    // YAML quebrado não pode derrubar a importação de 3 mil arquivos: segue
    // com metadados vazios e o corpo inteiro (o título cai no nome do arquivo).
    return { frontmatter: {}, corpo: conteudo.slice(achado[0].length) };
  }
}

const EXTENSAO_DE_ARQUIVO = /\.(pdf|docx?|odt|xlsx?|csv|zip|rtf|pptx?|txt)(\?.*)?$/i;

/**
 * Limpa o corpo markdown para virar texto de conhecimento.
 *
 * - remove o comentário automático do extrator;
 * - remove a seção "## Links oficiais relacionados", que é uma segunda cópia
 *   dos links já presentes no corpo (e que só polui o embedding);
 * - troca `[rótulo](url)` por `rótulo`, preservando a URL quando ela aponta
 *   para um arquivo (o PDF do edital em si) — essa URL é útil na resposta;
 * - remove os marcadores "## Página N" que o extrator de PDF insere.
 */
function limparCorpo(corpo: string): string {
  let texto = corpo.replace(/<!--[\s\S]*?-->/g, '\n');

  const inicioLinks = texto.search(/^#{2,6}\s*Links oficiais relacionados\s*$/m);
  if (inicioLinks >= 0) texto = texto.slice(0, inicioLinks);

  texto = texto.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');

  texto = texto.replace(/\[([^\]]+)\]\((\S+?)\)/g, (_todo, rotulo: string, url: string) => {
    const limpo = rotulo.replace(/\s+/g, ' ').trim();
    return EXTENSAO_DE_ARQUIVO.test(url) ? `${limpo} (${url})` : limpo;
  });

  texto = texto.replace(/^#{1,6}\s*P[áa]gina\s+\d+\s*$/gim, '\n');

  texto = texto
    .split(/\r?\n/)
    .map((linha) => linha.replace(/[ \t]+/g, ' ').trim())
    .join('\n');

  return texto.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Junta as linhas quebradas no meio da frase.
 *
 * Texto vindo de PDF chega com quebra de linha a cada ~90 caracteres (é o
 * layout da página, não o fim do parágrafo). O chunker trata cada linha como
 * um parágrafo — o texto continua lá, mas o embedding enxerga frases picadas.
 * Juntar só quando a linha anterior NÃO termina em pontuação de fim de frase
 * recupera o parágrafo original sem mexer em títulos, listas e tabelas.
 */
function reflowDePdf(texto: string): string {
  const saida: string[] = [];
  let atual = '';

  const pareceTitulo = (linha: string): boolean =>
    /^#{1,6}\s/.test(linha) ||
    (linha.length <= 80 &&
      linha === linha.toUpperCase() &&
      linha.split(/\s+/).length <= 10 &&
      !/[.,;:]$/.test(linha));

  for (const linha of texto.split('\n')) {
    if (!linha.trim()) {
      if (atual) {
        saida.push(atual);
        atual = '';
      }
      saida.push('');
      continue;
    }

    if (pareceTitulo(linha)) {
      if (atual) {
        saida.push(atual);
        atual = '';
      }
      saida.push(linha);
      continue;
    }

    if (!atual) {
      atual = linha;
      continue;
    }

    const terminaFrase = /[.!?:;]$/.test(atual);
    const comecaBloco = /^(#{1,6}\s|[-*•]|\d+[.)]|[a-z][)])/i.test(linha);
    const comecaTituloMaiusculo = /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s.()-]{3,}$/.test(linha) && linha.length < 80;

    if (!terminaFrase && !comecaBloco && !comecaTituloMaiusculo) {
      atual = `${atual} ${linha}`.replace(/\s+/g, ' ');
    } else {
      saida.push(atual);
      atual = linha;
    }
  }

  if (atual) saida.push(atual);
  return saida.join('\n');
}

function textoUtil(texto: string): string {
  return texto
    .replace(/^#{1,6}.*$/gm, '')
    .replace(/^Atualizado em .*$/gim, '')
    .replace(/^Publicado em .*$/gim, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function comoTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const texto = String(valor).trim();
  return texto || null;
}

function hashDe(conteudo: string): string {
  return createHash('sha256').update(conteudo).digest('hex');
}

/** Título legível a partir do nome do arquivo, quando o YAML não traz um. */
function tituloDoArquivo(arquivo: string): string {
  return path
    .basename(arquivo, '.md')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ==============================================================================
// Banco
// ==============================================================================

const TIPO_DOCUMENTO_SITE = 'site_ifpr';

async function existeEmbedding(prisma: PrismaClient): Promise<boolean> {
  // Em ambiente sem pgvector a COLUNA não existe: `$queryRaw` estoura e isso
  // aqui não é erro — é a resposta "não há embedding nenhum".
  try {
    const linhas = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT count(*)::int AS total FROM "chunks_kb" WHERE "embedding" IS NOT NULL`
    );
    return (linhas[0]?.total ?? 0) > 0;
  } catch {
    return false;
  }
}

async function gravarChunks(
  prisma: PrismaClient,
  documentoId: string,
  versao: number,
  chunks: Array<{ texto: string; secao: string | null }>,
  categoria: string,
  urlFonte: string | null,
  chaveGemini: string | null,
  opcoes: Opcoes
): Promise<{ total: number; comEmbedding: number }> {
  if (opcoes.dryRun) return { total: chunks.length, comEmbedding: 0 };

  const linhas = chunks.map((chunk, indice) => ({
    id: `ck_${documentoId}_${indice}`,
    documentoId,
    documentoVersao: versao,
    chunkIndex: indice,
    texto: chunk.texto,
    secao: chunk.secao,
    categoria,
    metadata: {
      origem: 'extrator_ifpr',
      url_fonte: urlFonte,
      chunk_total: chunks.length,
    } as Record<string, unknown>,
    ativo: true,
  }));

  for (let i = 0; i < linhas.length; i += 500) {
    await prisma.chunkKb.createMany({
      data: linhas.slice(i, i + 500).map((linha) => ({
        ...linha,
        metadata: linha.metadata as Prisma.InputJsonValue,
      })),
    });
  }

  if (opcoes.semEmbeddings || !chaveGemini) return { total: linhas.length, comEmbedding: 0 };

  const textos = linhas.map((linha) =>
    linha.secao ? `${linha.secao}: ${linha.texto}` : linha.texto
  );

  const vetores: number[][] = [];
  for (let i = 0; i < textos.length; i += 64) {
    const lote = textos.slice(i, i + 64);
    const gerados = await generateBatchEmbeddings(lote, { apiKey: chaveGemini });
    gerados.forEach((vetor) => validateEmbedding(vetor));
    vetores.push(...gerados);
  }

  await saveChunksWithEmbeddings(
    linhas.map((linha, indice) => ({
      id: linha.id,
      documentoId,
      documentoVersao: versao,
      chunkIndex: indice,
      texto: linha.texto,
      secao: linha.secao,
      categoria,
      metadata: linha.metadata,
      ativo: true,
      embedding: vetores[indice],
    })),
    prisma
  );

  return { total: linhas.length, comEmbedding: vetores.length };
}

async function importarDocumento(
  prisma: PrismaClient,
  doc: DocumentoExtraido,
  opcoes: Opcoes,
  chaveGemini: string | null,
  haEmbeddings: boolean
): Promise<{ resultado: 'importado' | 'atualizado' | 'sem-mudanca'; chunks: number; comEmbedding: number }> {
  const fm = doc.frontmatter;
  const idOrigem = comoTexto(fm.id) ?? hashDe(doc.arquivo).slice(0, 24);
  const refId = `ifpr-md:${idOrigem}`;
  const urlFonte = comoTexto(fm.url_fonte) ?? comoTexto(fm.url_documento_original);
  // A URL entra no hash de propósito: se o extrator corrigir o endereço de
  // origem (link quebrado, página renomeada), o documento precisa ser regravado
  // — senão a citação continuaria apontando para o link antigo.
  const hash = hashDe(`${doc.texto}|${urlFonte ?? ''}`);

  const metadata = {
    source: 'extrator_ifpr',
    extrator_id: idOrigem,
    categoria: doc.categoria,
    tipo_documento: comoTexto(fm.tipo_documento),
    url_fonte: urlFonte,
    url_documento_original: comoTexto(fm.url_documento_original),
    pagina_de_origem: comoTexto(fm.pagina_de_origem),
    data_publicacao: comoTexto(fm.data_publicacao),
    ultima_atualizacao: comoTexto(fm.ultima_atualizacao),
    setor_responsavel: comoTexto(fm.setor_responsavel),
    campus: comoTexto(fm.campus) ?? 'Ivaiporã',
    hash_conteudo: comoTexto(fm.hash_conteudo),
    caminho_arquivo: doc.arquivo,
    importado_em: new Date().toISOString(),
  };

  const chunks = chunkDocument(doc.texto);

  const existente = await prisma.documentoKb.findFirst({
    where: { refId },
    orderBy: { versao: 'desc' },
    select: { id: true, versao: true, hashArquivo: true, totalChunks: true },
  });

  const precisaEmbedding = !!chaveGemini && !opcoes.semEmbeddings && !haEmbeddings;

  if (
    existente &&
    !opcoes.forcar &&
    existente.hashArquivo === hash &&
    existente.totalChunks === chunks.length &&
    !precisaEmbedding
  ) {
    return { resultado: 'sem-mudanca', chunks: chunks.length, comEmbedding: 0 };
  }

  if (opcoes.dryRun) {
    return { resultado: existente ? 'atualizado' : 'importado', chunks: chunks.length, comEmbedding: 0 };
  }

  const versao = existente ? existente.versao + 1 : 1;
  const dadosDocumento = {
    titulo: doc.titulo,
    tipo: TIPO_DOCUMENTO_SITE,
    refId,
    hashArquivo: hash,
    versao,
    ativo: true,
    totalChunks: chunks.length,
    metadata,
  };

  let documentoId: string;

  if (existente) {
    // Versiona no lugar: os chunks antigos são apagados antes de recriar, para
    // que a busca nunca devolva dois textos do mesmo documento ao mesmo tempo.
    await prisma.chunkKb.deleteMany({ where: { documentoId: existente.id } });
    const atualizado = await prisma.documentoKb.update({
      where: { id: existente.id },
      data: { ...dadosDocumento, status: 'chunking', erro: null },
      select: { id: true },
    });
    documentoId = atualizado.id;
  } else {
    const criado = await prisma.documentoKb.create({
      data: { ...dadosDocumento, status: 'chunking' },
      select: { id: true },
    });
    documentoId = criado.id;
  }

  const resultado = await gravarChunks(
    prisma,
    documentoId,
    versao,
    chunks,
    doc.categoria,
    urlFonte,
    chaveGemini,
    opcoes
  );

  await prisma.documentoKb.update({
    where: { id: documentoId },
    data: {
      status: 'indexed',
      processadoEm: new Date(),
      embeddingDimensions: 1536,
      metadata: {
        ...metadata,
        chunks: resultado.total,
        embedding: resultado.comEmbedding > 0 ? 'gerado' : 'pendente',
      },
    },
  });

  return {
    resultado: existente ? 'atualizado' : 'importado',
    chunks: resultado.total,
    comEmbedding: resultado.comEmbedding,
  };
}

// ==============================================================================
// Documento de índice (o que a IFizinha "sabe")
// ==============================================================================

const DESCRICAO_CATEGORIA: Record<string, string> = {
  edital: 'Editais, resultados e publicações oficiais do campus',
  curso: 'Cursos ofertados: FIC, técnicos, graduação e pós-graduação',
  ppc: 'Projetos Pedagógicos de Curso (PPC) — matriz, carga horária, ementas',
  institucional: 'Documentos institucionais, portarias, planos, relatórios e atas',
  norma: 'Normas internas do campus',
  regulamento: 'Regulamentos acadêmicos e de pessoal',
  secretaria: 'Secretaria acadêmica: matrícula, transferências, declarações',
  ensino: 'Ensino: monitoria, PAIPE, programas de apoio ao estudante',
  estagio: 'Estágios, convênios e processos de estágio',
  extensao: 'Projetos de extensão, editais e ações com a comunidade',
  extens: 'Projetos de extensão, editais e ações com a comunidade',
  pesquisa: 'Pesquisa, iniciação científica e inovação',
  concurso: 'Concursos e processos seletivos para servidores',
  diepex: 'DIEPEX — ensino, pesquisa e extensão do campus',
  assistencia: 'Assistência estudantil: auxílios e benefícios',
};

async function gerarDocumentoIndice(
  prisma: PrismaClient,
  opcoes: Opcoes,
  chaveGemini: string | null
): Promise<{ documentos: number; chunks: number }> {
  const documentos = await prisma.documentoKb.findMany({
    where: { ativo: true, tipo: TIPO_DOCUMENTO_SITE },
    select: { titulo: true, metadata: true },
    orderBy: { titulo: 'asc' },
  });

  if (documentos.length === 0) return { documentos: 0, chunks: 0 };

  const porCategoria = new Map<string, string[]>();
  for (const documento of documentos) {
    const meta = (documento.metadata ?? {}) as Record<string, unknown>;
    const categoria = typeof meta.categoria === 'string' ? meta.categoria : 'outros';
    const lista = porCategoria.get(categoria) ?? [];
    lista.push(documento.titulo);
    porCategoria.set(categoria, lista);
  }

  const categorias = [...porCategoria.entries()].sort((a, b) => b[1].length - a[1].length);
  const site = (process.env.NEXTAUTH_URL || 'https://portal.ifcoding.com.br').replace(/\/$/, '');
  const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());

  const linhas: string[] = [
    '# Base de conhecimento da IFizinha — IFPR Campus Ivaiporã',
    '',
    `Atualizada em ${data}.`,
    '',
    `A IFizinha aprendeu ${documentos.length} documentos oficiais do site do campus (ifpr.edu.br/ivaipora) e consegue responder sobre eles citando sempre o link da fonte.`,
    '',
    '## Categorias de conteúdo disponíveis',
    '',
  ];

  for (const [categoria, titulos] of categorias) {
    const descricao = DESCRICAO_CATEGORIA[categoria] ?? 'Conteúdo do site institucional';
    linhas.push(`- **${categoria}** (${titulos.length} documentos) — ${descricao}`);
    for (const titulo of titulos.slice(0, 5)) {
      linhas.push(`  - ${titulo}`);
    }
    if (titulos.length > 5) linhas.push(`  - _(e mais ${titulos.length - 5})_`);
  }

  linhas.push(
    '',
    '## Onde ver a lista completa',
    '',
    `A lista completa, com link para a página oficial de cada documento, fica em ${site}/ifizinha/conteudos.`,
    '',
    '## Como a IFizinha responde',
    '',
    '1. Procura nos documentos acima os trechos mais parecidos com a pergunta.',
    '2. Responde com base APENAS nesses trechos.',
    '3. Mostra no fim da resposta os links das fontes usadas, para a pessoa conferir no site oficial.',
    ''
  );

  const texto = linhas.join('\n');
  const caminhoDoIndice = '/ifizinha/conteudos';
  // Mesma regra dos documentos: a URL de origem faz parte do hash, então mudar
  // o endereço do índice atualiza o documento em vez de deixar o link antigo.
  const hash = hashDe(`${texto}|${caminhoDoIndice}`);
  const chunks = chunkDocument(texto);
  const refId = 'ifpr-md:indice';

  const existente = await prisma.documentoKb.findFirst({
    where: { refId },
    orderBy: { versao: 'desc' },
    select: { id: true, versao: true, hashArquivo: true },
  });

  if (existente && existente.hashArquivo === hash && !opcoes.forcar) {
    return { documentos: documentos.length, chunks: chunks.length };
  }

  if (opcoes.dryRun) return { documentos: documentos.length, chunks: chunks.length };

  const versao = existente ? existente.versao + 1 : 1;
  const metadata = {
    source: 'indice_rag',
    categoria: 'indice',
    // Caminho relativo de propósito: a página do índice pertence a este portal,
    // então o link funciona em qualquer domínio (inclusive no de teste), e a
    // interface resolve a URL absoluta sozinha.
    url_fonte: '/ifizinha/conteudos',
    documentos_indexados: documentos.length,
    gerado_em: new Date().toISOString(),
  };

  let documentoId: string;
  if (existente) {
    await prisma.chunkKb.deleteMany({ where: { documentoId: existente.id } });
    const atualizado = await prisma.documentoKb.update({
      where: { id: existente.id },
      data: {
        titulo: 'Índice de conteúdos que a IFizinha conhece',
        hashArquivo: hash,
        versao,
        ativo: true,
        totalChunks: chunks.length,
        status: 'chunking',
        metadata,
      },
      select: { id: true },
    });
    documentoId = atualizado.id;
  } else {
    const criado = await prisma.documentoKb.create({
      data: {
        titulo: 'Índice de conteúdos que a IFizinha conhece',
        tipo: 'indice_kb',
        refId,
        hashArquivo: hash,
        versao,
        status: 'chunking',
        totalChunks: chunks.length,
        metadata,
      },
      select: { id: true },
    });
    documentoId = criado.id;
  }

  const resultado = await gravarChunks(
    prisma,
    documentoId,
    versao,
    chunks,
    'indice',
    '/ifizinha/conteudos',
    chaveGemini,
    opcoes
  );

  await prisma.documentoKb.update({
    where: { id: documentoId },
    data: { status: 'indexed', processadoEm: new Date() },
  });

  return { documentos: documentos.length, chunks: resultado.total };
}

// ==============================================================================
// Main
// ==============================================================================

async function main(): Promise<void> {
  const opcoes = lerOpcoes();
  const chaveGemini = process.env.GEMINI_API_KEY?.trim() || null;
  const inicio = Date.now();

  console.log('\n=== Importação do corpus IFPR → RAG da IFizinha ===\n');
  console.log(`Corpus:   ${opcoes.dir}`);
  console.log(`Banco:    ${(process.env.DATABASE_URL ?? '(sem DATABASE_URL)').replace(/:[^:@/]+@/, ':***@')}`);
  console.log(`Embedding: ${chaveGemini && !opcoes.semEmbeddings ? 'Gemini (semântico)' : 'NENHUM — os chunks entram sem vetor (busca textual)'}`);
  if (opcoes.dryRun) console.log('Modo:     DRY-RUN (nada será gravado)');

  if (!fs.existsSync(opcoes.dir)) {
    console.error(`\nERRO: pasta do corpus não encontrada: ${opcoes.dir}`);
    console.error('Passe --dir=CAMINHO ou defina MARKDOWN_DIR.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const resumo: Resumo = {
    documentosLidos: 0,
    documentosIgnorados: 0,
    documentosImportados: 0,
    documentosAtualizados: 0,
    documentosSemMudanca: 0,
    documentosComErro: 0,
    chunksGravados: 0,
    chunksComEmbedding: 0,
    erros: [],
    ignorados: [],
    duracaoMs: 0,
  };

  try {
    if (!opcoes.apenasIndice) {
      const padrao = opcoes.categorias
        ? opcoes.categorias.map((categoria) => `${categoria}/**/*.md`)
        : ['**/*.md'];
      const arquivos = await fg(padrao, { cwd: opcoes.dir, absolute: false, onlyFiles: true });
      arquivos.sort();

      const selecionados = opcoes.limite ? arquivos.slice(0, opcoes.limite) : arquivos;
      console.log(`Arquivos: ${selecionados.length}${opcoes.limite ? ` (de ${arquivos.length})` : ''}\n`);

      const haEmbeddings = chaveGemini && !opcoes.semEmbeddings ? await existeEmbedding(prisma) : false;

      for (let i = 0; i < selecionados.length; i++) {
        const arquivo = selecionados[i];
        resumo.documentosLidos++;

        try {
          const bruto = fs.readFileSync(path.join(opcoes.dir, arquivo), 'utf8');
          const { frontmatter, corpo } = separarFrontmatter(bruto);
          const categoria = arquivo.split(/[\\/]/)[0];
          const tipoDocumento = String(frontmatter.tipo_documento ?? '');

          let texto = limparCorpo(corpo);
          if (/pdf/i.test(tipoDocumento)) texto = reflowDePdf(texto);

          if (textoUtil(texto).length < 120) {
            resumo.documentosIgnorados++;
            resumo.ignorados.push({ arquivo, motivo: 'conteúdo útil abaixo de 120 caracteres' });
            continue;
          }

          const documento: DocumentoExtraido = {
            arquivo,
            categoria,
            frontmatter,
            titulo:
              comoTexto(frontmatter.titulo) ??
              `${tituloDoArquivo(arquivo)} (${categoria})`,
            texto,
          };

          const { resultado, chunks, comEmbedding } = await importarDocumento(
            prisma,
            documento,
            opcoes,
            chaveGemini,
            haEmbeddings
          );

          if (resultado === 'importado') resumo.documentosImportados++;
          else if (resultado === 'atualizado') resumo.documentosAtualizados++;
          else resumo.documentosSemMudanca++;

          if (resultado !== 'sem-mudanca') {
            resumo.chunksGravados += chunks;
            resumo.chunksComEmbedding += comEmbedding;
          }

          if (opcoes.verboso || resultado !== 'sem-mudanca') {
            console.log(
              `[${i + 1}/${selecionados.length}] ${resultado.padEnd(12)} ${arquivo}`
            );
          } else if ((i + 1) % 100 === 0) {
            console.log(`[${i + 1}/${selecionados.length}] ... ${resumo.documentosSemMudanca} sem mudança`);
          }
        } catch (erro) {
          resumo.documentosComErro++;
          const mensagem = erro instanceof Error ? erro.message : String(erro);
          resumo.erros.push({ arquivo, erro: mensagem });
          console.error(`[${i + 1}/${selecionados.length}] ERRO ${arquivo}: ${mensagem}`);
        }
      }
    }

    const indice = await gerarDocumentoIndice(prisma, opcoes, chaveGemini);
    if (indice.documentos > 0) {
      console.log(
        `\nÍndice de conteúdos: ${indice.documentos} documentos catalogados em ${indice.chunks} trechos.`
      );
    }

    resumo.duracaoMs = Date.now() - inicio;

    const relatorioDir = path.join(process.cwd(), 'storage', 'relatorios');
    if (!opcoes.dryRun) {
      fs.mkdirSync(relatorioDir, { recursive: true });
      fs.writeFileSync(
        path.join(relatorioDir, 'importacao-rag-ifpr.json'),
        JSON.stringify({ ...resumo, geradoEm: new Date().toISOString(), corpus: opcoes.dir }, null, 2)
      );
    }

    console.log('\n=== Resumo ===');
    console.log(`Lidos:              ${resumo.documentosLidos}`);
    console.log(`Importados:         ${resumo.documentosImportados}`);
    console.log(`Atualizados:        ${resumo.documentosAtualizados}`);
    console.log(`Sem mudança:        ${resumo.documentosSemMudanca}`);
    console.log(`Ignorados:          ${resumo.documentosIgnorados} (sem conteúdo útil)`);
    console.log(`Com erro:           ${resumo.documentosComErro}`);
    console.log(`Chunks gravados:    ${resumo.chunksGravados}`);
    console.log(`Chunks com vetor:   ${resumo.chunksComEmbedding}`);
    console.log(`Tempo:              ${(resumo.duracaoMs / 1000).toFixed(1)}s`);

    if (!chaveGemini && !opcoes.dryRun) {
      console.log(
        '\nAVISO: sem GEMINI_API_KEY os trechos foram gravados SEM vetor.\n' +
          'A busca textual responde, mas não há busca semântica (sinônimos/paráfrases).\n' +
          'Configure a chave e rode `npm run rag:importar -- --forcar` para gerar os vetores.'
      );
    }

    if (resumo.erros.length > 0) {
      console.log(`\n${resumo.erros.length} arquivo(s) com erro — relatório em storage/relatorios/importacao-rag-ifpr.json`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error('\nFalha na importação:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
