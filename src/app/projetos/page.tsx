import React from 'react';
import Link from 'next/link';
import { FolderOpen, ChevronRight, Search, Filter, Users, ArrowRight, TrendingUp, Sparkles } from 'lucide-react';
import { getStatusLabel, getStatusColor } from '@/lib/utils';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { withCache } from '@/lib/cache';

export const revalidate = 300; // Revalidar a cada 5 minutos

export const metadata: Metadata = {
  title: 'Projetos',
  description: 'Diretório completo dos projetos de extensão, pesquisa e ensino do IFPR Campus Ivaiporã.',
};

export default async function ProjetosPage() {
  const projetos = await withCache('projetos:all', () => prisma.projeto.findMany({
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      slug: true,
      area: true,
      coordenador: true,
      status: true,
      corPrimaria: true,
      descricao: true,
      destaque: true,
    },
  }), 5 * 60 * 1000);

  const areas = ['Todas', ...Array.from(new Set(projetos.map((p) => p.area))).sort()];
  const statusOptions = ['Todos', 'ATIVO', 'EM_EXECUCAO', 'ENCERRADO', 'SUSPENSO', 'INSCRICOES_ABERTAS', 'SEM_VAGAS'];

  const emExecucao = projetos.filter((p) => p.status === 'EM_EXECUCAO').length;
  const inscricoesAbertas = projetos.filter((p) => p.status === 'INSCRICOES_ABERTAS').length;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="bg-hero-gradient pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center gap-2 text-white/70 text-sm mb-4">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">Projetos</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center border border-white/30 flex-shrink-0">
              <FolderOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Projetos de Extensão</h1>
              <p className="text-white/80 text-lg max-w-2xl">
                Conheça os projetos que estão transformando o Vale do Ivaí.
                Pesquisa, extensão e ensino conectando o IFPR à comunidade.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8 flex flex-wrap gap-4">
            {[
              { label: 'Em Execução', value: emExecucao, color: 'bg-green-500' },
              { label: 'Inscrições Abertas', value: inscricoesAbertas, color: 'bg-blue-500' },
              { label: 'Total', value: projetos.length, color: 'bg-white/30' },
            ].map((s) => (
              <div key={s.label} className="bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/20 flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${s.color}`} />
                <span className="text-white font-bold text-lg">{s.value}</span>
                <span className="text-white/70 text-sm">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container mx-auto px-4 max-w-7xl py-10">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Buscar projetos..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select className="pl-3 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico bg-white">
                <option value="Todas">Área: Todas</option>
                {areas.slice(1).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <select className="pl-3 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico bg-white">
              <option value="Todos">Status: Todos</option>
              {statusOptions.slice(1).map((s) => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
            </select>
          </div>
        </div>

        {/* Projetos Destaque */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-5 h-5 text-dourado-ifizinha" />
            <h2 className="font-bold text-gray-900 text-lg">Projetos em Destaque</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {projetos.filter((p) => p.destaque).map((projeto) => (
              <Link key={projeto.id} href={`/projetos/${projeto.slug}`} className="group block">
                <div className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden h-full flex flex-col">
                  {/* Color header */}
                  <div className="h-24 relative flex items-end p-4" style={{ background: `linear-gradient(135deg, ${projeto.corPrimaria} 0%, ${projeto.corPrimaria}cc 100%)` }}>
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white font-black text-2xl border border-white/30">
                      {projeto.nome.charAt(0)}
                    </div>
                    <div className="ml-auto">
                      <span className="text-white/80 text-xs bg-black/20 rounded-full px-2.5 py-1 font-medium">
                        {getStatusLabel(projeto.status)}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-gray-900 text-base leading-snug mb-1 group-hover:text-azul-eletrico transition-colors">
                      {projeto.nome}
                    </h3>
                    <p className="text-sm text-gray-500 mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {projeto.coordenador}
                    </p>
                    <p className="text-sm text-gray-500 leading-relaxed flex-1 line-clamp-2">{projeto.descricao}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span
                        className="inline-flex px-3 py-1 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: projeto.corPrimaria }}
                      >
                        {projeto.area}
                      </span>
                      <div className="flex items-center gap-1 text-xs font-semibold text-azul-eletrico group-hover:gap-2 transition-all">
                        Saiba mais
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Todos os projetos */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-900 text-lg">Todos os Projetos ({projetos.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projetos.map((projeto) => (
              <Link key={projeto.id} href={`/projetos/${projeto.slug}`} className="group block">
                <div className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 overflow-hidden">
                  <div className="h-2 w-full" style={{ backgroundColor: projeto.corPrimaria }} />
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: projeto.corPrimaria }}
                      >
                        {projeto.nome.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-azul-eletrico transition-colors line-clamp-2">
                          {projeto.nome}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{projeto.coordenador}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span
                        className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: projeto.corPrimaria }}
                      >
                        {projeto.area}
                      </span>
                      <span className={`text-xs font-medium flex items-center gap-1 ${
                        projeto.status === 'EM_EXECUCAO' ? 'text-green-600' :
                        projeto.status === 'ATIVO' ? 'text-blue-600' :
                        'text-gray-500'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          projeto.status === 'EM_EXECUCAO' ? 'bg-green-500 animate-pulse' :
                          projeto.status === 'ATIVO' ? 'bg-blue-500' :
                          'bg-gray-400'
                        }`} />
                        {getStatusLabel(projeto.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* CTA Participe */}
        <div className="mt-12 bg-gradient-to-br from-azul-eletrico/5 via-roxo-luminoso/5 to-rosa-vibrante/5 rounded-3xl border border-gray-100 p-8 md:p-10 text-center">
          <div className="w-14 h-14 bg-hero-gradient rounded-2xl flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3">Quer fazer parte de um projeto?</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Entre em contato com o coordenador do projeto ou aguarde os editais de bolsas de extensão!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/editais" className="inline-flex items-center justify-center gap-2 bg-hero-gradient text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-all">
              <Sparkles className="w-5 h-5" />
              Ver Editais de Bolsas
            </Link>
            <Link href="/agenda" className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition-all">
              Ver Eventos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
