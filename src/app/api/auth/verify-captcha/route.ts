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

export async function POST(req: NextRequest) {
  const { token } = await req.json() as { token?: string };
  const ip = obterIpCliente();
  const ok = await verificarTurnstile(token, ip);

  if (!ok) {
    return NextResponse.json({ error: 'Verificação de segurança falhou. Tente novamente.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
