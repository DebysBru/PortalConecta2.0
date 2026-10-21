import type { MetadataRoute } from 'next';

/**
 * Manifesto do PWA (Fase 1 — instalável, sem service worker).
 *
 * O Next.js gera este arquivo em `/manifest.webmanifest` e injeta o
 * `<link rel="manifest">` no <head>.
 *
 * DECISÃO DELIBERADA: não existe service worker neste projeto. Sem SW o app
 * continua instalável (o Chrome dispensou a exigência de `fetch()` handler para
 * instalação pelo menu nas versões 108 mobile / 112 desktop), mas o prompt
 * automático de instalação não aparece — a instalação fica no menu do navegador
 * (⋮ → "Instalar app") e, no iOS, em Compartilhar → "Adicionar à Tela de Início".
 * O motivo de não haver SW é o custo/risco do cache: o portal é SSR com Server
 * Actions e tem áreas autenticadas (`/admin`, `/minha-area`, `/professor`), e
 * cachear HTML em máquina compartilhada de laboratório vazaria dados de um aluno
 * para o seguinte. Offline também não é caso de uso (IFizinha, uploads,
 * inscrições e sync SUAP exigem rede de qualquer forma).
 *
 * Se um dia entrar push notification, o SW deve tratar SÓ `push` e
 * `notificationclick`, sem handler de `fetch` — assim não há cache nenhum.
 *
 * Cores conforme tailwind.config.ts: azul-eletrico #2F52D3 (primary) e o
 * gradiente hero #2F52D3 → #7B24C7 → #E83D89 usado na marca.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Portal Conecta | IFPR Campus Ivaiporã',
    short_name: 'Portal Conecta',
    description:
      'Editais, projetos e agenda do IFPR Campus Ivaiporã — com os editais traduzidos pela IFizinha.',
    lang: 'pt-BR',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2F52D3',
    categories: ['education'],
    icons: [
      // "any" — quadrado arredondado, o mesmo desenho do ícone na tela inicial
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // "maskable" — sangrado, glifo dentro da zona segura de 80% para os
      // recortes circulares/squircle dos launchers Android
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Atalhos de toque longo no ícone. Só rotas públicas (ver PUBLIC_ROUTES em
    // middleware.ts) — atalho para área logada não faz sentido sem sessão.
    shortcuts: [
      { name: 'Editais', short_name: 'Editais', url: '/editais' },
      { name: 'Projetos', short_name: 'Projetos', url: '/projetos' },
      { name: 'Agenda', short_name: 'Agenda', url: '/agenda' },
    ],
  };
}
