import React from 'react';
import Link from 'next/link';
import {
  Sparkles, FolderOpen, ChevronRight,
  Clock, ArrowRight, Users, FileText, Star, Zap, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatDateShort, getDaysUntil, getStatusLabel, getStatusColor, getCategoryColor
} from '@/lib/utils';
import { HeroIFizinha } from '@/components/sections/HeroIFizinha';
import { ProjetosGrid } from '@/components/sections/ProjetosGrid';
import { getDashboardStatsAction } from '@/actions/auth';
import { getAllSiteConfigAction } from '@/actions/site-config';
import { db } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Buscar dados do banco (cache revalidate a cada 5 min)
  const [stats, siteConfig, editaisDestaque, proximosEventos] = await Promise.all([
    getDashboardStatsAction(),
    getAllSiteConfigAction(),
    db.edital.findMany({
      where: {
        review_status: 'PUBLICADO',
        deleted_at: null,
        status: { in: ['ABERTO', 'EM_ANALISE'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    }),
    db.evento.findMany({
      where: {
        data: { gte: new Date() },
      },
      orderBy: { data: 'asc' },
      take: 4,
    }),
  ]);

  const statsConfig = [
    { label: 'Editais Ativos', value: stats.editaisAtivos, icon: FileText, color: 'text-azul-eletrico', bg: 'bg-azul-eletrico/10' },
    { label: 'Projetos em Execução', value: stats.projetos, icon: FolderOpen, color: 'text-roxo-luminoso', bg: 'bg-roxo-luminoso/10' },
    { label: 'Usuários', value: stats.usuarios, icon: Users, color: 'text-rosa-vibrante', bg: 'bg-rosa-vibrante/10' },
    { label: 'Eventos Próximos', value: stats.eventos, icon: Sparkles, color: 'text-ciano-claro', bg: 'bg-ciano-claro/10' },
  ];

  const tipoEventoConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    PRAZO_EDITAL: { label: 'Prazo', color: 'bg-red-100 text-red-700', icon: <AlertCircle className="w-3 h-3" /> },
    EVENTO_CAMPUS: { label: 'Campus', color: 'bg-blue-100 text-blue-700', icon: <Star className="w-3 h-3" /> },
    EVENTO_PROJETO: { label: 'Projeto', color: 'bg-purple-100 text-purple-700', icon: <Zap className="w-3 h-3" /> },
  };

  return (
    <div className="flex flex-col">
      <HeroIFizinha config={siteConfig} />

      {/* === ESTATÍSTICAS === */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {statsConfig.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center text-center p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all group"
              >
                <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <p className={`text-3xl font-black ${stat.color} mb-1`}>{stat.value}</p>
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === EDITAIS EM DESTAQUE === */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between mb-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-6 bg-hero-gradient rounded-full" />
                <p className="text-sm font-semibold text-azul-eletrico uppercase tracking-wider">Oportunidades</p>
              </div>
              <h2 className="text-3xl font-black text-gray-900">Editais em Destaque</h2>
              <p className="text-gray-500 mt-1">Traduzidos pela IFizinha — linguagem simples, informação completa</p>
            </div>
            <Link
              href="/editais"
              className="hidden md:flex items-center gap-1.5 text-azul-eletrico font-semibold hover:gap-3 transition-all text-sm"
            >
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {editaisDestaque.map((edital) => {
              const daysLeft = edital.inscricao_fim ? getDaysUntil(edital.inscricao_fim) : null;
              const isUrgent = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;

              return (
                <Link
                  key={edital.id}
                  href={`/editais/${edital.slug}`}
                  className="group block"
                >
                  <div className={`bg-white rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl h-full flex flex-col ${
                    isUrgent ? 'border-orange-200 ring-2 ring-orange-100' : 'border-gray-100 hover:border-azul-eletrico/30'
                  }`}>
                    {isUrgent && (
                      <div className="flex items-center gap-1.5 text-orange-600 text-xs font-semibold mb-3 bg-orange-50 rounded-lg px-3 py-1.5 w-fit">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Encerra em {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}!
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex gap-2 flex-wrap">
                        {edital.categoria && (
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getCategoryColor(edital.categoria)}`}>
                            {edital.categoria}
                          </span>
                        )}
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(edital.status)}`}>
                          {getStatusLabel(edital.status)}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-azul-eletrico/10 flex items-center justify-center flex-shrink-0 group-hover:bg-azul-eletrico group-hover:text-white transition-colors">
                        <ChevronRight className="w-4 h-4 text-azul-eletrico group-hover:text-white" />
                      </div>
                    </div>

                    <h3 className="font-bold text-gray-900 text-base leading-snug mb-3 group-hover:text-azul-eletrico transition-colors flex-1">
                      {edital.titulo}
                    </h3>

                    <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2">
                      {edital.resumoSimples || edital.resumo || 'Sem descrição disponível'}
                    </p>

                    {edital.inscricao_fim && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-auto pt-3 border-t border-gray-50">
                        <Clock className="w-3.5 h-3.5" />
                        Encerra: {formatDateShort(edital.inscricao_fim)}
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-azul-eletrico font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-dourado-ifizinha" />
                      Ver versão IFizinha
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 text-center md:hidden">
            <Link href="/editais">
              <Button variant="outline" className="w-full max-w-xs">
                Ver todos os editais
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <ProjetosGrid />

      {/* === PRÓXIMOS EVENTOS === */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between mb-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-6 bg-hero-gradient rounded-full" />
                <p className="text-sm font-semibold text-rosa-vibrante uppercase tracking-wider">Agenda</p>
              </div>
              <h2 className="text-3xl font-black text-gray-900">Próximos Eventos & Prazos</h2>
              <p className="text-gray-500 mt-1">Não perca nenhuma data importante</p>
            </div>
            <Link
              href="/agenda"
              className="hidden md:flex items-center gap-1.5 text-rosa-vibrante font-semibold hover:gap-3 transition-all text-sm"
            >
              Agenda completa
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {proximosEventos.map((evento) => {
              const config = tipoEventoConfig[evento.tipo as string] ?? { label: evento.tipo, color: 'bg-gray-100 text-gray-700', icon: null };
              const daysLeft = getDaysUntil(evento.data);

              return (
                <div
                  key={evento.id}
                  className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all p-4 flex items-center gap-4"
                >
                  {/* Date badge */}
                  <div className="flex-shrink-0 w-14 h-14 bg-gray-50 rounded-xl flex flex-col items-center justify-center border border-gray-100">
                    <p className="text-xl font-black text-gray-900 leading-none">
                      {evento.data.getDate().toString().padStart(2, '0')}
                    </p>
                    <p className="text-xs text-gray-500 font-medium uppercase">
                      {evento.data.toLocaleString('pt-BR', { month: 'short' })}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">
                      {evento.titulo}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                        {config.icon}
                        {config.label}
                      </span>
                      {daysLeft > 0 && daysLeft <= 30 && (
                        <span className={`text-xs font-medium ${daysLeft <= 7 ? 'text-red-600' : 'text-gray-500'}`}>
                          {daysLeft === 1 ? 'Amanhã!' : `Em ${daysLeft} dias`}
                        </span>
                      )}
                    </div>
                  </div>

                  {daysLeft <= 7 && daysLeft > 0 && (
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 text-center md:hidden">
            <Link href="/agenda">
              <Button variant="outline" className="w-full max-w-xs">
                Ver agenda completa
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* === IFIZINHA CTA FINAL === */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="bg-hero-gradient rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
            </div>
            <div className="relative">
              <div className="text-5xl mb-4">✨</div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                {siteConfig.ifizinha_titulo || 'Ainda com dúvidas sobre algum edital?'}
              </h2>
              <p className="text-white/85 text-lg max-w-xl mx-auto mb-8">
                {siteConfig.ifizinha_descricao || 'Cada edital no Portal Conecta tem uma tradução especial minha — a versão IFizinha!\nLinguagem simples, estrutura clara, sem enrolação.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/editais"
                  className="inline-flex items-center justify-center gap-2 bg-white text-azul-eletrico font-bold px-8 py-4 rounded-xl hover:bg-white/90 transition-all shadow-lg text-base"
                >
                  <Sparkles className="w-5 h-5" />
                  Ver Editais com a IFizinha
                </Link>
                <Link
                  href="/projetos"
                  className="inline-flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/25 transition-all border border-white/30 text-base"
                >
                  <FolderOpen className="w-5 h-5" />
                  Conhecer os Projetos
                </Link>
              </div>
              <p className="text-white/60 text-xs mt-6">
                * Confira sempre o edital oficial — a versão IFizinha é um resumo para facilitar seu entendimento.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
