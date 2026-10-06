/**
 * Armazenamento de arquivos no próprio servidor (VPS).
 *
 * Layout em disco (raiz configurável por `STORAGE_ROOT`):
 *
 *   /var/www/portal-files/
 *     ├── pdf/2026/01/<uuid>.pdf
 *     ├── imagens/2026/01/<uuid>.webp
 *     └── outros/2026/01/<uuid>.zip
 *
 * O nginx serve essa mesma pasta em `https://<host>/files/...` (ver
 * `deploy/nginx-portal.ifcoding.com.br.conf`, bloco `location /files/`),
 * então `publicUrl()` monta exatamente essa URL.
 *
 * LIMITES (revisados em 2026-10-05): o limite é do POST inteiro, não de cada
 * arquivo — ver `LIMITE_POST_BYTES` em src/lib/post-midias.ts. Por isso o teto
 * de CADA arquivo aqui é o mesmo do post: um arquivo sozinho não pode passar do
 * que o post inteiro pode pesar, e a soma (imagens do texto + anexos) é
 * conferida em `pesoDasMidiasDoPost`, no momento de salvar o post.
 *   - PDF, imagem, ZIP, RAR: até 20 MB cada
 *   - POST inteiro (soma):   até 20 MB
 * O `client_max_body_size` do nginx precisa ser maior que isso (ver o conf em
 * deploy/): era 12M e subiu para 25M.
 *
 * Detalhes de segurança implementados aqui (todos os arquivos vêm de upload
 * de usuário e são servidos publicamente — é o vetor de ataque mais óbvio):
 *   1. Nome do arquivo original NUNCA vai para o disco. O nome físico é um
 *      UUID + extensão derivada do tipo VALIDADO, então nada de
 *      `../../etc/passwd` nem de nome com bytes de controle.
 *   2. O tipo é decidido pelo **conteúdo** (magic bytes), não por
 *      `file.type` nem pela extensão — ambos são controlados pelo cliente.
 *   3. Extensão permitida só existe para pdf/png/jpeg/webp/gif/zip/rar. Nada de
 *      .svg, .html, .js ou .php, que o nginx interpretaria no domínio. ZIP e RAR
 *      são só bytes para o nginx (não executam), e são servidos como download.
 *   4. `STORAGE_ROOT` é resolvido com `path.resolve` e o caminho final é
 *      conferido para continuar DENTRO da raiz (defesa extra contra
 *      travessia de diretório).
 */
import { randomUUID } from 'crypto';
import { mkdir, writeFile, unlink, stat } from 'fs/promises';
import { join, resolve, extname, relative, isAbsolute, sep } from 'path';
import {
  LIMITE_POST_BYTES,
  pesoDoPost,
  urlPublicaDoCaminho,
  type AnexoRecebido,
  type MidiaDoPost,
} from '@/lib/post-midias';

/** Raiz de armazenamento. Em produção na VPS: /var/www/portal-files */
export const STORAGE_ROOT = resolve(
  process.env.STORAGE_ROOT || join(process.cwd(), 'storage', 'portal-files')
);

/** Prefixo público servido pelo nginx — muda a URL, não o disco. */
const PUBLIC_PREFIX = (process.env.STORAGE_PUBLIC_PREFIX || '/files').replace(/\/+$/, '');

/**
 * Teto de cada arquivo = teto do post inteiro.
 *
 * Não existe mais um limite menor "por imagem": o combinado com a coordenação é
 * que o limite é do POST (20 MB somando tudo), então um arquivo de 15 MB é
 * aceito desde que não haja mais nada no post. Quem garante a soma é
 * `pesoDasMidiasDoPost`.
 */
export const LIMITE_ARQUIVO_BYTES = LIMITE_POST_BYTES;

/** Mantidos com o nome antigo para não quebrar importadores (agora valem o teto do post). */
export const LIMITE_PDF_BYTES = LIMITE_ARQUIVO_BYTES;
export const LIMITE_IMAGEM_BYTES = LIMITE_ARQUIVO_BYTES;

export type CategoriaArquivo = 'pdf' | 'imagens' | 'outros';

interface TipoPermitido {
  categoria: CategoriaArquivo;
  extensao: string;
  mime: string;
  limite: number;
}

/**
 * Tabela de tipos aceitos, com o limite de tamanho por tipo.
 * A assinatura é a sequência de bytes no INÍCIO do arquivo (magic bytes) —
 * a checagem mais confiável que dá para fazer sem biblioteca externa.
 */
const TIPOS: Record<string, TipoPermitido> = {
  pdf: { categoria: 'pdf', extensao: '.pdf', mime: 'application/pdf', limite: LIMITE_ARQUIVO_BYTES },
  png: { categoria: 'imagens', extensao: '.png', mime: 'image/png', limite: LIMITE_ARQUIVO_BYTES },
  jpeg: { categoria: 'imagens', extensao: '.jpg', mime: 'image/jpeg', limite: LIMITE_ARQUIVO_BYTES },
  webp: { categoria: 'imagens', extensao: '.webp', mime: 'image/webp', limite: LIMITE_ARQUIVO_BYTES },
  gif: { categoria: 'imagens', extensao: '.gif', mime: 'image/gif', limite: LIMITE_ARQUIVO_BYTES },
  // Anexos comuns de material de projeto (lista de presença, planilhas, pacotes
  // de código). Ficam em "outros" e são servidos como download.
  zip: { categoria: 'outros', extensao: '.zip', mime: 'application/zip', limite: LIMITE_ARQUIVO_BYTES },
  rar: { categoria: 'outros', extensao: '.rar', mime: 'application/vnd.rar', limite: LIMITE_ARQUIVO_BYTES },
};

function comecaCom(buf: Buffer, assinatura: number[], offset = 0): boolean {
  if (buf.length < offset + assinatura.length) return false;
  return assinatura.every((b, i) => buf[offset + i] === b);
}

/**
 * Detecta o tipo real do arquivo pelos magic bytes.
 * Retorna `null` quando não é um dos tipos permitidos.
 */
export function detectarTipoPorConteudo(buffer: Buffer): TipoPermitido | null {
  // PDF: "%PDF-"
  if (comecaCom(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return TIPOS.pdf;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (comecaCom(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return TIPOS.png;

  // JPEG: FF D8 FF
  if (comecaCom(buffer, [0xff, 0xd8, 0xff])) return TIPOS.jpeg;

  // GIF: "GIF87a" ou "GIF89a"
  if (comecaCom(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) return TIPOS.gif;
  if (comecaCom(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return TIPOS.gif;

  // WEBP: "RIFF" .... "WEBP"  (WEBP fica no offset 8)
  if (
    comecaCom(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    comecaCom(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return TIPOS.webp;
  }

  // ZIP: "PK" + 03 04 (arquivo), 05 06 (zip vazio) ou 07 08 (multivolume)
  if (comecaCom(buffer, [0x50, 0x4b, 0x03, 0x04])) return TIPOS.zip;
  if (comecaCom(buffer, [0x50, 0x4b, 0x05, 0x06])) return TIPOS.zip;
  if (comecaCom(buffer, [0x50, 0x4b, 0x07, 0x08])) return TIPOS.zip;

  // RAR: "Rar!" 1A 07 00 (RAR4) ou "Rar!" 1A 07 01 00 (RAR5)
  if (comecaCom(buffer, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00])) return TIPOS.rar;
  if (comecaCom(buffer, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00])) return TIPOS.rar;

  return null;
}

export class ArquivoInvalidoError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ArquivoInvalidoError';
    this.status = status;
  }
}

export interface ArquivoSalvo {
  /** Caminho relativo dentro de STORAGE_ROOT (ex.: "pdf/2026/01/<uuid>.pdf"). */
  path: string;
  /** URL pública servida pelo nginx (ex.: "/files/pdf/2026/01/<uuid>.pdf"). */
  url: string;
  nomeOriginal: string;
  tamanhoBytes: number;
  mime: string;
}

function formatarMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

/**
 * Valida e grava um arquivo vindo de upload.
 *
 * Lança `ArquivoInvalidoError` (com `status` HTTP apropriado) quando:
 *  - o tipo real não é permitido → 415;
 *  - o tamanho passa do limite do tipo → 413;
 *  - o arquivo está vazio → 400.
 */
export async function salvarArquivo(
  buffer: Buffer,
  nomeOriginal: string,
  subpasta?: string
): Promise<ArquivoSalvo> {
  if (!buffer || buffer.length === 0) {
    throw new ArquivoInvalidoError('O arquivo está vazio. Verifique o documento no seu computador e envie novamente.', 400);
  }

  const tipo = detectarTipoPorConteudo(buffer);
  if (!tipo) {
    throw new ArquivoInvalidoError(
      `Este formato de arquivo não é aceito. Você pode enviar PDF, PNG, JPG, WEBP, GIF, ZIP ou RAR (até ${formatarMb(LIMITE_ARQUIVO_BYTES)} por arquivo).`,
      415
    );
  }

  if (buffer.length > tipo.limite) {
    const tamanho = `${(buffer.length / 1024 / 1024).toFixed(1)} MB`;
    throw new ArquivoInvalidoError(
      `Seu arquivo tem ${tamanho} e o limite para este formato é ${formatarMb(tipo.limite)}. ` +
        'Reduza o tamanho ou divida o documento em partes menores e envie novamente.',
      413
    );
  }

  // Ano/mês mantêm as pastas navegáveis e evitam diretório único gigante.
  const agora = new Date();
  const ano = String(agora.getUTCFullYear());
  const mes = String(agora.getUTCMonth() + 1).padStart(2, '0');

  // `subpasta` (ex.: id do projeto) é opcional e sempre saneada.
  const sub = (subpasta || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

  const partes = [tipo.categoria, ano, mes, ...(sub ? [sub] : [])];
  const dirRelativo = join(...partes);

  // Nome físico: UUID + extensão validada. O nome original jamais toca o disco.
  const nomeFisico = `${randomUUID()}${tipo.extensao}`;
  const caminhoRelativo = join(dirRelativo, nomeFisico);

  const caminhoAbsoluto = resolve(STORAGE_ROOT, caminhoRelativo);

  // Defesa em profundidade contra travessia de diretório: o caminho resolvido
  // DEVE continuar dentro da raiz. Com o UUID acima isso é garantido, mas a
  // checagem impede que uma mudança futura (ex.: usar o nome original) abra
  // a falha silenciosamente.
  const rel = relative(STORAGE_ROOT, caminhoAbsoluto);
  if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) {
    throw new ArquivoInvalidoError('Não foi possível definir onde salvar o arquivo. Tente novamente.', 400);
  }

  await mkdir(resolve(STORAGE_ROOT, dirRelativo), { recursive: true });
  await writeFile(caminhoAbsoluto, buffer, { mode: 0o644 });

  // URLs usam sempre "/" — são caminhos de URL, não de sistema de arquivos.
  const urlRelativa = caminhoRelativo.split(sep).join('/');

  return {
    path: urlRelativa,
    url: `${PUBLIC_PREFIX}/${urlRelativa}`,
    nomeOriginal: nomeOriginal.slice(0, 255),
    tamanhoBytes: buffer.length,
    mime: tipo.mime,
  };
}

/**
 * Remove um arquivo previamente salvo a partir do `path` relativo guardado no
 * banco. Nunca lança: se o arquivo já não existe, o objetivo (não haver
 * arquivo órfão) já está cumprido — apagar registro não pode falhar por causa
 * disso.
 */
export async function removerArquivo(pathRelativo: string | null | undefined): Promise<boolean> {
  if (!pathRelativo) return false;

  const caminhoAbsoluto = resolve(STORAGE_ROOT, pathRelativo);
  const rel = relative(STORAGE_ROOT, caminhoAbsoluto);
  if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) {
    return false;
  }

  try {
    await unlink(caminhoAbsoluto);
    return true;
  } catch {
    return false;
  }
}

/** Metadados de um arquivo já salvo (usado em telas de diagnóstico). */
export async function infoArquivo(pathRelativo: string): Promise<{ existe: boolean; bytes: number } | null> {
  const caminhoAbsoluto = resolve(STORAGE_ROOT, pathRelativo);
  const rel = relative(STORAGE_ROOT, caminhoAbsoluto);
  if (rel.startsWith('..') || isAbsolute(rel)) return null;

  try {
    const s = await stat(caminhoAbsoluto);
    return { existe: true, bytes: s.size };
  } catch {
    return { existe: false, bytes: 0 };
  }
}

/** `true` quando o armazenamento local está configurado para esta instância. */
export function storageConfigurado(): boolean {
  return !!STORAGE_ROOT;
}

/** Extensão aceita (apenas para mensagens de erro na UI). */
export const EXTENSOES_ACEITAS = Object.values(TIPOS).map((t) => t.extensao);

/** Extensões que a UI oferece no seletor de anexos de post (PDF, ZIP, RAR). */
export const ACEITOS_COMO_ANEXO = ['.pdf', '.zip', '.rar'] as const;

// ─── Leitura pública (rota /files/...) ────────────────────────────────────────

/**
 * MIME a partir da extensão de um arquivo PUBLICADO.
 *
 * Só as extensões que o próprio storage escreve são reconhecidas — é a mesma
 * lista do nginx em produção (`deploy/nginx-portal.ifcoding.com.br.conf`).
 */
export function mimeDoArquivoPublico(caminho: string): string {
  const ext = extname(caminho).toLowerCase();
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    case '.zip': return 'application/zip';
    case '.rar': return 'application/vnd.rar';
    default: return 'application/octet-stream';
  }
}

/**
 * `true` para o que deve ser BAIXADO e não aberto no navegador.
 *
 * Mesma regra do nginx: PDF, ZIP e RAR saem como `Content-Disposition:
 * attachment` (evita interpretar conteúdo de terceiro dentro do domínio).
 */
export function forcarDownloadDoArquivoPublico(caminho: string): boolean {
  const ext = extname(caminho).toLowerCase();
  return ext === '.pdf' || ext === '.zip' || ext === '.rar';
}

/** Extensões que o portal serve em `/files/...` (whitelist FECHADA). */
export const EXTENSOES_PUBLICAS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.zip', '.rar'] as const;

export function extensaoPublicaPermitida(caminho: string): boolean {
  return (EXTENSOES_PUBLICAS as readonly string[]).includes(extname(caminho).toLowerCase());
}

/**
 * Caminho absoluto de um arquivo publicado, validado contra a raiz do storage.
 *
 * Devolve `null` quando o caminho sai da raiz (`../`), é absoluto ou usa uma
 * extensão que o portal nunca grava — os mesmos cuidados do `salvarArquivo`,
 * agora do lado da LEITURA. A rota `/files/[...]` serve o que esta função
 * aprovar, e nada mais.
 */
export function caminhoAbsolutoPublico(caminhoRelativo: string | null | undefined): string | null {
  if (!caminhoRelativo) return null;

  let decodificado = caminhoRelativo;
  try {
    decodificado = decodeURIComponent(caminhoRelativo);
  } catch {
    return null; // % inválido
  }

  const partes = decodificado.split('/').filter(Boolean);
  if (partes.length === 0) return null;
  if (partes.some((p) => p === '..' || p === '.')) return null;

  const relativo = partes.join('/');
  if (!extensaoPublicaPermitida(relativo)) return null;

  const absoluto = resolve(STORAGE_ROOT, relativo);
  const rel = relative(STORAGE_ROOT, absoluto);
  if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) return null;

  return absoluto;
}

// ─── Peso das mídias de um post ───────────────────────────────────────────────

/**
 * Conta o peso REAL de um post (imagens do texto + anexos) lendo o tamanho de
 * cada arquivo no disco.
 *
 * Por que no SERVIDOR e a partir do disco: o cliente informa `bytes` de cada
 * anexo (útil só para o indicador em tempo real da tela) — confiar nesse número
 * para autorizar o salvamento deixaria qualquer um mandar um ZIP de 30 MB
 * dizendo que tem 1 KB. Aqui o caminho é validado contra a raiz do storage
 * (via `infoArquivo`), o tamanho vem do sistema de arquivos e a URL é
 * reconstruída a partir do caminho, nunca copiada do cliente.
 */
export async function pesoDasMidiasDoPost(input: {
  html?: string | null;
  anexos?: ReadonlyArray<AnexoRecebido> | null;
}): Promise<{
  totalBytes: number;
  imagens: string[];
  anexos: MidiaDoPost[];
  ausentes: string[];
}> {
  const cache = new Map<string, number>();

  const tamanhoPorCaminho = (caminho: string): number => cache.get(caminho) ?? 0;

  // 1ª passada: só para descobrir QUAIS caminhos o post usa (as imagens do texto
  // e os anexos normalizados). Os tamanhos saem 0 aqui de propósito — nada deste
  // resultado é aproveitado além das listas de caminhos.
  const previa = pesoDoPost({
    html: input.html,
    anexos: input.anexos,
    tamanhoPorCaminho,
    prefixo: PUBLIC_PREFIX,
  });
  const caminhos = [...new Set([...previa.imagens, ...previa.anexos.map((a) => a.path)])];

  // 2ª passada: com os tamanhos REAIS lidos do disco, a conta é definitiva.
  await Promise.all(
    caminhos.map(async (caminho) => {
      const info = await infoArquivo(caminho);
      cache.set(caminho, info?.bytes ?? 0);
    }),
  );

  return pesoDoPost({
    html: input.html,
    anexos: input.anexos,
    tamanhoPorCaminho,
    prefixo: PUBLIC_PREFIX,
  });
}

/** Normaliza um caminho do storage para a URL pública (usado ao gravar anexos). */
export function urlDoAnexo(path: string): string {
  return urlPublicaDoCaminho(path, PUBLIC_PREFIX);
}
