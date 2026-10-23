import { embeddingSignature, validateEmbedding } from '@/lib/embeddings';
/**
 * Supabase Vector Client — Operações Vetoriais em Postgres + pgvector
 *
 * Gerencia inserção de chunks com embeddings vetoriais e execução de busca por
 * similaridade de cosseno (pgvector), com uma camada textual de verdade como
 * rede de segurança.
 *
 * HISTÓRICO (para não regredir): a primeira versão do fallback devolvia 50
 * chunks arbitrários com `similarity: 0.5` fixo. O chat respondia normalmente,
 * com o documento errado, e não havia sintoma visível — nem no log nem na
 * resposta. Hoje o fallback é busca textual de verdade (Postgres FTS em
 * português, sem extensão extra), e se nada casar ele devolve lista vazia: é
 * melhor a IFizinha dizer "não encontrei" do que citar o documento errado.
 */

import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const log = createLogger('busca-vetorial');

export interface ChunkToInsert {
  id?: string;
  documentoId: string;
  documentoVersao?: number;
  chunkIndex: number;
  texto: string;
  secao?: string | null;
  categoria?: string | null;
  paginaInicial?: number | null;
  paginaFinal?: number | null;
  metadata?: Record<string, unknown>;
  embedding: number[];
  ativo?: boolean;
}

export interface ChunkSearchResult {
  id: string;
  documento_id: string;
  chunk_index: number;
  texto: string;
  secao: string | null;
  categoria: string | null;
  pagina_inicial: number | null;
  pagina_final: number | null;
  metadata: Record<string, unknown>;
  documento_titulo: string;
  documento_tipo: string;
  similarity: number;
  /** URL pública da fonte original — vem do metadata do documento/chunk. */
  documento_url?: string | null;
}

export interface SearchOptions {
  queryEmbedding?: number[];
  /** Pergunta em texto — usada pela busca textual de fallback. */
  queryText?: string;
  matchCount?: number;
  filterCategoria?: string | null;
  filterTipo?: string | null;
  minSimilarity?: number;
}

/** Chaves onde o extrator/upload guardam o endereço público do documento. */
const CHAVES_DE_URL = ['url_fonte', 'url_documento_original', 'url', 'link'];

/**
 * Extrai a URL de origem de um metadata JSON (do chunk ou do documento).
 *
 * O extrator do site grava `url_fonte` no metadata de cada chunk justamente
 * para que a citação sobreviva a qualquer mudança no documento — é este campo
 * que vira o "confira na fonte oficial" da resposta.
 */
export function extrairUrlDaFonte(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const dados = metadata as Record<string, unknown>;

  for (const chave of CHAVES_DE_URL) {
    const valor = dados[chave];
    if (typeof valor === 'string' && /^https?:\/\//i.test(valor)) return valor;
  }

  return null;
}

/**
 * Salva chunks com seus respectivos vetores de embedding no banco.
 *
 * O cliente pode ser injetado para reuso em scripts de importação (que criam o
 * próprio PrismaClient fora do runtime do Next).
 */
export async function saveChunksWithEmbeddings(
  chunks: ChunkToInsert[],
  cliente: PrismaClient = prisma
): Promise<number> {
  if (chunks.length === 0) return 0;

  let insertedCount = 0;

  for (const chunk of chunks) {
    const chunkId = chunk.id || `chk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    validateEmbedding(chunk.embedding);
    const metadataJson = JSON.stringify({ ...chunk.metadata, embedding_signature: embeddingSignature() });
    const vectorString = `[${chunk.embedding.join(',')}]`;
    const ativo = chunk.ativo !== undefined ? chunk.ativo : true;
    const versao = chunk.documentoVersao || 1;

    try {
      // Inserção com cast explícito para o tipo vector do pgvector
      await cliente.$executeRawUnsafe(
        `
        INSERT INTO "chunks_kb" (
          "id", "documento_id", "documento_versao", "chunk_index",
          "texto", "secao", "categoria", "pagina_inicial", "pagina_final",
          "metadata", "ativo", "created_at", "embedding"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, NOW(), $12::vector)
        ON CONFLICT ("id") DO UPDATE SET
          "texto" = EXCLUDED."texto",
          "secao" = EXCLUDED."secao",
          "categoria" = EXCLUDED."categoria",
          "metadata" = EXCLUDED."metadata",
          "ativo" = EXCLUDED."ativo",
          "embedding" = EXCLUDED."embedding"
        `,
        chunkId,
        chunk.documentoId,
        versao,
        chunk.chunkIndex,
        chunk.texto,
        chunk.secao || null,
        chunk.categoria || null,
        chunk.paginaInicial || null,
        chunk.paginaFinal || null,
        metadataJson,
        ativo,
        vectorString
      );

      insertedCount++;
    } catch (err) {
      throw new Error(`Não foi possível persistir o vetor do chunk ${chunk.chunkIndex}`, { cause: err });
    }
  }

  return insertedCount;
}

/**
 * Monta os filtros opcionais de categoria/tipo com numeração de parâmetros
 * correta — sem isso, filtrar só por tipo (sem categoria) deixaria um `$4`
 * apontando para um parâmetro inexistente.
 */
function montarFiltros(
  base: unknown[],
  filterCategoria: string | null,
  filterTipo: string | null
): { sql: string; params: unknown[] } {
  const params = [...base];
  const condicoes: string[] = [];

  if (filterCategoria) {
    const indice = params.length + 1;
    condicoes.push(`AND (c.categoria = $${indice} OR (c.metadata->>'categoria') = $${indice})`);
    params.push(filterCategoria);
  }
  if (filterTipo) {
    condicoes.push(`AND d.tipo = $${params.length + 1}`);
    params.push(filterTipo);
  }

  return { sql: condicoes.join(' '), params };
}

/**
 * Busca textual no Postgres (full text search em português).
 *
 * Usada quando a busca vetorial não está disponível (ambiente sem pgvector) ou
 * não devolve nada (chunks importados sem embedding). Não exige extensão
 * nenhuma — só `to_tsvector`, que é nativa — e usa a função `normalizar_busca`
 * (prisma/busca-textual-setup.sql) para ignorar acentos.
 *
 * Como o ranking é feito (e por que não é só `ts_rank_cd`):
 *
 *   `ts_rank_cd` não usa IDF — ele mede densidade/frequência dos termos. Numa
 *   base real, isso faz um PDF de 400 páginas que repete "curso" 200 vezes
 *   ganhar de uma página institucional curta que responde exatamente a
 *   pergunta. Medido: "quais cursos o campus oferece?" devolvia uma portaria
 *   sobre remoção de servidores.
 *
 *   Então a busca recupera candidatos por três consultas (E de todos os termos,
 *   E dos 2 mais específicos, OU de todos) e reordena em JS com peso por IDF:
 *   termo raro ("eletrotécnica") vale muito mais que termo comum ("curso").
 */
async function buscarTextualmente(
  cliente: PrismaClient,
  consulta: string,
  matchCount: number,
  filterCategoria: string | null,
  filterTipo: string | null
): Promise<ChunkSearchResult[]> {
  const termo = consulta.trim();
  if (!termo) return [];

  const termos = termosDaPergunta(termo);
  if (termos.length === 0) return [];

  const maisEspecificos = [...termos].sort((a, b) => b.length - a.length).slice(0, 2);

  const tentativas =
    termos.length > 1
      ? [termos.join(' & '), maisEspecificos.join(' & '), termos.join(' | ')]
      : [termos[0]];

  const tamanhoDoPool = Math.max(matchCount * 8, 40);
  const candidatos = new Map<string, ChunkSearchResult>();

  try {
    for (const tentativa of tentativas) {
      const resultados = await consultarTextoCompleto(
        cliente,
        tentativa,
        tamanhoDoPool,
        filterCategoria,
        filterTipo
      );

      for (const resultado of resultados) {
        if (!candidatos.has(resultado.id)) candidatos.set(resultado.id, resultado);
      }

      // O "E de todos" já trouxe bastante material: não precisa do OU (que é
      // o que traz ruído de documentos longos).
      if (candidatos.size >= tamanhoDoPool && tentativa !== tentativas[tentativas.length - 1]) {
        break;
      }
    }
  } catch (err) {
    log.warn('Busca por texto completo indisponível', {
      erro: err instanceof Error ? err.message : String(err),
    });
    return buscarPorTermos(cliente, termo, matchCount, filterCategoria, filterTipo);
  }

  if (candidatos.size === 0) {
    return buscarPorTermos(cliente, termo, matchCount, filterCategoria, filterTipo);
  }

  const pesos = await pesosPorIdf(cliente, termos);

  return [...candidatos.values()]
    .map((resultado) => ({
      ...resultado,
      similarity: Number(pontuarCandidato(resultado, termos, pesos).toFixed(4)),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);
}

/** Executa uma consulta de texto completo para uma expressão tsquery montada. */
async function consultarTextoCompleto(
  cliente: PrismaClient,
  expressao: string,
  limite: number,
  filterCategoria: string | null,
  filterTipo: string | null
): Promise<ChunkSearchResult[]> {
  const { sql: whereFiltros, params: parametros } = montarFiltros(
    [expressao, limite],
    filterCategoria,
    filterTipo
  );

  return cliente.$queryRawUnsafe<ChunkSearchResult[]>(
    `
    SELECT
      c.id,
      c.documento_id,
      c.chunk_index,
      c.texto,
      c.secao,
      c.categoria,
      c.pagina_inicial,
      c.pagina_final,
      c.metadata,
      d.titulo AS documento_titulo,
      d.tipo AS documento_tipo,
      ts_rank_cd(
        to_tsvector(
          'portuguese',
          normalizar_busca(d.titulo || ' ' || coalesce(c.secao, '') || ' ' || c.texto)
        ),
        consulta.q,
        32
      )::float AS similarity
    FROM "chunks_kb" c
    JOIN "documentos_kb" d ON d.id = c.documento_id
    CROSS JOIN (
      SELECT to_tsquery('portuguese', $1) AS q
    ) consulta
    WHERE c.ativo = true
      AND d.ativo = true
      AND to_tsvector('portuguese', normalizar_busca(c.texto)) @@ consulta.q
      ${whereFiltros}
    ORDER BY similarity DESC, c.chunk_index ASC
    LIMIT $2::int
    `,
    ...parametros
  );
}

/**
 * Peso IDF de cada termo: quanto mais raro no corpus, mais ele discrimina.
 *
 * Sem isso, "quais cursos o campus oferece" pesa "curso" (que aparece em
 * praticamente todo documento) igual a "eletrotécnica" (que aparece em poucos).
 */
async function pesosPorIdf(
  cliente: PrismaClient,
  termos: string[]
): Promise<Map<string, number>> {
  const pesos = new Map<string, number>();

  try {
    const [total] = await cliente.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT count(*)::int AS total FROM "chunks_kb" WHERE "ativo" = true`
    );
    const totalChunks = total?.total ?? 0;
    if (totalChunks === 0) return pesos;

    const frequencias = await Promise.all(
      termos.map(async (termo) => {
        const [linha] = await cliente.$queryRawUnsafe<Array<{ total: number }>>(
          `
          SELECT count(*)::int AS total
          FROM "chunks_kb" c
          WHERE c."ativo" = true
            AND to_tsvector('portuguese', normalizar_busca(c."texto"))
                @@ to_tsquery('portuguese', $1)
          `,
          termo
        );
        return [termo, linha?.total ?? 0] as const;
      })
    );

    for (const [termo, frequencia] of frequencias) {
      pesos.set(termo, Math.log(1 + totalChunks / (1 + frequencia)));
    }
  } catch {
    // Sem IDF a busca ainda funciona (só ordena pior) — não é motivo para falhar.
  }

  return pesos;
}

/**
 * Presença de um termo no texto, tolerante a flexão.
 *
 * A comparação é por prefixo do radical ("transferenci" casa "transferência" e
 * "transferências"), que é o suficiente para o vocabulário desta base e evita
 * depender de um stemmer em JS.
 */
function contemTermo(textoNormalizado: string, termo: string): boolean {
  if (!textoNormalizado) return false;
  const radical = termo.length > 5 ? termo.slice(0, -1) : termo;
  return textoNormalizado.includes(radical);
}

/** Reordena um candidato combinando cobertura (com IDF), título e rank bruto. */
function pontuarCandidato(
  resultado: ChunkSearchResult,
  termos: string[],
  pesos: Map<string, number>
): number {
  const texto = normalizarParaComparacao(resultado.texto);
  const titulo = normalizarParaComparacao(resultado.documento_titulo);

  let pesoTotal = 0;
  let pesoNoTexto = 0;
  let pesoNoTitulo = 0;

  for (const termo of termos) {
    const peso = pesos.get(termo) ?? 1;
    pesoTotal += peso;
    if (contemTermo(texto, termo)) pesoNoTexto += peso;
    if (contemTermo(titulo, termo)) pesoNoTitulo += peso;
  }

  if (pesoTotal === 0) return resultado.similarity;

  const cobertura = pesoNoTexto / pesoTotal;
  const coberturaTitulo = pesoNoTitulo / pesoTotal;
  const forca = Math.min(1, (resultado.similarity ?? 0) * 4);

  // 55% cobertura do texto, 30% cobertura do título, 15% densidade de termos.
  return 0.55 * cobertura + 0.3 * coberturaTitulo + 0.15 * forca;
}

/** Espelha `normalizar_busca` do Postgres (minúsculas, sem acento). */
function normalizarParaComparacao(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Palavras que não ajudam a discriminar documento nenhum. */
const PALAVRAS_VAZIAS = new Set([
  'qual', 'quais', 'quando', 'onde', 'como', 'porque', 'para', 'pelo', 'pela',
  'sobre', 'tem', 'ter', 'sao', 'foi', 'era', 'ser', 'esta', 'esse',
  'essa', 'isso', 'aquilo', 'meu', 'minha', 'nosso', 'nossa', 'voce', 'quero',
  'saber', 'falar', 'dizer', 'posso', 'pode', 'preciso', 'campus', 'ifpr', 'ivaipora',
  'portal', 'conecta', 'quero',
]);

function termosDaPergunta(pergunta: string): string[] {
  const palavras = pergunta
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/.-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const termos = palavras.filter((termo) => {
    if (PALAVRAS_VAZIAS.has(termo)) return false;
    // Números curtos (ano, número de edital "86") discriminam muito — mantém.
    if (/^\d+$/.test(termo)) return termo.length >= 2;
    return termo.length >= 4;
  });

  return [...new Set(termos)].slice(0, 8);
}

/**
 * Último recurso: casa a pergunta (ou seus termos) como substring do texto.
 *
 * Faz full scan — mas de ~15 mil chunks, o que foi medido em dezenas de
 * milissegundos, e só acontece quando a FTS não devolveu nada.
 */
async function buscarPorTermos(
  cliente: PrismaClient,
  consulta: string,
  matchCount: number,
  filterCategoria: string | null,
  filterTipo: string | null
): Promise<ChunkSearchResult[]> {
  const termos = termosDaPergunta(consulta);
  const alvo = termos.length > 0 ? termos : [consulta.toLowerCase()];

  const { sql: filtros, params: parametros } = montarFiltros(
    [alvo, matchCount],
    filterCategoria,
    filterTipo
  );

  try {
    return await cliente.$queryRawUnsafe<ChunkSearchResult[]>(
      `
      SELECT
        t.id,
        t.documento_id,
        t.chunk_index,
        t.texto,
        t.secao,
        t.categoria,
        t.pagina_inicial,
        t.pagina_final,
        t.metadata,
        t.doc_titulo AS documento_titulo,
        t.doc_tipo AS documento_tipo,
        (0.30 + 0.05 * (
          SELECT count(*) FROM unnest($1::text[]) AS termo
          WHERE t.texto_norm LIKE '%' || termo || '%'
        ))::float AS similarity
      FROM (
        SELECT
          c.id, c.documento_id, c.chunk_index, c.texto, c.secao, c.categoria,
          c.pagina_inicial, c.pagina_final, c.metadata,
          d.titulo AS doc_titulo, d.tipo AS doc_tipo,
          normalizar_busca(c.texto) AS texto_norm
        FROM "chunks_kb" c
        JOIN "documentos_kb" d ON d.id = c.documento_id
        WHERE c.ativo = true
          AND d.ativo = true
          ${filtros}
      ) t
      WHERE EXISTS (
        SELECT 1 FROM unnest($1::text[]) AS termo
        WHERE t.texto_norm LIKE '%' || termo || '%'
      )
      ORDER BY similarity DESC, length(t.texto) ASC
      LIMIT $2::int
      `,
      ...parametros
    );
  } catch (err) {
    log.warn('Busca por termos falhou (função normalizar_busca ausente?)', {
      erro: err instanceof Error ? err.message : String(err),
    });
    return buscarSemNormalizacao(cliente, consulta, matchCount, filterCategoria, filterTipo);
  }
}

/** Plano C: ILIKE cru, sem depender de nenhuma função criada por SQL. */
async function buscarSemNormalizacao(
  cliente: PrismaClient,
  consulta: string,
  matchCount: number,
  filterCategoria: string | null,
  filterTipo: string | null
): Promise<ChunkSearchResult[]> {
  const { sql: filtros, params: parametros } = montarFiltros(
    [consulta.trim(), matchCount],
    filterCategoria,
    filterTipo
  );

  try {
    return await cliente.$queryRawUnsafe<ChunkSearchResult[]>(
      `
      SELECT
        c.id,
        c.documento_id,
        c.chunk_index,
        c.texto,
        c.secao,
        c.categoria,
        c.pagina_inicial,
        c.pagina_final,
        c.metadata,
        d.titulo AS documento_titulo,
        d.tipo AS documento_tipo,
        0.30::float AS similarity
      FROM "chunks_kb" c
      JOIN "documentos_kb" d ON d.id = c.documento_id
      WHERE c.ativo = true
        AND d.ativo = true
        AND c.texto ILIKE '%' || $1 || '%'
        ${filtros}
      ORDER BY length(c.texto) ASC
      LIMIT $2::int
      `,
      ...parametros
    );
  } catch (err) {
    log.error('Nenhuma estratégia de busca textual disponível', {
      erro: err instanceof Error ? err.message : String(err),
    });
    throw new Error('Recuperação textual indisponível', { cause: err });
  }
}

/**
 * Busca híbrida: similaridade vetorial + casamento textual, fundidos por RRF.
 *
 * Por que híbrida e não só vetorial:
 *
 *  - perguntas com termo exato ("edital 164/2025", "eletrotécnica") são o ponto
 *    fraco do embedding, e o ponto forte da busca textual;
 *  - e o inverso vale para paráfrase ("quanto custa morar na cidade?"), que só
 *    o vetor acha;
 *  - importação em andamento deixa parte dos trechos sem vetor — sem a camada
 *    textual, a busca vetorial responderia com os poucos trechos já indexados,
 *    ignorando o resto da base.
 *
 * A fusão é Reciprocal Rank Fusion (`1/(60+posição)`), o método padrão para
 * combinar rankings de pontuações que não são comparáveis entre si (cosseno vs
 * ts_rank_cd). Nada de limiar mágico.
 */
export async function searchSimilarChunks(options: SearchOptions): Promise<ChunkSearchResult[]> {
  const {
    queryEmbedding,
    queryText = '',
    matchCount = 5,
    filterCategoria = null,
    filterTipo = null,
    minSimilarity = 0.2,
  } = options;

  const [vetoriais, textuais] = await Promise.all([
    queryEmbedding ? buscarPorVetor(queryEmbedding, matchCount * 2, filterCategoria, filterTipo, minSimilarity) : Promise.resolve([]),
    queryText ? buscarTextualmente(prisma, queryText, matchCount * 2, filterCategoria, filterTipo) : Promise.resolve([]),
  ]);

  if (vetoriais.length === 0 && textuais.length === 0) return [];
  if (textuais.length === 0) return vetoriais.slice(0, matchCount).map(enriquecerComUrl);
  if (vetoriais.length === 0) return textuais.slice(0, matchCount).map(enriquecerComUrl);

  log.debug('Busca híbrida', { vetoriais: vetoriais.length, textuais: textuais.length });

  return fundirPorRrf(vetoriais, textuais, matchCount).map(enriquecerComUrl);
}

/** Ranking vetorial (RPC do pgvector, com a consulta direta como plano B). */
async function buscarPorVetor(
  queryEmbedding: number[],
  limite: number,
  filterCategoria: string | null,
  filterTipo: string | null,
  minSimilarity: number
): Promise<ChunkSearchResult[]> {
  const vectorString = `[${queryEmbedding.join(',')}]`;

  // Consulta direta: a RPC histórica não filtra a procedência do embedding.
  try {
    validateEmbedding(queryEmbedding);
    let whereClause = `WHERE c.ativo = true AND d.ativo = true AND c.embedding IS NOT NULL AND c.metadata->>'embedding_signature' = $3`;
    const params: unknown[] = [vectorString, limite, embeddingSignature()];
    let paramIndex = 4;

    if (filterCategoria) {
      whereClause += ` AND (c.categoria = $${paramIndex} OR (c.metadata->>'categoria') = $${paramIndex})`;
      params.push(filterCategoria);
      paramIndex++;
    }

    if (filterTipo) {
      whereClause += ` AND d.tipo = $${paramIndex}`;
      params.push(filterTipo);
      paramIndex++;
    }

    const results = await prisma.$queryRawUnsafe<ChunkSearchResult[]>(
      `
      SELECT
        c.id,
        c.documento_id,
        c.chunk_index,
        c.texto,
        c.secao,
        c.categoria,
        c.pagina_inicial,
        c.pagina_final,
        c.metadata,
        d.titulo AS documento_titulo,
        d.tipo AS documento_tipo,
        (1 - (c.embedding <=> $1::vector))::float AS similarity
      FROM "chunks_kb" c
      JOIN "documentos_kb" d ON d.id = c.documento_id
      ${whereClause}
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2::int
      `,
      ...params
    );

    return (Array.isArray(results) ? results : []).filter((r) => r.similarity >= minSimilarity);
  } catch (err) {
    log.warn('Busca vetorial indisponível (pgvector ausente?)', {
      erro: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Funde dois rankings com Reciprocal Rank Fusion.
 *
 * Cada item pontua `1/(60 + posição)` em cada ranking em que aparece. O 60 é a
 * constante clássica (Cormack et al.): achata a diferença entre as primeiras
 * posições e evita que um ranking só domine.
 */
function fundirPorRrf(
  vetoriais: ChunkSearchResult[],
  textuais: ChunkSearchResult[],
  limite: number
): ChunkSearchResult[] {
  const K = 60;
  const pontos = new Map<string, { item: ChunkSearchResult; score: number }>();

  const somar = (lista: ChunkSearchResult[]) => {
    lista.forEach((item, indice) => {
      const atual = pontos.get(item.id);
      const incremento = 1 / (K + indice + 1);
      if (atual) {
        atual.score += incremento;
      } else {
        pontos.set(item.id, { item, score: incremento });
      }
    });
  };

  somar(vetoriais);
  somar(textuais);

  return [...pontos.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    // `similarity` aqui é o escore RRF normalizado para 0–1 (só serve para
    // ordenar e numerar as fontes; não é porcentagem de confiança).
    .map(({ item, score }) => ({ ...item, similarity: Number(score.toFixed(6)) }));
}

/** Preenche `documento_url` a partir do metadata do chunk, quando houver. */
function enriquecerComUrl(resultado: ChunkSearchResult): ChunkSearchResult {
  return {
    ...resultado,
    documento_url: resultado.documento_url ?? extrairUrlDaFonte(resultado.metadata),
  };
}

/**
 * Desativa versões antigas de um mesmo documento/projeto para versionamento limpo.
 */
export async function deactivateOldDocumentVersions(refIdOrTitle: string, currentDocId: string) {
  await prisma.documentoKb.updateMany({
    where: {
      id: { not: currentDocId },
      OR: [
        { refId: refIdOrTitle },
        { titulo: refIdOrTitle },
      ],
    },
    data: {
      ativo: false,
    },
  });

  await prisma.chunkKb.updateMany({
    where: {
      documentoId: { not: currentDocId },
      documento: {
        OR: [
          { refId: refIdOrTitle },
          { titulo: refIdOrTitle },
        ],
      },
    },
    data: {
      ativo: false,
    },
  });
}
