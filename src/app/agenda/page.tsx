import React from 'react';
import Link from 'next/link';
import { Calendar, Clock, ChevronRight, AlertCircle, MapPin, ExternalLink, Sparkles, Download } from 'lucide-react';
import { formatDate, getDaysUntil } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Agenda',
  description: 'Agenda escolar do IFPR Campus Ivaiporã — prazos de editais, eventos do campus e projetos de extensão.',
};

const tipoConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; dot: string }> = {
  PRAZO_EDITAL: {
    label: 'Prazo Edital',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-100',
    icon: <AlertCircle className="w-5 h-5 text-red-500" />,
    dot: 'bg-red-500',
  },
  EVENTO_CAMPUS: {
    label: 'Evento Campus',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-100',
    icon: <Sparkles className="w-5 h-5 text-blue-500" />,
    dot: 'bg-blue-500',
  },
  EVENTO_PROJETO: {
    label: 'Evento Projeto',
    color: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-100',
    icon: <Sparkles className="w-5 h-5 text-purple-500" />,
    dot: 'bg-purple-500',
  },
  REUNIAO: {
    label: 'Reunião',
    color: 'text-gray-700',
    bg: 'bg-gray-50 border-gray-100',
    icon: <Calendar className="w-5 h-5 text-gray-500" />,
    dot: 'bg-gray-500',
  },
  INSCRICAO: {
    label: 'Inscrição',
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-100',
    icon: <Calendar className="w-5 h-5 text-green-500" />,
    dot: 'bg-green-500',
  },
  RESULTADO: {
    label: 'Resultado',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50 border-yellow-100',
    icon: <AlertCircle className="w-5 h-5 text-yellow-500" />,
    dot: 'bg-yellow-500',
  },
};

const meses: Record<number, string> = {
  0: 'Janeiro', 1: 'Fevereiro', 2: 'Março', 3: 'Abril', 4: 'Maio', 5: 'Junho',
  6: 'Julho', 7: 'Agosto', 8: 'Setembro', 9: 'Outubro', 10: 'Novembro', 11: 'Dezembro',
};

function groupByMonth(events: { data: Date; tipo: string; id: string; titulo: string; descricao: string | null; dataFim: Date | null; local: string | null; linkInscr: string | null; editalSlug: string | null }[]) {
  return events.reduce<Record<string, typeof events>>((acc, event) => {
    const key = `${event.data.getFullYear()}-${event.data.getMonth()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});
}

export default async function AgendaPage() {
  const eventos = await prisma.evento.findMany({
    orderBy: { data: 'asc' },
    select: {
      id: true,
      titulo: true,
      descricao: true,
      data: true,
      dataFim: true,
      tipo: true,
      local: true,
      linkInscr: true,
      editalSlug: true,
    },
  });

  const grouped = groupByMonth(eventos);
  const urgentes = eventos.filter((e) => {
    const d = getDaysUntil(e.data);
    return d > 0 && d <= 10;
  });

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="bg-hero-gradient pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-2 text-white/70 text-sm mb-4">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">Agenda</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center border border-white/30 flex-shrink-0">
              <Calendar className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Agenda Escolar</h1>
              <p className="text-white/80 text-lg max-w-2xl">
                Prazos de editais, eventos do campus e atividades dos projetos de extensão.
                Nunca mais perca uma data importante!
              </p>
            </div>
          </div>

          {/* Legenda + Export */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              {Object.entries(tipoConfig).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5 text-sm text-white">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </div>
              ))}
            </div>
            <a
              href="/api/events/ics"
              download
              className="flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white font-semibold px-4 py-2 rounded-xl hover:bg-white/25 transition-all border border-white/20 text-sm"
            >
              <Download className="w-4 h-4" />
              Exportar .ics
            </a>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl py-8">
        {/* Alertas urgentes */}
        {urgentes.length > 0 && (
          <div className="mb-8 bg-orange-50 border border-orange-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <h2 className="font-bold text-orange-800">Atenção — Encerramento em breve!</h2>
            </div>
            <div className="space-y-2">
              {urgentes.map((e) => {
                const daysLeft = getDaysUntil(e.data);
                return (
                  <div key={e.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-orange-100">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                      <span className="text-sm font-semibold text-gray-900">{e.titulo}</span>
                    </div>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full flex-shrink-0">
                      {daysLeft === 1 ? 'Amanhã!' : `${daysLeft} dias`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filtros de tipo */}
        <div className="flex flex-wrap gap-2 mb-8">
          {['Todos', ...Object.keys(tipoConfig)].map((tipo) => (
            <button
              key={tipo}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                tipo === 'Todos'
                  ? 'bg-azul-eletrico text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tipo === 'Todos' ? 'Todos' : tipoConfig[tipo]?.label ?? tipo}
            </button>
          ))}
        </div>

        {/* Timeline por mês */}
        {eventos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-lg">Nenhum evento cadastrado</p>
            <p className="text-sm mt-1">Volte em breve para conferir a agenda!</p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([key, eventosDoMes]) => {
              const [year, monthStr] = key.split('-');
              const month = parseInt(monthStr);
              return (
                <div key={key}>
                  {/* Cabeçalho do mês */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="bg-hero-gradient text-white font-bold px-4 py-2 rounded-xl text-sm">
                      {meses[month]} {year}
                    </div>
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">{eventosDoMes.length} evento{eventosDoMes.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Eventos do mês */}
                  <div className="space-y-3 pl-2">
                    {eventosDoMes.map((evento) => {
                      const config = tipoConfig[evento.tipo] ?? { label: evento.tipo, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-100', icon: null, dot: 'bg-gray-400' };
                      const daysLeft = getDaysUntil(evento.data);
                      const isUrgent = daysLeft > 0 && daysLeft <= 7;
                      const isPast = daysLeft <= 0;

                      return (
                        <div
                          key={evento.id}
                          className={`relative rounded-2xl border p-5 transition-all ${config.bg} ${isPast ? 'opacity-60' : ''} ${isUrgent ? 'ring-2 ring-orange-200' : ''}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                            {/* Date */}
                            <div className="flex-shrink-0 flex items-center gap-3 sm:flex-col sm:items-center sm:w-16 sm:text-center">
                              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex flex-col items-center justify-center border border-gray-100">
                                <p className="text-xl font-black text-gray-900 leading-none">{evento.data.getDate()}</p>
                                <p className="text-xs text-gray-400 font-medium uppercase">{meses[evento.data.getMonth()].slice(0, 3)}</p>
                              </div>
                              {isUrgent && (
                                <div className="sm:hidden flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                                  <AlertCircle className="w-3 h-3" />
                                  {daysLeft}d
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <div className="flex items-center gap-1.5">
                                  {config.icon}
                                  <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                                </div>
                                {isUrgent && (
                                  <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                                    <AlertCircle className="w-3 h-3" />
                                    {daysLeft === 1 ? 'Amanhã!' : `${daysLeft} dias restantes`}
                                  </span>
                                )}
                                {isPast && (
                                  <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Encerrado</span>
                                )}
                              </div>

                              <h3 className="font-bold text-gray-900 text-base mb-1">{evento.titulo}</h3>
                              {evento.descricao && (
                                <p className="text-sm text-gray-600 leading-relaxed mb-3">{evento.descricao}</p>
                              )}

                              <div className="flex flex-wrap items-center gap-4 text-sm">
                                {evento.local && (
                                  <div className="flex items-center gap-1.5 text-gray-500">
                                    <MapPin className="w-4 h-4" />
                                    {evento.local}
                                  </div>
                                )}
                                {evento.dataFim && (
                                  <div className="flex items-center gap-1.5 text-gray-500">
                                    <Clock className="w-4 h-4" />
                                    Até {formatDate(evento.dataFim, { day: '2-digit', month: 'long' })}
                                  </div>
                                )}
                              </div>

                              {evento.editalSlug && !isPast && (
                                <div className="mt-3">
                                  <Link
                                    href={`/editais/${evento.editalSlug}`}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-azul-eletrico hover:underline"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Ver edital completo com a IFizinha
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* IFizinha tip */}
        <div className="mt-10 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-purple-100 p-6 flex items-start gap-4">
          <div className="w-12 h-12 bg-dourado-ifizinha rounded-2xl flex items-center justify-center text-xl flex-shrink-0">✨</div>
          <div>
            <p className="font-bold text-gray-900 mb-1">Dica da IFizinha</p>
            <p className="text-gray-600 text-sm leading-relaxed">
              Configure os lembretes no seu celular com as datas que mais te interessam! Prazos de editais costumam não ter prorrogação — então não deixa pra última hora.
              E sempre confira o edital oficial para confirmar as datas, tá?
            </p>
            <Link href="/editais" className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-azul-eletrico hover:underline">
              <Sparkles className="w-4 h-4 text-dourado-ifizinha" />
              Ver editais abertos
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
