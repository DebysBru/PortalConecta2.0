import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
