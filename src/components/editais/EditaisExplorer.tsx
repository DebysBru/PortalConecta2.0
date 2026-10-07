'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowUpDown, Calendar, ChevronRight, ExternalLink, Filter,
  Search, Sparkles, SlidersHorizontal, X,
} from 'lucide-react';
import { formatDateShort, getDaysUntil, getStatusLabel, getStatusColor, getCategoryColor } from '@/lib/utils';
import { filtrarEditais, opcoesDeFiltro, ROTULO_AREA, type FiltrosEditais } from '@/lib/editais-ifpr';
import { MascoteInterativa } from '@/components/ifizinha/MascoteInterativa';
import type { AreaEdital } from '@/lib/ifpr-editais';

/**
 * Listagem de editais com filtros.
 *
 * Antes esta tela era uma lista corrida (server component, sem filtro nenhum): com
 * os editais importados do site do IFPR — mais de uma centena, de anos e áreas
 * diferentes — achar alguma coisa virou rolagem. Aqui os filtros funcionam no
 * cliente, sobre a lista que o servidor já mandou: resposta instantânea, sem ida
 * ao servidor a cada tecla.
 *
 * A filtragem em si é uma função pura testada (`filtrarEditais` em
 * src/lib/editais-ifpr.ts), então o comportamento da tela é o mesmo que os testes
 * garantem.
 */
export interface EditalListado {
  id: string;
  titulo: string;
  slug: string;
  categoria: string;
  status: string;
  ano: number | null;
  areaEdital: string | null;
  resumoSimples: string | null;
  resumo: string | null;
  dataEncerramento: string | Date | null;
  destaque: boolean;
  visualizacoes: number;
  linkOficial: string | null;
  updatedAt?: string | Date | null;
}

const ROTULO_CATEGORIA: Record<string, string> = {
  BOLSAS: 'Bolsas',
  AUXILIOS: 'Auxílios',
  EXTENSAO: 'Extensão',
  PESQUISA: 'Pesquisa',
  ENSINO: 'Ensino',
  EVENTOS: 'Eventos',
  ESTAGIOS: 'Estágios',
  RESULTADOS: 'Resultados',
};

const ORDENS: Array<{ valor: NonNullable<FiltrosEditais['ordem']>; rotulo: string }> = [
  { valor: 'recentes', rotulo: 'Mais recentes' },
  { valor: 'antigos', rotulo: 'Mais antigos' },
  { valor: 'titulo', rotulo: 'Título (A–Z)' },
];

export function EditaisExplorer({ editais }: { editais: EditalListado[] }) {
  const [filtros, setFiltros] = useState<FiltrosEditais>({ ordem: 'recentes' });
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const opcoes = useMemo(() => opcoesDeFiltro(editais), [editais]);
  const filtrados = useMemo(() => filtrarEditais(editais, filtros), [editais, filtros]);

  const filtroAtivo = Boolean(
    filtros.busca || (filtros.categoria && filtros.categoria !== 'todas') ||
    (filtros.area && filtros.area !== 'todas') || (filtros.ano && filtros.ano !== 'todos') ||
    (filtros.status && filtros.status !== 'todos'),
  );

  const limpar = () => setFiltros({ ordem: filtros.ordem });
  const definir = (campo: keyof FiltrosEditais, valor: string) => setFiltros((f) => ({ ...f, [campo]: valor }));

  const urgentes = filtrados.filter(
    (e) => e.dataEncerramento && getDaysUntil(new Date(e.dataEncerramento)) > 0 && getDaysUntil(new Date(e.dataEncerramento)) <= 7,
  );

  return (
    <div>
      {/* ── Busca e contadores ── */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={filtros.busca ?? ''}
              onChange={(evento) => definir('busca', evento.target.value)}
              placeholder="Buscar por título, assunto ou ano (ex.: bolsa 2026)"
              aria-label="Buscar editais"
              className="input-field pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMostrarFiltros((v) => !v)}
              aria-expanded={mostrarFiltros}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                mostrarFiltros || filtroAtivo
                  ? 'border-azul-eletrico/30 bg-azul-eletrico/5 text-azul-eletrico'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {filtroAtivo && <span className="rounded-full bg-azul-eletrico px-1.5 text-xs text-white">!</span>}
            </button>

            <div className="relative">
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                value={filtros.ordem ?? 'recentes'}
                onChange={(evento) => definir('ordem', evento.target.value)}
                aria-label="Ordenar editais"
                className="input-field appearance-none pl-9 pr-8"
              >
                {ORDENS.map((ordem) => (
                  <option key={ordem.valor} value={ordem.valor}>{ordem.rotulo}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {mostrarFiltros && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-50 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Categoria</span>
              <select value={filtros.categoria ?? 'todas'} onChange={(e) => definir('categoria', e.target.value)} className="input-field">
                <option value="todas">Todas</option>
                {opcoes.categorias.map((c) => (
                  <option key={c} value={c}>{ROTULO_CATEGORIA[c] ?? c}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Área</span>
              <select value={filtros.area ?? 'todas'} onChange={(e) => definir('area', e.target.value)} className="input-field">
                <option value="todas">Todas</option>
                {opcoes.areas.map((a) => (
                  <option key={a} value={a}>{ROTULO_AREA[a as AreaEdital] ?? a}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Ano</span>
              <select value={filtros.ano ?? 'todos'} onChange={(e) => definir('ano', e.target.value)} className="input-field">
                <option value="todos">Todos</option>
                {opcoes.anos.map((ano) => (
                  <option key={ano} value={String(ano)}>{ano}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Situação</span>
              <select value={filtros.status ?? 'todos'} onChange={(e) => definir('status', e.target.value)} className="input-field">
                <option value="todos">Todas</option>
                {opcoes.status.map((s) => (
                  <option key={s} value={s}>{getStatusLabel(s)}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
          <span>
            Mostrando <strong className="text-gray-900">{filtrados.length}</strong> de {editais.length} editais
            {urgentes.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 font-semibold text-orange-600">
                <AlertCircle className="h-3.5 w-3.5" />
                {urgentes.length} encerrando em até 7 dias
              </span>
            )}
          </span>
          {filtroAtivo && (
            <button type="button" onClick={limpar} className="inline-flex items-center gap-1 font-semibold text-azul-eletrico hover:underline">
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Lista ── */}
      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center">
          <div className="mx-auto mb-4 w-[130px]">
            <MascoteInterativa nome="chat" />
          </div>
          <p className="font-semibold text-gray-700">
            {editais.length === 0 ? 'Nenhum edital publicado' : 'Nenhum edital neste filtro'}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            {editais.length === 0
              ? 'Volte em breve para conferir as oportunidades!'
              : 'Tente outra palavra ou limpe os filtros para ver todos.'}
          </p>
          {filtroAtivo && editais.length > 0 && (
            <button type="button" onClick={limpar} className="mt-4 rounded-xl bg-azul-eletrico px-5 py-2.5 text-sm font-semibold text-white">
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtrados.map((edital) => {
            const encerra = edital.dataEncerramento ? new Date(edital.dataEncerramento) : null;
            const daysLeft = encerra ? getDaysUntil(encerra) : null;
            const isUrgent = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;
            const isExpired = daysLeft !== null && daysLeft <= 0;
            const resumo = edital.resumoSimples || edital.resumo || '';
            const area = edital.areaEdital ? ROTULO_AREA[edital.areaEdital as AreaEdital] ?? edital.areaEdital : null;

            return (
              <div
                key={edital.id}
                className={`rounded-2xl border bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover ${
                  isUrgent ? 'border-orange-200 ring-1 ring-orange-100' : isExpired ? 'border-gray-100' : 'border-gray-100 hover:border-azul-eletrico/30'
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {edital.destaque && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-bold text-dourado-ifizinha">
                          <Sparkles className="h-3 w-3" />
                          Destaque
                        </span>
                      )}
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getCategoryColor(edital.categoria)}`}>
                        {ROTULO_CATEGORIA[edital.categoria] ?? edital.categoria}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusColor(edital.status)}`}>
                        {getStatusLabel(edital.status)}
                      </span>
                      {edital.ano && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600">
                          <Calendar className="h-3 w-3" />
                          {edital.ano}
                        </span>
                      )}
                      {area && <span className="text-xs text-gray-400">{area}</span>}
                      {isUrgent && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600">
                          <AlertCircle className="h-3 w-3" />
                          {daysLeft === 1 ? 'Último dia!' : `${daysLeft} dias restantes!`}
                        </span>
                      )}
                    </div>

                    <Link href={`/editais/${edital.slug}`} className="group">
                      <h2 className="mb-2 text-lg font-bold leading-snug text-gray-900 transition-colors group-hover:text-azul-eletrico">
                        {edital.titulo}
                      </h2>
                    </Link>

                    {resumo && <p className="line-clamp-2 text-sm leading-relaxed text-gray-500">{resumo}</p>}

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                      <Link href={`/editais/${edital.slug}`} className="inline-flex items-center gap-1.5 font-medium text-azul-eletrico">
                        <Sparkles className="h-3.5 w-3.5 text-dourado-ifizinha" />
                        Ver versão IFizinha
                      </Link>
                      {edital.linkOficial && (
                        <a
                          href={edital.linkOficial}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-gray-500 transition-colors hover:text-gray-900"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Documento original
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-4 md:flex-col md:items-end md:gap-2">
                    {encerra && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Encerra em</p>
                        <p className={`text-sm font-semibold ${isUrgent ? 'text-orange-600' : 'text-gray-700'}`}>
                          {formatDateShort(encerra, { timeZone: 'UTC' })}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="hidden text-xs text-gray-400 md:block">{edital.visualizacoes} visualizações</span>
                      <Link
                        href={`/editais/${edital.slug}`}
                        aria-label={`Abrir ${edital.titulo}`}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-azul-eletrico/10 transition-colors hover:bg-azul-eletrico"
                      >
                        <ChevronRight className="h-4 w-4 text-azul-eletrico transition-colors hover:text-white" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtrados.length > 0 && (
        <p className="mt-6 flex items-start gap-2 rounded-xl border border-gray-100 bg-white p-3 text-xs text-gray-500">
          <Filter className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          Editais e documentos importados do site oficial do IFPR – Campus Ivaiporã. As datas de inscrição ficam
          dentro de cada documento: confirme no arquivo original antes de contar com um prazo.
        </p>
      )}
    </div>
  );
}
