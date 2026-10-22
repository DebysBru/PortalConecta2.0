/**
 * POST /api/files/peso — quanto pesam, no disco, as mídias de um post.
 *
 * Existe para o professor ver o peso REAL enquanto edita um post que já tem
 * imagens publicadas (elas foram enviadas noutra sessão e o navegador não sabe
 * o tamanho). O cálculo do limite, no entanto, NÃO depende desta rota: ao salvar,
 * `createPost`/`updatePost` refazem a conta a partir do disco.
 *
 * Autorização: ID token do Firebase verificado no servidor + papel
 * ADMIN/PROFESSOR **ou** gestor de página (o gestor também edita posts e
 * precisa do indicador de peso). Sem isso, visitante usaria a rota para
 * descobrir o tamanho de arquivos do servidor.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken } from '@/lib/auth-helpers';
import { infoArquivo } from '@/lib/file-storage';
import { caminhoInternoDaUrl, LIMITE_POST_BYTES } from '@/lib/post-midias';
import { usuarioTemAlgumProjetoComoGestor } from '@/lib/permissions';
import { MENSAGENS } from '@/lib/mensagens';

/** Teto de URLs por requisição — a tela manda as mídias de UM post. */
const MAX_URLS = 200;

export async function POST(request: NextRequest) {
  let corpo: { idToken?: unknown; urls?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: MENSAGENS.dadosInvalidosGenerico }, { status: 400 });
  }

  const sessao = await verifySessionToken(typeof corpo.idToken === 'string' ? corpo.idToken : undefined);
  if (!sessao.ok) {
    return NextResponse.json({ error: sessao.error }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: sessao.email }, select: { role: true } });
  const ehProfessorOuAdmin = user?.role === 'ADMIN' || user?.role === 'PROFESSOR';
  const ehGestor = !ehProfessorOuAdmin && (await usuarioTemAlgumProjetoComoGestor(sessao.email));
  if (!ehProfessorOuAdmin && !ehGestor) {
    return NextResponse.json({ error: MENSAGENS.semPermissaoProfessor }, { status: 403 });
  }

  const urls = Array.isArray(corpo.urls)
    ? corpo.urls.filter((u): u is string => typeof u === 'string').slice(0, MAX_URLS)
    : [];

  // Caminho que não é do nosso storage (imagem externa, URL estranha) é
  // simplesmente ignorado: não pesa no disco do servidor.
  const itens: Array<{ url: string; bytes: number }> = [];
  for (const url of urls) {
    const caminho = caminhoInternoDaUrl(url);
    if (!caminho) continue;
    const info = await infoArquivo(caminho);
    itens.push({ url, bytes: info?.bytes ?? 0 });
  }

  return NextResponse.json({
    ok: true,
    totalBytes: itens.reduce((total, i) => total + i.bytes, 0),
    itens,
    limiteBytes: LIMITE_POST_BYTES,
  });
}
