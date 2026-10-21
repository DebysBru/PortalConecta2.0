/**
 * POST /api/auth/verify-captcha
 *
 * O cadastro (/cadastro) cria a conta direto no Firebase, client-side — não
 * existe uma Server Action nesse fluxo pra verificar o CAPTCHA server-side
 * "de graça". Essa rota faz essa checagem antes do cliente chamar o Firebase.
 *
 * Body: { token: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { verificarTurnstile } from '@/lib/turnstile';
import { obterIpCliente } from '@/lib/rate-limit';
import { MENSAGENS } from '@/lib/mensagens';

export async function POST(req: NextRequest) {
  // Sem o try/catch, um corpo malformado devolvia a página de erro HTML do
  // Next — a tela de cadastro não conseguia ler a mensagem para o usuário.
  let token: string | undefined;
  try {
    ({ token } = await req.json() as { token?: string });
  } catch {
    return NextResponse.json({ error: MENSAGENS.verificacaoSegurancaFalhou }, { status: 400 });
  }

  const ip = obterIpCliente();
  const ok = await verificarTurnstile(token, ip);

  if (!ok) {
    return NextResponse.json({ error: MENSAGENS.verificacaoSegurancaFalhou }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
