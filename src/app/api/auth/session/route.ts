/**
 * POST /api/auth/session — troca um ID token do Firebase (curta duração,
 * guardado só no cliente) por um session cookie httpOnly de longa duração,
 * que o servidor consegue verificar (ver src/lib/session.ts).
 *
 * DELETE /api/auth/session — limpa o cookie no logout.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json() as { idToken?: string };
    if (!idToken) {
      return NextResponse.json({ error: 'Token ausente.' }, { status: 400 });
    }

    // Confirma que o token é válido antes de emitir o cookie de sessão.
    await getAdminAuth().verifyIdToken(idToken);

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: SESSION_MAX_AGE_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return response;
  } catch (err) {
    console.warn('[api/auth/session] Falha ao criar cookie de sessão:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Não foi possível criar a sessão.' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
