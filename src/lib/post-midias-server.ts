/**
 * Regra de mídia do post no SERVIDOR — usada por `actions/professor.ts` e
 * `actions/admin.ts`.
 *
 * Vive separada dos dois por um motivo prático: o painel do professor e o do
 * admin gravam o mesmo `Post`. Se cada action tivesse a sua cópia da regra, uma
 * delas ficaria para trás (foi o que quase aconteceu: o limite de 20 MB entrou
 * primeiro só no fluxo do professor) e o mesmo post passaria ou não dependendo
 * de qual tela o criou.
 *
 * Este módulo toca o DISCO (`file-storage`) — é server-only, nunca importar de
 * componente client.
 */
import { pesoDasMidiasDoPost, removerArquivo } from '@/lib/file-storage';
import {
  LIMITE_POST_BYTES,
  mensagemPesoExcedido,
  type MidiaDoPost,
} from '@/lib/post-midias';

/**
 * Tipo MIME a partir da extensão do caminho gravado.
 *
 * O MIME NUNCA é copiado do que o cliente mandou: a extensão é o que o storage
 * validou por magic bytes ao gravar o arquivo.
 */
export function mimeDoCaminhoDeAnexo(path: string): string | null {
  const minusculo = path.toLowerCase();
  if (minusculo.endsWith('.pdf')) return 'application/pdf';
  if (minusculo.endsWith('.zip')) return 'application/zip';
  if (minusculo.endsWith('.rar')) return 'application/vnd.rar';
  if (minusculo.endsWith('.png')) return 'image/png';
  if (minusculo.endsWith('.jpg') || minusculo.endsWith('.jpeg')) return 'image/jpeg';
  if (minusculo.endsWith('.webp')) return 'image/webp';
  if (minusculo.endsWith('.gif')) return 'image/gif';
  return null;
}

/**
 * Confere o orçamento do post (20 MB somando imagens do texto + anexos) e
 * devolve os anexos NORMALIZADOS.
 *
 * O tamanho de cada arquivo vem do disco, nunca do cliente; a URL é
 * reconstruída a partir do caminho. O cliente só decide QUAIS arquivos fazem
 * parte do post — e isso é validado contra a raiz do storage.
 */
export async function validarMidiasDoPost(
  conteudoSanitizado: string,
  anexosRecebidos: unknown,
): Promise<{ ok: true; anexos: MidiaDoPost[] } | { ok: false; error: string }> {
  const listaBruta = Array.isArray(anexosRecebidos) ? anexosRecebidos : [];

  // Só o que interessa é repassado: strings de url/path/nome. Sem `bytes` —
  // quem informa tamanho é o disco.
  const paraCalcular = listaBruta
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .slice(0, 50) // teto defensivo: um post não tem 500 anexos
    .map((a) => ({
      url: typeof a.url === 'string' ? a.url : null,
      path: typeof a.path === 'string' ? a.path : null,
      nome: typeof a.nome === 'string' ? a.nome.slice(0, 255) : null,
    }));

  const peso = await pesoDasMidiasDoPost({ html: conteudoSanitizado, anexos: paraCalcular });

  if (peso.totalBytes > LIMITE_POST_BYTES) {
    return { ok: false, error: mensagemPesoExcedido(peso.totalBytes) };
  }

  return {
    ok: true,
    anexos: peso.anexos.map((a) => ({ ...a, mime: mimeDoCaminhoDeAnexo(a.path) })),
  };
}

/**
 * Apaga do disco os anexos que saíram da lista.
 *
 * Best-effort de propósito: o post JÁ foi gravado, então falha de disco aqui não
 * pode virar erro na tela de quem salvou (o `removerArquivo` real nunca lança,
 * mas o `.catch` garante isso mesmo se ele mudar — um teste mostrou o buraco).
 */
export async function limparAnexosRemovidos(
  anteriores: unknown,
  mantidos: ReadonlyArray<Pick<MidiaDoPost, 'path'>>,
): Promise<void> {
  if (!Array.isArray(anteriores)) return;

  const caminhosMantidos = new Set(mantidos.map((a) => a.path));
  const paraRemover = anteriores
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map((a) => (typeof a.path === 'string' ? a.path : null))
    .filter((p): p is string => !!p && !caminhosMantidos.has(p));

  await Promise.all(
    paraRemover.map((path) =>
      removerArquivo(path).catch((err) => {
        console.warn('[posts] não conseguimos apagar o anexo removido:', path, err);
        return false;
      }),
    ),
  );
}
