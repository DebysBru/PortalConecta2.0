/**
 * Peso das mídias de um POST — o orçamento é do post inteiro, não de cada
 * arquivo.
 *
 * Regra pedida pela coordenação (2026-10-05): "o limite é por post, não por
 * imagem — cada post pode pesar no máximo 20 MB, seja com imagens ou arquivos
 * anexados (PDF, ZIP, RAR)". Um post com 4 imagens de 4 MB cada, por exemplo,
 * NÃO cabe: a soma é que manda.
 *
 * Este arquivo é PURO (sem Prisma, sem fs) de propósito: a MESMA conta roda no
 * navegador (indicador "X MB de 20 MB" enquanto o professor monta o post) e no
 * servidor (que rejeita o que passar). Se cada lado tivesse a sua fórmula, o
 * professor veria "cabe" e levaria um erro ao salvar — ou pior, o servidor
 * aceitaria um post acima do combinado.
 *
 * O servidor NUNCA confia nos bytes que o cliente informa: ele recebe o
 * `tamanhoPorCaminho` lido do disco (ver `pesoDasMidiasDoPost` em
 * file-storage.ts) e recalcula. Os bytes vindos da UI servem só para o
 * indicador em tempo real.
 */

/** Teto de peso de um post inteiro: imagens no texto + arquivos anexados. */
export const LIMITE_POST_BYTES = 20 * 1024 * 1024;

/** Prefixo público dos arquivos servidos pelo nginx. */
export const PREFIXO_PUBLICO_PADRAO = '/files';

/** Um arquivo já gravado no storage, como fica guardado em `Post.anexos`. */
export type MidiaDoPost = {
  /** Caminho relativo dentro de STORAGE_ROOT (ex.: "outros/2026/10/<uuid>.zip"). */
  path: string;
  /** URL pública servida pelo nginx (ex.: "/files/outros/2026/10/<uuid>.zip"). */
  url: string;
  /** Nome original, só para exibir na lista. */
  nome: string | null;
  bytes: number;
  mime?: string | null;
};

/**
 * O que o cliente manda sobre um anexo. Nada aqui é confiável: o servidor
 * normaliza o caminho, reconstrói a URL e lê o tamanho do disco — `bytes` só
 * alimenta o indicador de peso da tela.
 */
export type AnexoRecebido = {
  url?: string | null;
  path?: string | null;
  nome?: string | null;
  bytes?: number | null;
  mime?: string | null;
};

export function formatarMb(bytes: number, casas = 1): string {
  return `${(bytes / 1024 / 1024).toFixed(casas)} MB`;
}

function normalizarPrefixo(prefixo?: string): string {
  return (prefixo ?? PREFIXO_PUBLICO_PADRAO).replace(/\/+$/, '');
}

/** URL pública a partir do caminho guardado (o caminho é a fonte da verdade). */
export function urlPublicaDoCaminho(path: string, prefixo?: string): string {
  const limpo = path.split('/').filter(Boolean).join('/');
  return `${normalizarPrefixo(prefixo)}/${limpo}`;
}

/**
 * Caminho interno a partir de uma URL pública.
 * Devolve `null` para o que NÃO é arquivo nosso (imagem externa, link de outro
 * site) ou para caminho suspeito (`..`, absoluto, com query).
 */
export function caminhoInternoDaUrl(
  url: string | null | undefined,
  prefixo?: string,
): string | null {
  if (!url) return null;

  const pre = normalizarPrefixo(prefixo);
  const semQuery = url.split(/[?#]/)[0];

  if (!semQuery.startsWith(`${pre}/`)) return null;

  let caminho = semQuery.slice(pre.length + 1);
  try {
    caminho = decodeURIComponent(caminho);
  } catch {
    return null; // % inválido
  }

  const partes = caminho.split('/').filter(Boolean);
  if (partes.length === 0) return null;
  if (partes.some((p) => p === '..' || p === '.')) return null;
  if (caminho.startsWith('/') || /^[a-zA-Z]:/.test(caminho)) return null;

  return partes.join('/');
}

/**
 * Caminhos das imagens que estão NO TEXTO do post.
 *
 * Só entram as que apontam para o nosso storage: imagem hospedada fora (um link
 * do Google Fotos, por exemplo) não pesa no nosso disco e não pode consumir o
 * orçamento do post.
 */
export function caminhosDeImagemNoHtml(html: string | null | undefined, prefixo?: string): string[] {
  if (!html) return [];

  const caminhos: string[] = [];
  const regexImg = /<\s*img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi;

  let match: RegExpExecArray | null;
  while ((match = regexImg.exec(html)) !== null) {
    const caminho = caminhoInternoDaUrl(match[1] ?? match[2] ?? match[3], prefixo);
    // `indexOf` em vez de `includes` para funcionar mesmo sem lib ES2016+.
    if (caminho && caminhos.indexOf(caminho) === -1) caminhos.push(caminho);
  }

  return caminhos;
}

export function somarBytes(midias: ReadonlyArray<{ bytes: number }>): number {
  return midias.reduce((total, m) => total + (Number.isFinite(m.bytes) ? m.bytes : 0), 0);
}

/**
 * Lê `Post.anexos` (campo JSON do banco) com segurança de tipo.
 *
 * O Prisma devolve `JsonValue`; sem esta normalização cada tela repetiria
 * conversão e checagem — e uma delas esqueceria de checar, quebrando a página
 * pública com um JSON antigo/inesperado.
 */
export function anexosDoJson(valor: unknown): MidiaDoPost[] {
  if (!Array.isArray(valor)) return [];

  const anexos: MidiaDoPost[] = [];
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const bruto = item as Record<string, unknown>;
    const path = typeof bruto.path === 'string' ? bruto.path : null;
    if (!path) continue;

    anexos.push({
      path,
      url: typeof bruto.url === 'string' ? bruto.url : urlPublicaDoCaminho(path),
      nome: typeof bruto.nome === 'string' ? bruto.nome : null,
      bytes: typeof bruto.bytes === 'number' && Number.isFinite(bruto.bytes) ? bruto.bytes : 0,
      mime: typeof bruto.mime === 'string' ? bruto.mime : null,
    });
  }
  return anexos;
}

export type PesoDoPost = {  /** Soma de tudo que este post usa do storage. */
  totalBytes: number;
  /** Caminhos das imagens do texto (e os que não existem mais no disco). */
  imagens: string[];
  /** Caminhos dos anexos, já normalizados (o que não for nosso é descartado). */
  anexos: MidiaDoPost[];
  /** Arquivos referenciados que não foram encontrados no disco. */
  ausentes: string[];
};

/**
 * Conta o peso do post: imagens do texto + anexos.
 *
 * `tamanhoPorCaminho` devolve o tamanho REAL no disco (0 quando não existe).
 * Os `bytes` que vierem dentro de `anexos` são ignorados — quem manda é o disco.
 */
export function pesoDoPost(input: {
  html?: string | null;
  anexos?: ReadonlyArray<AnexoRecebido> | null;
  tamanhoPorCaminho: (caminho: string) => number;
  prefixo?: string;
}): PesoDoPost {
  const { html, anexos, tamanhoPorCaminho, prefixo } = input;

  const imagens = caminhosDeImagemNoHtml(html, prefixo);
  const ausentes: string[] = [];

  const bytesDasImagens = imagens.reduce((total, caminho) => {
    const bytes = tamanhoPorCaminho(caminho);
    if (bytes <= 0) ausentes.push(caminho);
    return total + bytes;
  }, 0);

  const anexosNormalizados: MidiaDoPost[] = [];
  let bytesDosAnexos = 0;

  for (const anexo of anexos ?? []) {
    const caminho =
      caminhoInternoDaUrl(anexo?.url ?? null, prefixo) ??
      (anexo?.path ? caminhoInternoDaUrl(urlPublicaDoCaminho(anexo.path, prefixo), prefixo) : null);

    if (!caminho) continue;
    if (anexosNormalizados.some((a) => a.path === caminho)) continue; // sem contar duas vezes

    const bytes = tamanhoPorCaminho(caminho);
    if (bytes <= 0) ausentes.push(caminho);

    bytesDosAnexos += bytes;
    anexosNormalizados.push({
      path: caminho,
      url: urlPublicaDoCaminho(caminho, prefixo),
      nome: anexo?.nome ?? null,
      bytes,
      mime: anexo?.mime ?? null,
    });
  }

  return {
    totalBytes: bytesDasImagens + bytesDosAnexos,
    imagens,
    anexos: anexosNormalizados,
    ausentes,
  };
}

export function resumoDoPeso(totalBytes: number, limite = LIMITE_POST_BYTES) {
  const excedido = totalBytes > limite;
  return {
    usadoBytes: totalBytes,
    limiteBytes: limite,
    restanteBytes: Math.max(limite - totalBytes, 0),
    excedido,
    // Nunca acima de 100%: a barra de progresso não deve estourar o layout
    // quando o post já passou do limite.
    percentual: limite > 0 ? Math.min(Math.round((totalBytes / limite) * 100), 100) : 0,
  };
}

/** Mensagem única do bloqueio — usada pelo servidor e pelo indicador da tela. */
export function mensagemPesoExcedido(totalBytes: number, limite = LIMITE_POST_BYTES): string {
  const excedente = formatarMb(totalBytes - limite);
  return (
    `Este post está com ${formatarMb(totalBytes)} e o limite é ${formatarMb(limite, 0)} por post ` +
    `(somando imagens e arquivos anexados). Remova cerca de ${excedente} — ou publique o restante em outro post.`
  );
}
