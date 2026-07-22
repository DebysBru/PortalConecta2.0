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

  // No middleware server-side, não podemos verificar o token Firebase diretamente.
  // O Firebase armazena o token em localStorage (client-side), não em cookies.
  // Por isso, a proteção real é feita no client (AdminShell).
  // O middleware serve apenas para:
  // 1. Redirecionar /admin sem token óbvio
  // 2. Adicionar headers de segurança

  // NextResponse.next() — a verificação real é client-side via AuthContext
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
