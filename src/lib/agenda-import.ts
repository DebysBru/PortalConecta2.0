import { TipoEvento } from '@prisma/client';

/**
 * Importação do calendário acadêmico para a Agenda.
 *
 * A entrada é um **CSV ou JSON** com uma linha por evento (ver
 * `DOCUMENTACAO/CALENDARIO_IMPORTACAO.md` e os modelos em `public/modelos/`).
 * Os arquivos oficiais do campus são gerados por `tools/gerar-calendario-2026.py`.
 *
 * Decisões:
 * - o separador do CSV é detectado (`;`, `,` ou TAB) porque o Excel pt-BR salva
 *   com `;` e todo mundo exporta com `,`;
 * - os nomes das colunas são aceitos em português e em inglês, com ou sem acento
 *   (`interessaAlunos`, `Interessa alunos?`, `publico`, `Público principal`...);
 * - datas aceitam `DD/MM/AAAA` (o que o Excel mostra), `AAAA-MM-DD` e ISO;
 * - `tipo` é opcional: sem ele, o tipo sai do par categoria/subcategoria pela
 *   tabela `mapearTipo` (a mesma regra usada no gerador em Python);
 * - a chave `ref` é o que torna a importação **idempotente**: reimportar o mesmo
 *   arquivo atualiza os eventos existentes em vez de duplicar. Sem `ref`, ela é
 *   derivada do título + data.
 */

export const TIPOS_EVENTO = Object.values(TipoEvento) as TipoEvento[];

/** Colunas do modelo, com o rótulo em português usado na tela de importação. */
export const COLUNAS_MODELO: { chave: string; rotulo: string; obrigatoria?: boolean; ajuda: string }[] = [
  { chave: 'ref', rotulo: 'ref', ajuda: 'Chave única do evento. Repetir a mesma ref atualiza o evento em vez de duplicar (ex.: cal2026-003).' },
  { chave: 'titulo', rotulo: 'titulo', obrigatoria: true, ajuda: 'Título do evento, como aparece na agenda.' },
  { chave: 'data', rotulo: 'data', obrigatoria: true, ajuda: 'Data de início: DD/MM/AAAA ou AAAA-MM-DD.' },
  { chave: 'dataFim', rotulo: 'dataFim', ajuda: 'Fim do período, quando o evento dura vários dias (ex.: férias de 05 a 30).' },
  { chave: 'tipo', rotulo: 'tipo', ajuda: `Um de: ${TIPOS_EVENTO.join(', ')}. Se ficar vazio, é deduzido da categoria.` },
  { chave: 'categoria', rotulo: 'categoria', ajuda: 'Categoria do calendário (ex.: Feriado / recesso / férias) — é um dos filtros da agenda.' },
  { chave: 'subcategoria', rotulo: 'subcategoria', ajuda: 'Detalhe da categoria (ex.: Matrícula / rematrícula).' },
  { chave: 'publico', rotulo: 'publico', ajuda: 'Público principal (ex.: Alunos, Professores / servidores, Comunidade acadêmica).' },
  { chave: 'nivel', rotulo: 'nivel', ajuda: 'Curso ou nível (ex.: Geral / Campus, Graduação).' },
  { chave: 'natureza', rotulo: 'natureza', ajuda: 'Natureza da ação (ex.: Informativo, Prazo).' },
  { chave: 'interessaAlunos', rotulo: 'interessaAlunos', ajuda: 'Sim/Não — alimenta o filtro "interessa aos alunos".' },
  { chave: 'interessaProfessores', rotulo: 'interessaProfessores', ajuda: 'Sim/Não — alimenta o filtro "interessa aos professores".' },
  { chave: 'descricao', rotulo: 'descricao', ajuda: 'Texto livre com detalhes do evento.' },
  { chave: 'local', rotulo: 'local', ajuda: 'Local do evento (opcional).' },
];

export type LinhaCalendario = {
  ref: string;
  titulo: string;
  descricao: string | null;
  data: Date;
  dataFim: Date | null;
  tipo: TipoEvento;
  categoria: string | null;
  subcategoria: string | null;
  publicoAlvo: string | null;
  nivel: string | null;
  natureza: string | null;
  interessaAlunos: boolean | null;
  interessaProfessores: boolean | null;
  local: string | null;
};

export type ErroImportacao = { linha: number; motivo: string };

export type ResultadoAnalise = {
  formato: 'csv' | 'json';
  separador: string | null;
  totalLinhas: number;
  linhas: LinhaCalendario[];
  erros: ErroImportacao[];
  avisos: string[];
  resumo: {
    porTipo: Record<string, number>;
    porCategoria: Record<string, number>;
    porMes: Record<string, number>;
    primeiraData: string | null;
    ultimaData: string | null;
  };
};

// ── normalização de cabeçalhos ────────────────────────────────────────────────

/** Remove acento, pontuação e caixa para comparar nomes de coluna. */
function chaveColuna(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const ALIASES: Record<string, string> = {
  ref: 'ref', referencia: 'ref', chave: 'ref', id: 'ref', idevento: 'ref', refevento: 'ref',
  titulo: 'titulo', evento: 'titulo', eventodescricaooficial: 'titulo', descricaooficial: 'titulo', nome: 'titulo',
  data: 'data', datainicio: 'data', inicio: 'data', primeiradata: 'data',
  datafim: 'dataFim', fim: 'dataFim', ultimadata: 'dataFim', datatermino: 'dataFim',
  tipo: 'tipo', tipoevento: 'tipo',
  categoria: 'categoria',
  subcategoria: 'subcategoria',
  publico: 'publico', publicoprincipal: 'publico', publicoalvo: 'publico', publicoalvoprincipal: 'publico',
  nivel: 'nivel', cursonivel: 'nivel', curso: 'nivel',
  natureza: 'natureza', naturezadaacao: 'natureza',
  interessaalunos: 'interessaAlunos',
  interessaprofessores: 'interessaProfessores',
  descricao: 'descricao', detalhes: 'descricao', observacoes: 'descricao',
  local: 'local', onde: 'local',
};

function normalizarCabecalho(nome: string): string | null {
  return ALIASES[chaveColuna(nome)] ?? null;
}

// ── parsers de valor ──────────────────────────────────────────────────────────

/** Aceita DD/MM/AAAA, AAAA-MM-DD, DD-MM-AAAA e ISO. Devolve null se não der.
 *
 * As datas saem **ao meio-dia de Brasília** (15:00 UTC). Motivo: o portal roda com
 * `TZ=America/Sao_Paulo` e a agenda mostra `data.getDate()`; uma data gravada em
 * UTC meia-noite apareceria como o dia anterior (21:00 de Brasília). Meio-dia
 * também nunca "escorrega" de dia em exportação de calendário.
 */
export function parseDataCalendario(valor: unknown): Date | null {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    // Serial do Excel (dias desde 30/12/1899) — evita perder datas quando alguém
    // salva a planilha como CSV e a coluna vira número.
    if (valor > 20000 && valor < 80000) {
      const base = Date.UTC(1899, 11, 30, 15);
      return new Date(base + valor * 86400000);
    }
    return null;
  }
  const texto = String(valor ?? '').trim();
  if (!texto) return null;

  const brasileira = texto.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (brasileira) {
    const [, dia, mes, ano] = brasileira;
    const anoCompleto = ano.length === 2 ? 2000 + Number(ano) : Number(ano);
    const data = new Date(Date.UTC(anoCompleto, Number(mes) - 1, Number(dia), 15));
    // `Date` "rola" datas impossíveis (31/02 vira 03/03) — conferimos o que saiu.
    if (data.getUTCDate() !== Number(dia) || data.getUTCMonth() !== Number(mes) - 1) return null;
    return Number.isNaN(data.getTime()) ? null : data;
  }

  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const data = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 15));
    if (data.getUTCDate() !== Number(iso[3]) || data.getUTCMonth() !== Number(iso[2]) - 1) return null;
    return Number.isNaN(data.getTime()) ? null : data;
  }

  const tentativa = new Date(texto);
  return Number.isNaN(tentativa.getTime()) ? null : tentativa;
}

/** Sim/Não, true/false, 1/0, x, vazio (= null, "não informado"). */
export function parseBooleanoCalendario(valor: unknown): boolean | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'boolean') return valor;
  const texto = chaveColuna(String(valor));
  if (!texto) return null;
  if (['sim', 's', 'true', 'verdadeiro', '1', 'x', 'yes', 'y'].includes(texto)) return true;
  if (['nao', 'n', 'false', 'falso', '0', 'no'].includes(texto)) return false;
  return null;
}

/** categoria/subcategoria → TipoEvento (mesma tabela do gerador em Python). */
const TIPO_POR_SUBCATEGORIA: Record<string, TipoEvento> = {
  feriado: 'FERIADO',
  recesso: 'RECESSO',
  feriasescolaresdocentes: 'RECESSO',
  matricularematricula: 'INSCRICAO',
  editalprocessoseletivo: 'PRAZO_EDITAL',
  resultadosregistrosacademicos: 'RESULTADO',
  vidaacademicaedoestudante: 'PRAZO_EDITAL',
  formacaopedagogica: 'FORMACAO',
  conselhodeclasse: 'CONSELHO_CLASSE',
  planejamentocoletivo: 'REUNIAO',
  reuniaocomresponsaveis: 'REUNIAO',
  entregadocente: 'PRAZO_EDITAL',
  calendarioletivo: 'LETIVO_INICIO_FIM',
  eventoacademicocientificocultural: 'EVENTO_ACADEMICO',
  mostraorientacaoacademica: 'EVENTO_ACADEMICO',
  eventodecursoegressos: 'EVENTO_PROJETO',
  eventodecurso: 'EVENTO_PROJETO',
  eventoesportivocompeticao: 'EVENTO_CAMPUS',
  datacomemorativainstitucional: 'EVENTO_CAMPUS',
};

const TIPO_POR_CATEGORIA: Record<string, TipoEvento> = {
  feriadorecessoférias: 'RECESSO',
  feriadorecessofferias: 'RECESSO',
  prazoeditalburocracia: 'PRAZO_EDITAL',
  gestaopedagogicadocente: 'REUNIAO',
  atividadeacademica: 'LETIVO_INICIO_FIM',
  datacomemorativainstitucional: 'EVENTO_CAMPUS',
  eventospecificodecurso: 'EVENTO_PROJETO',
};

export function mapearTipo(categoria?: string | null, subcategoria?: string | null): TipoEvento {
  const porSub = TIPO_POR_SUBCATEGORIA[chaveColuna(String(subcategoria ?? ''))];
  if (porSub) return porSub;
  return TIPO_POR_CATEGORIA[chaveColuna(String(categoria ?? ''))] ?? 'EVENTO_CAMPUS';
}

function tipoValido(valor: unknown): TipoEvento | null {
  const texto = chaveColuna(String(valor ?? ''));
  if (!texto) return null;
  return TIPOS_EVENTO.find((t) => chaveColuna(t) === texto) ?? null;
}

function textoOuNulo(valor: unknown): string | null {
  const texto = String(valor ?? '').trim();
  return texto ? texto : null;
}

// ── CSV ───────────────────────────────────────────────────────────────────────

/** Quebra uma linha de CSV respeitando aspas duplas. */
function quebrarLinha(linha: string, separador: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let entreAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const caractere = linha[i];
    if (entreAspas) {
      if (caractere === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          entreAspas = false;
        }
      } else {
        atual += caractere;
      }
      continue;
    }
    if (caractere === '"') {
      entreAspas = true;
      continue;
    }
    if (caractere === separador) {
      campos.push(atual);
      atual = '';
      continue;
    }
    atual += caractere;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/** Detecta o separador pela linha de cabeçalho (o que separa mais colunas ganha). */
function detectarSeparador(cabecalho: string): string {
  const candidatos = [';', ',', '\t', '|'];
  let melhor = ';';
  let maior = 0;
  for (const candidato of candidatos) {
    const colunas = quebrarLinha(cabecalho, candidato).length;
    if (colunas > maior) {
      maior = colunas;
      melhor = candidato;
    }
  }
  return melhor;
}

// ── análise do arquivo ────────────────────────────────────────────────────────

function normalizarLinha(
  bruto: Record<string, unknown>,
  indice: number,
  usarCabecalho: boolean,
): { linha?: LinhaCalendario; erro?: ErroImportacao; aviso?: string } {
  const numeroLinha = indice + (usarCabecalho ? 2 : 1);

  const titulo = String(bruto.titulo ?? '').trim();
  if (!titulo) {
    return { erro: { linha: numeroLinha, motivo: 'Sem título' } };
  }

  const data = parseDataCalendario(bruto.data);
  if (!data) {
    return { erro: { linha: numeroLinha, motivo: `Data inválida ou vazia ("${String(bruto.data ?? '')}")` } };
  }

  const dataFim = parseDataCalendario(bruto.dataFim);
  if (dataFim && dataFim < data) {
    return { erro: { linha: numeroLinha, motivo: 'A data final é anterior à data de início' } };
  }

  const categoria = textoOuNulo(bruto.categoria);
  const subcategoria = textoOuNulo(bruto.subcategoria);
  const tipo = tipoValido(bruto.tipo) ?? mapearTipo(categoria, subcategoria);

  const ref = textoOuNulo(bruto.ref) ?? `auto-${chaveColuna(titulo).slice(0, 40)}-${data.toISOString().slice(0, 10)}`;

  return {
    linha: {
      ref,
      titulo,
      descricao: textoOuNulo(bruto.descricao),
      data,
      dataFim: dataFim && dataFim.getTime() !== data.getTime() ? dataFim : null,
      tipo,
      categoria,
      subcategoria,
      publicoAlvo: textoOuNulo(bruto.publico ?? bruto.publicoAlvo),
      nivel: textoOuNulo(bruto.nivel),
      natureza: textoOuNulo(bruto.natureza),
      interessaAlunos: parseBooleanoCalendario(bruto.interessaAlunos),
      interessaProfessores: parseBooleanoCalendario(bruto.interessaProfessores),
      local: textoOuNulo(bruto.local),
    },
  };
}

export function analisarArquivo(conteudo: string): ResultadoAnalise {
  const texto = conteudo.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const linhasUteis = texto.split('\n').filter((l) => l.trim() && !l.trimStart().startsWith('#'));
  const erros: ErroImportacao[] = [];
  const avisos: string[] = [];
  const linhas: LinhaCalendario[] = [];
  const vistos = new Set<string>();

  const pareceJson = texto.trimStart().startsWith('[') || texto.trimStart().startsWith('{');
  let formato: 'csv' | 'json' = 'csv';
  let separador: string | null = null;
  let totalLinhas = 0;

  const registrar = (bruto: Record<string, unknown>, indice: number, usarCabecalho: boolean) => {
    totalLinhas++;
    const normalizada = normalizarLinha(bruto, indice, usarCabecalho);
    if (normalizada.erro) {
      erros.push(normalizada.erro);
      return;
    }
    const linha = normalizada.linha!;
    if (vistos.has(linha.ref)) {
      erros.push({ linha: indice + (usarCabecalho ? 2 : 1), motivo: `ref repetida no arquivo: "${linha.ref}"` });
      return;
    }
    vistos.add(linha.ref);
    linhas.push(linha);
  };

  if (pareceJson) {
    formato = 'json';
    let dados: unknown;
    try {
      dados = JSON.parse(texto);
    } catch (e) {
      return {
        formato, separador: null, totalLinhas: 0, linhas: [], erros: [{ linha: 0, motivo: `JSON inválido: ${(e as Error).message}` }],
        avisos: [], resumo: { porTipo: {}, porCategoria: {}, porMes: {}, primeiraData: null, ultimaData: null },
      };
    }
    const lista = Array.isArray(dados) ? dados : (dados as { eventos?: unknown[] })?.eventos;
    if (!Array.isArray(lista)) {
      return {
        formato, separador: null, totalLinhas: 0, linhas: [], erros: [{ linha: 0, motivo: 'O JSON precisa ser uma lista de eventos (ou um objeto com a chave "eventos")' }],
        avisos: [], resumo: { porTipo: {}, porCategoria: {}, porMes: {}, primeiraData: null, ultimaData: null },
      };
    }
    lista.forEach((item, i) => {
      const bruto: Record<string, unknown> = {};
      Object.entries(item as Record<string, unknown>).forEach(([chave, valor]) => {
        bruto[normalizarCabecalho(chave) ?? chave] = valor;
      });
      registrar(bruto, i, false);
    });
  } else {
    if (linhasUteis.length === 0) {
      return {
        formato, separador: null, totalLinhas: 0, linhas: [], erros: [{ linha: 0, motivo: 'Arquivo vazio' }],
        avisos: [], resumo: { porTipo: {}, porCategoria: {}, porMes: {}, primeiraData: null, ultimaData: null },
      };
    }
    separador = detectarSeparador(linhasUteis[0]);
    const cabecalhoBruto = quebrarLinha(linhasUteis[0], separador);
    const mapaColunas = cabecalhoBruto.map(normalizarCabecalho);

    const desconhecidas = cabecalhoBruto.filter((_, i) => !mapaColunas[i]);
    if (desconhecidas.length) {
      avisos.push(`Colunas ignoradas (não reconhecidas): ${desconhecidas.join(', ')}`);
    }
    if (!mapaColunas.includes('titulo') || !mapaColunas.includes('data')) {
      erros.push({
        linha: 1,
        motivo: 'O cabeçalho precisa ter pelo menos as colunas "titulo" e "data". Baixe o modelo para ver o formato.',
      });
    }

    linhasUteis.slice(1).forEach((linha, i) => {
      const campos = quebrarLinha(linha, separador!);
      const bruto: Record<string, unknown> = {};
      campos.forEach((valor, coluna) => {
        const chave = mapaColunas[coluna];
        if (chave) bruto[chave] = valor;
      });
      registrar(bruto, i, true);
    });
  }

  const porTipo: Record<string, number> = {};
  const porCategoria: Record<string, number> = {};
  const porMes: Record<string, number> = {};
  let primeira: Date | null = null;
  let ultima: Date | null = null;

  for (const linha of linhas) {
    porTipo[linha.tipo] = (porTipo[linha.tipo] ?? 0) + 1;
    const categoria = linha.categoria ?? '(sem categoria)';
    porCategoria[categoria] = (porCategoria[categoria] ?? 0) + 1;
    const mes = linha.data.toISOString().slice(0, 7);
    porMes[mes] = (porMes[mes] ?? 0) + 1;
    if (!primeira || linha.data < primeira) primeira = linha.data;
    if (!ultima || linha.data > ultima) ultima = linha.data;
  }

  if (linhas.length > 0 && linhas.length < totalLinhas) {
    avisos.push(`${totalLinhas - linhas.length} linha(s) com problema foram ignoradas — veja a lista abaixo.`);
  }
  if (totalLinhas > 2000) {
    avisos.push('Arquivo grande: a importação é feita em lotes; pode levar alguns segundos.');
  }

  return {
    formato,
    separador,
    totalLinhas,
    linhas,
    erros,
    avisos,
    resumo: {
      porTipo,
      porCategoria,
      porMes,
      primeiraData: primeira ? primeira.toISOString().slice(0, 10) : null,
      ultimaData: ultima ? ultima.toISOString().slice(0, 10) : null,
    },
  };
}

const COLUNAS_CSV = [
  'ref', 'tipo', 'titulo', 'descricao', 'data', 'dataFim', 'categoria',
  'subcategoria', 'publico', 'nivel', 'natureza', 'interessaAlunos',
  'interessaProfessores', 'local',
];

function celulaCSV(valor: string): string {
  return /[;"\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Modelo para download na tela de importação (cabeçalho + 2 exemplos). */
export function gerarModeloCSV(): string {
  const linhas = [
    COLUNAS_CSV.join(';'),
    [
      'exemplo-1', 'PRAZO_EDITAL', 'Encerramento das inscrições do Edital 01/2026',
      'Último dia para enviar a documentação pelo portal.', '30/10/2026', '',
      'Prazo / edital / burocracia', 'Edital / processo seletivo', 'Alunos', 'Geral / Campus',
      'Prazo', 'Sim', 'Não', 'Portal Conecta',
    ].map(celulaCSV).join(';'),
    [
      'exemplo-2', 'EVENTO_CAMPUS', 'Semana da Ciência e Tecnologia', '', '10/11/2026',
      '13/11/2026', 'Evento específico de curso', 'Evento acadêmico / científico / cultural',
      'Comunidade acadêmica', 'Geral / Campus', 'Informativo', 'Sim', 'Sim', 'Campus Ivaiporã',
    ].map(celulaCSV).join(';'),
  ];
  return linhas.join('\n') + '\n';
}
