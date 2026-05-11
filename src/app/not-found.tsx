import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 pt-20">
      <div className="text-center px-4 max-w-md">
        <div className="text-8xl mb-6">🤔</div>
        <div className="inline-flex items-center gap-2 bg-blue-50 text-azul-eletrico rounded-full px-4 py-2 text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4 text-dourado-ifizinha" />
          IFizinha aqui!
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-3">Página não encontrada</h1>
        <p className="text-gray-500 text-lg mb-8 leading-relaxed">
          Hmm, parece que essa página não existe ou foi removida. Mas não se preocupa — o portal tem muita coisa boa por aqui!
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-hero-gradient text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-all"
          >
            Ir para o Início
          </Link>
          <Link
            href="/editais"
            className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition-all"
          >
            Ver Editais
          </Link>
        </div>
      </div>
    </div>
  );
}
