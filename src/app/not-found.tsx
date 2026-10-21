import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Search, Sparkles } from 'lucide-react';

/**
 * 404 do portal.
 *
 * A arte (`/ifizinha/arte-404.webp`) já vem com o "404 · Página não encontrada!"
 * desenhado — é a IFizinha procurando a página. Por isso o `<h1>` fica em sr-only:
 * o texto precisa existir para leitor de tela e para o buscador, mas repetir o
 * que a imagem já diz só poluiria a tela.
 *
 * O `pt-24` é por causa do Header `fixed`.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 pt-24 pb-16">
      <div className="w-full max-w-2xl text-center">
        <Image
          src="/ifizinha/arte-404.webp"
          alt="IFizinha procurando a página, com o número 404"
          width={900}
          height={900}
          unoptimized
          priority
          className="mx-auto mb-6 h-auto w-full max-w-[420px]"
        />

        <h1 className="sr-only">Página não encontrada (404)</h1>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-100 bg-gradient-to-br from-blue-50 to-purple-50 px-4 py-2 text-sm font-medium text-roxo-luminoso">
          <Sparkles className="h-4 w-4" />
          A IFizinha não achou essa página
        </div>

        <p className="mx-auto mb-8 max-w-lg text-lg leading-relaxed text-gray-500">
          O endereço pode estar errado, ou a página saiu do ar. Mas não se preocupa — tem muita
          coisa boa no portal pra você continuar de onde parou.
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-hero-gradient px-6 py-3 font-semibold text-white shadow-lg transition-all hover:opacity-95 hover:shadow-xl active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o início
          </Link>
          <Link
            href="/editais"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-6 py-3 font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
          >
            <Search className="h-4 w-4" />
            Ver os editais abertos
          </Link>
        </div>
      </div>
    </div>
  );
}
