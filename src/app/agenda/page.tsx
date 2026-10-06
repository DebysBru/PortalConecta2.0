import React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Calendar } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { AgendaExplorer, type EventoAgenda } from '@/components/agenda/AgendaExplorer';
import { getDaysUntil } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { withCache } from '@/lib/cache';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Revalidar a cada 5 minutos

export const metadata: Metadata = {
  title: 'Agenda',
  description:
    'Calendário acadêmico do IFPR Campus Ivaiporã: prazos de editais, matrículas, feriados, conselhos de classe e eventos do campus — com filtros e acompanhamento.',
};

/**
 * Agenda pública.
 *
 * A página entrega a lista completa (o calendário do campus tem ~110 eventos por
 * ano, então cabe numa carga só) e quem filtra é o `AgendaExplorer`, no
 * navegador: filtro instantâneo, sem recarregar, e sem N combinações de query
 * string no servidor. O `withCache` evita bater no banco a cada visita.
 */
export default async function AgendaPage() {
  const eventos = await withCache(
    'agenda:eventos',
    () =>
      prisma.evento.findMany({
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
          categoria: true,
          subcategoria: true,
          publicoAlvo: true,
          nivel: true,
          natureza: true,
          interessaAlunos: true,
          interessaProfessores: true,
        },
      }),
    5 * 60 * 1000,
  );

  // Datas atravessam a fronteira servidor → cliente como texto ISO (o cliente
  // reconstrói ao meio-dia UTC, como o importador grava).
  const paraOCliente: EventoAgenda[] = eventos.map((evento) => ({
    id: evento.id,
    titulo: evento.titulo,
    descricao: evento.descricao,
    data: evento.data.toISOString(),
    dataFim: evento.dataFim ? evento.dataFim.toISOString() : null,
    tipo: evento.tipo,
    local: evento.local,
    linkInscr: evento.linkInscr,
    editalSlug: evento.editalSlug,
    categoria: evento.categoria,
    subcategoria: evento.subcategoria,
    publicoAlvo: evento.publicoAlvo,
    nivel: evento.nivel,
    natureza: evento.natureza,
    interessaAlunos: evento.interessaAlunos,
    interessaProfessores: evento.interessaProfessores,
  }));

  const urgentes = eventos.filter((evento) => {
    const dias = getDaysUntil(evento.data);
    return dias > 0 && dias <= 10;
  });

  const categorias = new Set(eventos.map((e) => e.categoria).filter(Boolean));

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero
        trilha={[{ href: '/', label: 'Início' }, { label: 'Agenda' }]}
        etiqueta="Datas importantes"
        titulo="Agenda e Calendário Acadêmico"
        descricao="Prazos de editais, matrículas, feriados, conselhos de classe e eventos do campus. Filtre pelo que interessa e acompanhe as datas que você não pode perder."
        cor="text-rosa-600"
        icone={<Calendar className="h-7 w-7 text-rosa-600" />}
        fundoIcone="bg-rosa-50"
      >
        <div className="mt-6 flex flex-wrap gap-3 text-sm text-gray-500">
          <span className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
            <strong className="text-gray-900">{eventos.length}</strong> eventos no calendário
          </span>
          {categorias.size > 0 && (
            <span className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
              <strong className="text-gray-900">{categorias.size}</strong> categorias para filtrar
            </span>
          )}
          <span className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
            Exporta para o seu calendário (.ics)
          </span>
        </div>
      </PageHero>

      <div className="container mx-auto max-w-5xl space-y-8 px-4 py-10">
        {/* O que vence logo: fica no topo, com link para o evento */}
        {urgentes.length > 0 && (
          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <p className="text-sm font-bold uppercase tracking-wide text-orange-700">
                Acontece nos próximos 10 dias
              </p>
            </div>
            <div className="space-y-2">
              {urgentes.slice(0, 4).map((evento) => {
                const dias = getDaysUntil(evento.data);
                return (
                  <div key={evento.id} className="flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-white p-3">
                    <span className="truncate text-sm font-semibold text-gray-900">{evento.titulo}</span>
                    <span className="flex-shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">
                      {dias === 1 ? 'Amanhã!' : `Em ${dias} dias`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <AgendaExplorer eventos={paraOCliente} />

        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center">
          <p className="font-semibold text-gray-900">Falta algum evento no calendário?</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-gray-500">
            A agenda é alimentada pelo calendário acadêmico oficial e pelos projetos do campus. Se
            você é coordenador ou servidor e precisa incluir uma data, fale com a comunicação do campus.
          </p>
          <Link
            href="/projetos"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
          >
            Ver os projetos do campus
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
