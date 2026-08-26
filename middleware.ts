import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotas públicas (não precisam de autenticação)
const PUBLIC_ROUTES = [
  '/',
  '/admin/login',
  '/professor/login',
  '/editais',
  '/projetos',
  '/agenda',
  '/api/chat',
  '/api/events/ics',
  '/api/projetos/check-inscricao',
];

// Rotas que precisam de pelo menos auth (token Firebase no cookie)
const AUTH_REQUIRED = ['/admin', '/professor'];

// Rotas de API que precisam de auth
const API_AUTH_REQUIRED = ['/api/suap/sync', '/api/auth/delete-firebase-user'];

/**
 * A verificação de sessão de verdade (achado S9 do RELATORIO_TESTES.md)
 * NÃO acontece aqui — o middleware roda em Edge Runtime, que não suporta o
 * `firebase-admin` (precisa de APIs do Node). Ela acontece nos layouts
 * server-side `admin/(protected)/layout.tsx` e `professor/(protected)/layout.tsx`
 * (rodam em Node, via `src/lib/session.ts` — cookie httpOnly verificado com
 * `verifySessionCookie`). O route group `(protected)` isola esses layouts
 * da própria página de login, evitando um redirect-loop.
 *
 * Este middleware fica só com o que já fazia bem: headers de segurança e o
 * corte grosso de rotas públicas vs. que precisam de sessão.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir arquivos estáticos e next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Rotas públicas — sempre permitir
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  if (isPublicRoute) return NextResponse.next();

  // Verificar se é rota que precisa de auth
  const needsAuth =
    AUTH_REQUIRED.some((route) => pathname.startsWith(route)) ||
    API_AUTH_REQUIRED.some((route) => pathname.startsWith(route));

  if (!needsAuth) return NextResponse.next();

  const response = NextResponse.next();

  // Headers de segurança
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/professor/:path*',
    '/api/suap/:path*',
    '/api/auth/:path*',
  ],
};
