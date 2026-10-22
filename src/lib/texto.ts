/**
 * Texto simples para cards/listas.
 *
 * As descrições de projetos importadas do SUAP chegam como HTML
 * (`<p style="...">`, `<span>`) e, em alguns casos, com entidades
 * (`&ccedil;`, `&lt;p&gt;`). Interpolar isso direto no JSX fazia o card mostrar
 * a marcação literal — foi o caso do card da home que aparecia com
 * `<p style="line-height:1.2"...>`.
 *
 * Este módulo é puro (não importa Prisma nem `xss`) para poder ser usado tanto
 * em Server Components quanto em componentes client.
 */

const ENTIDADES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ccedil: 'ç',
  Ccedil: 'Ç',
  otilde: 'õ',
  Otilde: 'Õ',
  atilde: 'ã',
  Atilde: 'Ã',
  aacute: 'á',
  Aacute: 'Á',
  eacute: 'é',
  Eacute: 'É',
  iacute: 'í',
  Iacute: 'Í',
  oacute: 'ó',
  Oacute: 'Ó',
  uacute: 'ú',
  Uacute: 'Ú',
  agrave: 'à',
  Agrave: 'À',
  ecirc: 'ê',
  Ecirc: 'Ê',
  ocirc: 'ô',
  Ocirc: 'Ô',
  ucirc: 'û',
  Ucirc: 'Û',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  laquo: '«',
  raquo: '»',
  deg: '°',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  cent: '¢',
  sect: '§',
  para: '¶',
};

export function decodificarEntidadesHtml(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const codigo = Number.parseInt(hex, 16);
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : '';
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const codigo = Number.parseInt(dec, 10);
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : '';
    })
    .replace(/&([a-z][a-z0-9]+);/gi, (original, nome: string) => ENTIDADES[nome] ?? ENTIDADES[nome.toLowerCase()] ?? original);
}

/**
 * Remove marcação e entidades, preservando apenas o texto legível.
 * A saída é sempre texto puro; o React continua escapando qualquer `<` restante.
 */
export function textoSimples(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim()) return '';

  const semScripts = valor
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

  // Decodifica primeiro: assim `&lt;p&gt;` vira tag e também é removido.
  const decodificado = decodificarEntidadesHtml(semScripts);
  const semTags = decodificado.replace(/<[^>]*>/g, ' ');

  return decodificarEntidadesHtml(semTags).replace(/\s+/g, ' ').trim();
}
