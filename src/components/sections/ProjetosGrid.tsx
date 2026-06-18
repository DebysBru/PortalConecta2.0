import React from 'react';
import Link from 'next/link';
import { ArrowRight, Users, Sparkles } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { withCache } from '@/lib/cache';

type Projeto = {
  slug: string;
  nome: string;
  coordenador: string;
  area: string;
  descricao: string | null;
  corPrimaria: string;
  destaque: boolean;
};

// ── Sub-components ──────────────────────────────────────────────────────────

function DestaqueCard({ projeto }: { projeto: Projeto }) {
  return (
    <Link href={`/projetos/${projeto.slug}`} className="group block h-full">
      <div
        className="rounded-2xl overflow-hidden border hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col bg-white"
        style={{ borderColor: `${projeto.corPrimaria}25` }}
      >
        {/* Gradient header */}
        <div
          className="h-[7.5rem] relative flex flex-col justify-between p-4 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${projeto.corPrimaria} 0%, ${projeto.corPrimaria}bb 100%)`,
          }}
        >
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/5 rounded-full" />

          <div className="relative">
            <span className="inline-flex items-center gap-1 bg-black/15 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
              Em execução
            </span>
          </div>

          <div
            className="relative w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white font-black text-xl border border-white/30"
          >
            {projeto.nome.charAt(0)}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="font-bold text-gray-900 text-base leading-snug mb-1 group-hover:text-azul-eletrico transition-colors">
            {projeto.nome}
          </h3>
          <p className="text-sm text-gray-400 mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{projeto.coordenador}</span>
          </p>
          <p className="text-sm text-gray-500 leading-relaxed flex-1 line-clamp-2 mb-4">
            {projeto.descricao}
          </p>
          <div className="flex items-center justify-between mt-auto">
            <span
              className="inline-flex px-3 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: projeto.corPrimaria }}
            >
              {projeto.area}
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-azul-eletrico opacity-0 group-hover:opacity-100 transition-opacity">
              Saiba mais
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function CompactCard({ projeto }: { projeto: Projeto }) {
  return (
    <Link href={`/projetos/${projeto.slug}`} className="group block">
      <div className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 overflow-hidden">
        <div className="h-1.5 w-full" style={{ backgroundColor: projeto.corPrimaria }} />
        <div className="p-4 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-sm"
            style={{ backgroundColor: projeto.corPrimaria }}
          >
            {projeto.nome.charAt(0)}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-snug group-hover:text-azul-eletrico transition-colors truncate">
              {projeto.nome}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{projeto.coordenador}</p>
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-1">{projeto.descricao}</p>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span
              className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap"
              style={{ backgroundColor: projeto.corPrimaria }}
            >
              {projeto.area}
            </span>
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Ativo
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export async function ProjetosGrid() {
  // Buscar projetos do banco com cache (5 min)
  const projetos = await withCache('home:projetosGrid', () => prisma.projeto.findMany({
    where: {
      review_status: 'PUBLICADO',
      deleted_at: null,
    },
    orderBy: [
      { destaque: 'desc' },
      { updatedAt: 'desc' },
    ],
    take: 10,
    select: {
      slug: true,
      nome: true,
      coordenador: true,
      area: true,
      descricao: true,
      corPrimaria: true,
      destaque: true,
    },
  }), 5 * 60 * 1000);

  const destaques = projetos.filter((p) => p.destaque).slice(0, 3);
  const demais = projetos.filter((p) => !p.destaque).slice(0, 2);

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4 max-w-7xl">

        {/* Section header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-6 bg-hero-gradient rounded-full" />
              <p className="text-sm font-semibold text-roxo-luminoso uppercase tracking-wider">
                Extensão
              </p>
            </div>
            <h2 className="text-3xl font-black text-gray-900">Projetos em Destaque</h2>
            <p className="text-gray-500 mt-1">
              Conheça os projetos que estão transformando o Vale do Ivaí
            </p>
          </div>
          <Link
            href="/projetos"
            className="hidden md:flex items-center gap-1.5 text-roxo-luminoso font-semibold hover:gap-3 transition-all text-sm"
          >
            Ver todos
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* ── Row 1: 3 featured cards with gradient header ── */}
        {destaques.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
            {destaques.map((p) => (
              <DestaqueCard key={p.slug} projeto={p} />
            ))}
          </div>
        )}

        {/* ── Row 2: 2 compact cards ── */}
        {demais.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
            {demais.map((p) => (
              <CompactCard key={p.slug} projeto={p} />
            ))}
          </div>
        )}

        {/* Stats bar + CTA */}
        <div className="bg-gradient-to-r from-azul-eletrico/5 via-roxo-luminoso/5 to-rosa-vibrante/5 rounded-2xl p-5 border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-hero-gradient rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Projetos ativos este semestre</p>
              <p className="text-sm text-gray-500">Em extensão, pesquisa e ensino</p>
            </div>
          </div>
          <Link
            href="/projetos"
            className="flex-shrink-0 inline-flex items-center gap-2 border border-gray-200 text-gray-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-all text-sm"
          >
            Explorar todos
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile CTA */}
        <div className="mt-4 md:hidden text-center">
          <Link
            href="/projetos"
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-all text-sm"
          >
            Ver todos os projetos
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
