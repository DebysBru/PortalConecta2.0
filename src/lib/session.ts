/**
 * Sessão verificável no servidor — fecha o achado S9 do RELATORIO_TESTES.md
 * ("middleware não verifica autenticação, proteção é só client-side").
 *
 * Firebase guarda o ID token no cliente (localStorage), então o servidor não
 * tem como saber quem está logado numa requisição normal. A solução padrão
 * do próprio Firebase para SSR é o *session cookie*: depois do login no
 * cliente, trocamos o ID token por um cookie httpOnly de longa duração
 * (`createSessionCookie`), que o servidor consegue verificar em Server
 * Components — inclusive em layouts, antes de renderizar qualquer coisa.
 *
 * Middleware do Next 14 roda em Edge Runtime, que não suporta o
 * `firebase-admin` (usa APIs do Node) — por isso a verificação acontece nos
 * layouts server-side (`admin/layout.tsx`, `professor/layout.tsx`), não no
 * `middleware.ts`.
 */
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';

export const SESSION_COOKIE_NAME = 'session';
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 dias

export async function getVerifiedServerSession(): Promise<{ uid: string; email: string } | null> {
  const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    // `checkRevoked: true` também nega o cookie se o usuário foi deletado ou
    // teve as sessões revogadas — não só se o JWT em si expirou.
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    if (!decoded.email) return null;
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}
