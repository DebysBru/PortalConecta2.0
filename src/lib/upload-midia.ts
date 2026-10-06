/**
 * Envio de arquivos do painel (professor/admin) para o storage local da VPS.
 *
 * Fica fora dos componentes porque DOIS lugares precisam exatamente do mesmo
 * fluxo: o botão de imagem do editor de texto e o seletor de anexos do post.
 * Ambos mandam o ID token do Firebase (a rota `/api/files/upload` verifica a
 * assinatura e o papel no servidor) e recebem de volta o caminho no disco + a
 * URL pública.
 *
 * Os limites de tamanho NÃO são checados aqui: quem decide é o servidor, que lê
 * o tamanho real do arquivo no disco. O que vem daqui serve para o indicador de
 * peso da tela.
 */

export type ArquivoEnviado = {
  path: string;
  url: string;
  nome: string;
  bytes: number;
  mime: string;
};

export type ResultadoEnvio =
  | { ok: true; data: ArquivoEnviado }
  | { ok: false; error: string };

const MENSAGEM_FALHA = 'Não conseguimos enviar o arquivo agora. Confira sua conexão e tente novamente.';

export async function enviarArquivo(input: {
  arquivo: File;
  idToken: string;
  /** Agrupa os arquivos na pasta do projeto/entidade (saneado no servidor). */
  subpasta?: string;
}): Promise<ResultadoEnvio> {
  try {
    const fd = new FormData();
    fd.append('idToken', input.idToken);
    fd.append('file', input.arquivo);
    if (input.subpasta) fd.append('subpasta', input.subpasta);

    const resposta = await fetch('/api/files/upload', { method: 'POST', body: fd });

    let json: {
      ok?: boolean;
      error?: string;
      data?: { path?: string; url?: string; nomeOriginal?: string; tamanhoBytes?: number; mime?: string };
    } = {};
    try {
      json = await resposta.json();
    } catch {
      // resposta sem JSON (proxy, 413 do nginx, etc.) — cai na mensagem padrão
    }

    if (!resposta.ok || !json.ok || !json.data?.url || !json.data?.path) {
      return { ok: false, error: json.error || MENSAGEM_FALHA };
    }

    return {
      ok: true,
      data: {
        path: json.data.path,
        url: json.data.url,
        nome: json.data.nomeOriginal ?? input.arquivo.name,
        bytes: json.data.tamanhoBytes ?? input.arquivo.size,
        mime: json.data.mime ?? input.arquivo.type,
      },
    };
  } catch {
    return { ok: false, error: MENSAGEM_FALHA };
  }
}

/**
 * Pergunta ao servidor o tamanho REAL (em disco) de cada arquivo já publicado.
 *
 * Necessário porque o professor pode estar editando um post antigo: as imagens
 * que já estão no texto foram enviadas noutra sessão e o navegador não sabe
 * quanto pesam. Sem isso o indicador mostraria só o que foi enviado agora e o
 * limite de 20 MB pareceria "estourar do nada" ao salvar.
 */
export async function consultarPesoDeUrls(input: {
  idToken: string;
  urls: string[];
}): Promise<{ ok: true; totalBytes: number; porUrl: Record<string, number> } | { ok: false; error: string }> {
  if (input.urls.length === 0) return { ok: true, totalBytes: 0, porUrl: {} };

  try {
    const resposta = await fetch('/api/files/peso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: input.idToken, urls: input.urls }),
    });

    const json = await resposta.json() as {
      ok?: boolean;
      error?: string;
      totalBytes?: number;
      itens?: Array<{ url: string; bytes: number }>;
    };

    if (!resposta.ok || !json.ok) {
      return { ok: false, error: json.error || 'Não conseguimos calcular o peso das mídias deste post.' };
    }

    const porUrl: Record<string, number> = {};
    for (const item of json.itens ?? []) porUrl[item.url] = item.bytes;

    return { ok: true, totalBytes: json.totalBytes ?? 0, porUrl };
  } catch {
    return { ok: false, error: 'Não conseguimos calcular o peso das mídias deste post.' };
  }
}
