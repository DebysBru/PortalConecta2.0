/**
 * GET /files/<caminho> — serve os arquivos enviados para o storage local.
 *
 * POR QUE ESTA ROTA EXISTE: em produção quem serve essa pasta é o **nginx**
 * (`location /files/ { alias /var/www/portal-files/; }`), e ele continua sendo o
 * caminho preferido (mais rápido, não consome processo do Node). Mas fora do
 * nginx — `npm run dev` na máquina do professor, um ambiente novo, um deploy sem
 * o bloco do nginx — NADA servia `/files/...`: toda imagem enviada aparecia
 * quebrada ("imagem corrompida"), mesmo com o arquivo íntegro no disco. Foi
 * exatamente o que aconteceu com a imagem do post de teste.
 *
 * Em produção o nginx intercepta `/files/` ANTES do proxy, então esta rota só
 * entra em cena quando o bloco do nginx não existe. Ela aplica as MESMAS regras
 * de segurança do conf:
 *  - whitelist fechada de extensões (as que o storage escreve);
 *  - caminho validado contra a raiz (sem `../`, sem caminho absoluto);
 *  - `X-Content-Type-Options: nosniff`;
 *  - PDF/ZIP/RAR como download (`Content-Disposition: attachment`).
 *
 * Limitação conhecida: não trata `Range` (seek de vídeo/PDF grande). O nginx, que
 * é quem serve em produção, trata.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import {
  caminhoAbsolutoPublico,
  forcarDownloadDoArquivoPublico,
  mimeDoArquivoPublico,
} from '@/lib/file-storage';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { caminho: string[] } },
) {
  const relativo = (params.caminho ?? []).join('/');
  const absoluto = caminhoAbsolutoPublico(relativo);

  // 404 (e não 403) para caminho inválido: não vale confirmar o que existe fora
  // da pasta pública.
  if (!absoluto) {
    return new NextResponse('Arquivo não encontrado', { status: 404 });
  }

  let tamanho: number;
  try {
    const info = await stat(absoluto);
    if (!info.isFile()) return new NextResponse('Arquivo não encontrado', { status: 404 });
    tamanho = info.size;
  } catch {
    return new NextResponse('Arquivo não encontrado', { status: 404 });
  }

  const cabecalhos: Record<string, string> = {
    'Content-Type': mimeDoArquivoPublico(relativo),
    'Content-Length': String(tamanho),
    'X-Content-Type-Options': 'nosniff',
    // Mesma janela do nginx (`expires 7d`). O nome do arquivo é um UUID, então o
    // conteúdo nunca muda: cache longo não serve versão velha.
    'Cache-Control': 'public, max-age=604800',
  };

  if (forcarDownloadDoArquivoPublico(relativo)) {
    cabecalhos['Content-Disposition'] = 'attachment';
  }

  // Streaming em vez de carregar o arquivo inteiro na memória: anexos podem ter
  // até 20 MB e o servidor é modesto.
  const stream = Readable.toWeb(createReadStream(absoluto)) as ReadableStream<Uint8Array>;

  return new NextResponse(stream, { status: 200, headers: cabecalhos });
}
