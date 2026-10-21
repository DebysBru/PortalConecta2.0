/**
 * Conversão dos editais extraídos do site do IFPR para os editais do portal.
 *
 * A extração (`src/lib/ifpr-editais.ts`) entrega título, link do PDF, tipo, área e
 * ano. Aqui isso vira registro do portal: categoria, status, público, setor,
 * resumo técnico e **resumo da IFizinha** — e o link para o documento original.
 *
 * REGRA DE HONESTIDADE (a mesma do prompt de extração por IA que já existe em
 * `src/app/api/admin/editais/extract-pdf/route.ts`): escrever **só** o que os
 * dados dizem. O site do IFPR não publica as datas de inscrição (elas estão dentro
 * do PDF), então nenhum resumo promete prazo, valor de bolsa ou requisito que a
 * gente não leu. O que não se sabe fica em branco, e o texto manda abrir o
 * original — é o que a própria IFizinha já diz na tela de editais: "sempre
 * confirme os detalhes no documento oficial, tá?".
 */

import type { AreaEdital, EditalExtraido, TipoDocumento } from '@/lib/ifpr-editais';

export type CategoriaPortal = 'BOLSAS' | 'AUXILIOS' | 'EXTENSAO' | 'PESQUISA' | 'ENSINO' | 'EVENTOS' | 'ESTAGIOS' | 'RESULTADOS';

export type StatusPortal =
  | 'EM_BREVE'
  | 'ABERTO'
  | 'EM_ANALISE'
  | 'RESULTADO_PARCIAL'
  | 'PRAZO_RECURSO'
  | 'RESULTADO_PUBLICADO'
  | 'ENCERRADO';

/** Nome legível de cada área, usado na tela e no texto da IFizinha. */
export const ROTULO_AREA: Record<AreaEdital, string> = {
  ASSISTENCIA_ESTUDANTIL: 'Assistência estudantil',
  BOLSAS: 'Bolsas e programas',
  SERVIDORES: 'Servidores',
  FIC: 'Cursos FIC',
  ENSINO_SUPERIOR: 'Ensino superior',
  TECNICO: 'Cursos técnicos',
  POS_GRADUACAO: 'Pós-graduação',
  CELIF: 'Centro de Línguas (CELIF)',
  PESQUISA: 'Pesquisa',
  EXTENSAO: 'Extensão',
  INSTITUCIONAL: 'Institucional',
  OUTRO: 'Geral',
};

const SETOR_POR_AREA: Record<AreaEdital, string> = {
  ASSISTENCIA_ESTUDANTIL: 'SEPAE',
  BOLSAS: 'COPEX',
  SERVIDORES: 'SEGEPE',
  FIC: 'Direção de Ensino',
  ENSINO_SUPERIOR: 'Direção de Ensino',
  TECNICO: 'Direção de Ensino',
  POS_GRADUACAO: 'Direção de Ensino',
  CELIF: 'CELIF',
  PESQUISA: 'COPEX',
  EXTENSAO: 'COPEX',
  INSTITUCIONAL: 'Direção Geral',
  OUTRO: 'Direção Geral',
};

const PUBLICO_POR_AREA: Record<AreaEdital, string> = {
  ASSISTENCIA_ESTUDANTIL: 'Estudantes',
  BOLSAS: 'Estudantes',
  SERVIDORES: 'Servidores',
  FIC: 'Comunidade',
  ENSINO_SUPERIOR: 'Estudantes',
  TECNICO: 'Estudantes',
  POS_GRADUACAO: 'Estudantes',
  CELIF: 'Comunidade',
  PESQUISA: 'Estudantes e servidores',
  EXTENSAO: 'Comunidade',
  INSTITUCIONAL: 'Comunidade acadêmica',
  OUTRO: 'Comunidade acadêmica',
};

export function mapearCategoria(item: EditalExtraido): CategoriaPortal {
  if (item.tipo === 'RESULTADO') return 'RESULTADOS';
  switch (item.area) {
    case 'BOLSAS':
      return 'BOLSAS';
    case 'ASSISTENCIA_ESTUDANTIL':
      return 'AUXILIOS';
    case 'PESQUISA':
      return 'PESQUISA';
    case 'EXTENSAO':
      return 'EXTENSAO';
    default:
      return 'ENSINO';
  }
}

/**
 * Status do edital.
 *
 * Sem as datas oficiais não dá para afirmar que um documento está aberto. O que dá
 * para dizer com segurança: resultado publicado é resultado; documento de ano
 * anterior está encerrado; documento do ano corrente pode estar valendo (e o texto
 * do resumo manda conferir no original). `anoAtual` entra por parâmetro para o
 * comportamento ser previsível e testável.
 */
export function mapearStatus(item: EditalExtraido, anoAtual: number): StatusPortal {
  if (item.tipo === 'RESULTADO') return 'RESULTADO_PUBLICADO';
  if (item.ano === null) return 'EM_BREVE';
  if (item.ano < anoAtual) return 'ENCERRADO';
  return 'ABERTO';
}

/** Número do edital a partir do título ("Edital nº 03/2026 ..." → "03/2026"). */
export function extrairNumero(titulo: string, ano: number | null): string | null {
  const comBarra = titulo.match(/n[º°o.]?\s*0*(\d{1,3})\s*\/\s*(20\d{2})/i);
  if (comBarra) return `${comBarra[1].padStart(2, '0')}/${comBarra[2]}`;
  const simples = titulo.match(/edital\s*(?:n[º°o.]?\s*)?0*(\d{1,3})\b/i);
  if (simples && ano) return `${simples[1].padStart(2, '0')}/${ano}`;
  if (simples) return simples[1].padStart(2, '0');
  return null;
}

/** Slug estável a partir do título (sem acento, curto, legível na URL). */
export function slugDoEdital(titulo: string, ano: number | null, url: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');

  // Sufixo curto e determinístico do documento: sem ele, títulos repetidos
  // ("Edital nº 03/2026") de anos/áreas diferentes colidiriam no slug único.
  const hash = Math.abs(
    [...url].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 7),
  ).toString(36).slice(0, 5);

  const partes = ['edital', base || 'documento'];
  if (ano) partes.push(String(ano));
  return `${partes.join('-')}-${hash}`;
}

const ROTULO_TIPO: Record<TipoDocumento, string> = {
  EDITAL: 'edital',
  RESULTADO: 'resultado',
  RETIFICACAO: 'retificação de edital',
  PRORROGACAO: 'prorrogação',
  PORTARIA: 'portaria',
  OUTRO: 'documento',
};

/** Frase de abertura conforme o tipo, sem prometer o que o documento não diz. */
function fraseTipo(item: EditalExtraido): string {
  switch (item.tipo) {
    case 'RESULTADO':
      return 'Este é um documento de resultado (lista, homologação ou classificação)';
    case 'RETIFICACAO':
      return 'Este é uma retificação de um edital do campus';
    case 'PRORROGACAO':
      return 'Este é um aviso de prorrogação de prazo de um edital do campus';
    case 'EDITAL':
      return 'Este é um edital aberto pelo campus';
    default:
      return 'Este é um documento oficial do campus';
  }
}

/**
 * Resumo da IFizinha, no tom do portal ("você", frases curtas, sem jargão).
 *
 * Só usa o que a extração sabe: tipo, área, ano, título e a página de origem. Por
 * isso ele **não** fala de valor de bolsa, requisito ou prazo — isso vive dentro do
 * PDF, e inventar aqui seria pior do que não dizer.
 */
export function gerarResumoIFizinha(item: EditalExtraido): string {
  const area = ROTULO_AREA[item.area] ?? 'Geral';
  const ano = item.ano ? ` em ${item.ano}` : '';
  const tipo = /\.pdf/i.test(item.url) ? 'PDF' : 'documento';

  const partes = [
    `${fraseTipo(item)} da área de ${area}${ano}.`,
    `Você abre o documento original (${tipo}) pelo botão de download e confere tudo: quem pode participar, o que é oferecido e até quando.`,
    'As datas e os detalhes ficam no arquivo oficial — o site do IFPR não publica essas informações fora dele, então vale ler com calma antes de contar com o prazo.',
  ];
  return partes.join(' ');
}

/** Título exibido: o do documento, completado com a área quando é genérico. */
export function tituloParaPortal(item: EditalExtraido): string {
  const titulo = item.titulo.trim().replace(/\s+/g, ' ');
  const area = ROTULO_AREA[item.area];
  // Títulos curtos e sem identificação ("Edital de Abertura") ganham o ano para
  // não parecerem iguais entre si na listagem.
  if (titulo.length < 30 && item.ano && !titulo.includes(String(item.ano))) {
    return `${titulo} — ${area} ${item.ano}`;
  }
  return titulo;
}

export interface EditalDoPortal {
  origemRef: string;
  titulo: string;
  slug: string;
  numero: string | null;
  ano: number | null;
  categoria: CategoriaPortal;
  status: StatusPortal;
  areaEdital: AreaEdital;
  setorResponsavel: string;
  publicoAlvo: string;
  resumo: string;
  resumoSimples: string;
  linkOficial: string;
  arquivoPdfUrl: string | null;
  fonteOficial: string;
  source: 'IMPORT';
  traducaoIFizinha: Record<string, string>;
}

export function mapearEditalParaPortal(item: EditalExtraido, opcoes: { anoAtual: number }): EditalDoPortal {
  const area = ROTULO_AREA[item.area] ?? 'Geral';
  const titulo = tituloParaPortal(item);
  const ehPdf = /\.pdf($|\?)/i.test(item.url);

  return {
    origemRef: item.url,
    titulo,
    slug: slugDoEdital(titulo, item.ano, item.url),
    numero: extrairNumero(item.titulo, item.ano),
    ano: item.ano,
    categoria: mapearCategoria(item),
    status: mapearStatus(item, opcoes.anoAtual),
    areaEdital: item.area,
    setorResponsavel: SETOR_POR_AREA[item.area] ?? 'Direção Geral',
    publicoAlvo: PUBLICO_POR_AREA[item.area] ?? 'Comunidade acadêmica',
    // Resumo técnico: descreve o documento e diz de onde ele veio (rastreável).
    resumo:
      `Documento do tipo ${ROTULO_TIPO[item.tipo]} da área de ${area}` +
      `${item.ano ? `, ano ${item.ano}` : ''}, publicado no site do IFPR – Campus Ivaiporã` +
      `${item.pagina.titulo ? ` (página "${item.pagina.titulo}")` : ''}.`,
    resumoSimples: gerarResumoIFizinha(item),
    linkOficial: item.url,
    arquivoPdfUrl: ehPdf ? item.url : null,
    fonteOficial: 'Site do IFPR – Campus Ivaiporã',
    source: 'IMPORT',
    traducaoIFizinha: {
      oquee: `${fraseTipo(item)} da área de ${area}${item.ano ? `, de ${item.ano}` : ''}. O arquivo original está no link oficial deste edital.`,
      quempode: PUBLICO_POR_AREA[item.area] ?? 'Comunidade acadêmica',
      beneficios: '', // não está no documento que a gente leu — não inventamos
      comoinscrever: 'As inscrições (ou a consulta ao resultado) acontecem pelo documento oficial: abra o arquivo no botão acima e siga as instruções de lá.',
      prazo: 'As datas não aparecem no site do IFPR — elas estão dentro do documento oficial. Confira antes de contar com o prazo.',
      observacoes:
        `Documento publicado originalmente em "${item.pagina.titulo}" ` +
        `(${item.pagina.url}) e importado automaticamente do site do IFPR. ` +
        'Em caso de divergência, vale sempre o documento oficial.',
    },
  };
}

// ─── Filtros da listagem ──────────────────────────────────────────────────────

export interface FiltrosEditais {
  busca?: string;
  categoria?: string;
  area?: string;
  ano?: string;
  status?: string;
  ordem?: 'recentes' | 'antigos' | 'titulo';
}

export interface EditalFiltravel {
  titulo: string;
  categoria: string;
  status: string;
  ano?: number | null;
  areaEdital?: string | null;
  resumoSimples?: string | null;
  resumo?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

/** Sem acento e minúsculo, para busca que funciona como o usuário digita. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filtra e ordena editais na listagem. Função pura e testada: a tela usa isto e o
 * comportamento fica igual ao que os testes garantem.
 */
export function filtrarEditais<T extends EditalFiltravel>(editais: T[], filtros: FiltrosEditais): T[] {
  const busca = filtros.busca ? normalizarBusca(filtros.busca) : '';
  const ano = filtros.ano && filtros.ano !== 'todos' ? Number(filtros.ano) : null;

  const filtrados = editais.filter((edital) => {
    if (filtros.categoria && filtros.categoria !== 'todas' && edital.categoria !== filtros.categoria) return false;
    if (filtros.area && filtros.area !== 'todas' && (edital.areaEdital ?? 'OUTRO') !== filtros.area) return false;
    if (filtros.status && filtros.status !== 'todos' && edital.status !== filtros.status) return false;
    if (ano !== null && edital.ano !== ano) return false;

    if (busca) {
      const alvo = normalizarBusca(
        `${edital.titulo} ${edital.resumoSimples ?? ''} ${edital.resumo ?? ''} ${edital.ano ?? ''}`,
      );
      // Todas as palavras precisam aparecer (busca por "bolsa 2026" funciona).
      if (!busca.split(/\s+/).every((palavra) => alvo.includes(palavra))) return false;
    }
    return true;
  });

  const dataDe = (e: T) => new Date(e.updatedAt ?? e.createdAt ?? 0).getTime();
  const ordenados = [...filtrados];
  switch (filtros.ordem) {
    case 'antigos':
      ordenados.sort((a, b) => (a.ano ?? 0) - (b.ano ?? 0) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
      break;
    case 'titulo':
      ordenados.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
      break;
    default:
      ordenados.sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0) || dataDe(b) - dataDe(a));
  }
  return ordenados;
}

/** Opções de filtro que existem de fato nos dados (não mostra filtro vazio). */
export function opcoesDeFiltro(editais: EditalFiltravel[]) {
  const anos = [...new Set(editais.map((e) => e.ano).filter((a): a is number => typeof a === 'number'))].sort((a, b) => b - a);
  const areas = [...new Set(editais.map((e) => e.areaEdital ?? 'OUTRO'))].sort();
  const categorias = [...new Set(editais.map((e) => e.categoria))].sort();
  const status = [...new Set(editais.map((e) => e.status))].sort();
  return { anos, areas, categorias, status };
}
