import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { PublicWrapper } from '@/components/layout/PublicWrapper';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { SCRIPT_RECUPERACAO_BUILD } from '@/lib/recuperacao-build';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

/**
 * `themeColor` saiu de `metadata` no Next 14 — precisa ficar no export
 * `viewport`, senão o build avisa que a chave foi movida.
 *
 * azul-eletrico (#2F52D3) é a cor primária da marca (tailwind.config.ts) e é a
 * que pinta a barra de status do Android quando o portal roda instalado.
 */
export const viewport: Viewport = {
  themeColor: '#2F52D3',
  // O portal é claro por padrão (darkMode: ["class"] no Tailwind, sem toggle) —
  // declarar isso evita o auto-dark do Chrome inverter as cores.
  colorScheme: 'light',
};

export const metadata: Metadata = {
  title: {
    default: 'Portal Conecta | IFPR Campus Ivaiporã',
    template: '%s | Portal Conecta IFPR',
  },
  description:
    'Plataforma oficial de comunicação do IFPR Campus Ivaiporã. Editais traduzidos pela IFizinha, projetos de extensão e agenda escolar em um só lugar.',
  keywords: ['IFPR', 'Ivaiporã', 'editais', 'bolsas', 'extensão', 'IFizinha', 'projetos'],
  authors: [{ name: 'Marketing Digital Solidário – IFPR Ivaiporã' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Portal Conecta IFPR Ivaiporã',
    title: 'Portal Conecta | IFPR Campus Ivaiporã',
    description: 'Editais, projetos e agenda do IFPR Ivaiporã — traduzidos pela IFizinha para você.',
  },

  // ── PWA: instalável sem service worker (ver src/app/manifest.ts) ───────────
  applicationName: 'Portal Conecta',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // iOS ignora `display` do manifest: sem isto o portal abre com a barra do
  // Safari ao ser lançado da tela de início. `statusBarStyle: 'default'` (e não
  // 'black-translucent') porque o Header é `fixed top-0` e não há padding de
  // safe-area no CSS — com a barra translúcida o relógio/bateria ficariam por
  // cima do menu.
  appleWebApp: {
    capable: true,
    title: 'Portal Conecta',
    statusBarStyle: 'default',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased flex flex-col min-h-screen`}>
        {/* Precisa ser script inline, avaliado antes de qualquer chunk: quando
            o build muda no meio do uso, é a própria hidratação que morre — um
            componente React nunca chegaria a montar para reagir. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_RECUPERACAO_BUILD }} />
        <Providers>
          <PublicWrapper>{children}</PublicWrapper>
          <ChatWidget />
        </Providers>
      </body>
    </html>
  );
}
