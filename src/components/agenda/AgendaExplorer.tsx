'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertCircle, Bell, BellOff, BellRing, Calendar, CalendarCheck, Clock, Download,
  ExternalLink, Loader2, MapPin, Search, Sparkles, X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { MascoteInterativa } from '@/components/ifizinha/MascoteInterativa';
import {
  alternarAcompanhamentoEvento, definirSeguirCalendarioInteiro, listarAcompanhamento, seguirEventos,
} from '@/actions/agenda';

/**
 * Agenda pública: filtros e acompanhamento.
 *
 * Antes os "chips" de tipo eram botões sem ação nenhuma — clicava e nada
 * acontecia. Agora a página inteira filtra de verdade, no navegador (a lista do
 * calendário é pequena e já vem do servidor, então filtrar aqui é instantâneo).
 *
 * Filtros: tipo, categoria, público-alvo, "interessa a alunos/professores",
 * período, busca por texto e "só o que eu acompanho".
 *
 * Acompanhar tem três caminhos: o sino de cada evento, "acompanhar os N deste
 * filtro" (em massa) e "acompanhar o calendário inteiro" (inclusive o que for
 * importado depois). Tudo é gravado por Server Action com o ID token do Firebase;
 * sem login, os botões levam para a área do estudante.
 */

export type EventoAgenda = {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  dataFim: string | null;
  tipo: string;
  local: string | null;
  linkInscr: string | null;
  editalSlug: string | null;
  categoria: string | null;
  subcategoria: string | null;
  publicoAlvo: string | null;
  nivel: string | null;
  natureza: string | null;
  interessaAlunos: boolean | null;
  interessaProfessores: boolean | null;
};

export const TIPO_INFO: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  PRAZO_EDITAL: { label: 'Prazo de edital', color: 'text-red-700', bg: 'bg-red-50 border-red-100', dot: 'bg-red-500' },
  EVENTO_CAMPUS: { label: 'Evento do campus', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100', dot: 'bg-blue-500' },
  EVENTO_PROJETO: { label: 'Evento de projeto', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100', dot: 'bg-purple-500' },
  REUNIAO: { label: 'Reunião', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-100', dot: 'bg-gray-500' },
  PALESTRA: { label: 'Palestra', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100', dot: 'bg-indigo-500' },
  LETIVO_INICIO_FIM: { label: 'Calendário letivo', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-100', dot: 'bg-cyan-600' },
  FERIADO: { label: 'Feriado', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500' },
  RECESSO: { label: 'Recesso / férias', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-100', dot: 'bg-teal-500' },
  SABADO_LETIVO: { label: 'Sábado letivo', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-100', dot: 'bg-cyan-500' },
  EVENTO_ACADEMICO: { label: 'Evento acadêmico', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100', dot: 'bg-purple-500' },
  EVENTO_CIENTIFICO: { label: 'Evento científico', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100', dot: 'bg-purple-500' },
  EVENTO_CULTURAL: { label: 'Evento cultural', color: 'text-pink-700', bg: 'bg-pink-50 border-pink-100', dot: 'bg-pink-500' },
  INSCRICAO: { label: 'Inscrição', color: 'text-green-700', bg: 'bg-green-50 border-green-100', dot: 'bg-green-500' },
  RESULTADO: { label: 'Resultado', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100', dot: 'bg-amber-500' },
  RECURSO: { label: 'Recurso', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100', dot: 'bg-orange-500' },
  PROJETO: { label: 'Projeto', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-100', dot: 'bg-violet-500' },
  FORMACAO: { label: 'Formação', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-100', dot: 'bg-sky-500' },
  CONSELHO_CLASSE: { label: 'Conselho de classe', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-100', dot: 'bg-slate-500' },
};

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type Periodo = 'proximos' | 'mes' | 'ano' | 'tudo';
type Interesse = 'todos' | 'alunos' | 'professores';

const soData = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);

function comoDia(iso: string): string {
  const d = soData(iso);
  return `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function infoDoTipo(tipo: string) {
  return TIPO_INFO[tipo] ?? { label: tipo, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-100', dot: 'bg-gray-400' };
}

export function AgendaExplorer({ eventos }: { eventos: EventoAgenda[] }) {
  const { user } = useAuth();

  const [tipo, setTipo] = useState<string>('todos');
  const [categoria, setCategoria] = useState<string>('todas');
  const [publico, setPublico] = useState<string>('todos');
  const [interesse, setInteresse] = useState<Interesse>('todos');
  const [periodo, setPeriodo] = useState<Periodo>('proximos');
  const [busca, setBusca] = useState('');
  const [soAcompanhados, setSoAcompanhados] = useState(false);

  const [seguindo, setSeguindo] = useState<Set<string>>(new Set());
  const [seguirTudo, setSeguirTudo] = useState(false);
  const [carregandoId, setCarregandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [emAcao, startTransition] = useTransition();

  // Estado inicial do acompanhamento (só para quem está logado).
  useEffect(() => {
    let ativo = true;
    if (!user) {
      setSeguindo(new Set());
      setSeguirTudo(false);
      return;
    }
    user
      .getIdToken()
      .then(listarAcompanhamento)
      .then((estado) => {
        if (!ativo) return;
        setSeguindo(new Set(estado.ids));
        setSeguirTudo(estado.seguirTudo);
      })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, [user]);

  const categorias = useMemo(
    () => [...new Set(eventos.map((e) => e.categoria).filter((c): c is string => Boolean(c)))].sort(),
    [eventos],
  );
  const publicos = useMemo(
    () => [...new Set(eventos.map((e) => e.publicoAlvo).filter((p): p is string => Boolean(p)))].sort(),
    [eventos],
  );
  const tiposPresentes = useMemo(
    () => [...new Set(eventos.map((e) => e.tipo))].filter((t) => TIPO_INFO[t]).sort(),
    [eventos],
  );

  const hoje = useMemo(() => {
    const agora = new Date();
    return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 12));
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const limiteProximos = new Date(hoje);
    limiteProximos.setUTCDate(limiteProximos.getUTCDate() + 60);

    return eventos.filter((evento) => {
      const inicio = soData(evento.data);
      const fim = evento.dataFim ? soData(evento.dataFim) : inicio;

      if (tipo !== 'todos' && evento.tipo !== tipo) return false;
      if (categoria !== 'todas' && evento.categoria !== categoria) return false;
      if (publico !== 'todos' && evento.publicoAlvo !== publico) return false;
      if (interesse === 'alunos' && evento.interessaAlunos === false) return false;
      if (interesse === 'professores' && evento.interessaProfessores === false) return false;

      if (periodo === 'proximos') {
        // "Próximos" inclui o que está em andamento (data final no futuro).
        if (fim < hoje || inicio > limiteProximos) return false;
      } else if (periodo === 'mes') {
        if (inicio.getUTCMonth() !== hoje.getUTCMonth() || inicio.getUTCFullYear() !== hoje.getUTCFullYear()) return false;
      } else if (periodo === 'ano') {
        if (inicio.getUTCFullYear() !== hoje.getUTCFullYear()) return false;
      }

      if (soAcompanhados && !seguirTudo && !seguindo.has(evento.id)) return false;

      if (termo) {
        const alvo = `${evento.titulo} ${evento.descricao ?? ''} ${evento.categoria ?? ''} ${evento.subcategoria ?? ''} ${evento.publicoAlvo ?? ''} ${evento.nivel ?? ''} ${evento.local ?? ''}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }

      return true;
    });
  }, [eventos, tipo, categoria, publico, interesse, periodo, busca, soAcompanhados, seguindo, seguirTudo, hoje]);

  const porMes = useMemo(() => {
    const mapa = new Map<string, EventoAgenda[]>();
    for (const evento of filtrados) {
      const data = soData(evento.data);
      const chave = `${data.getUTCFullYear()}-${data.getUTCMonth()}`;
      const lista = mapa.get(chave) ?? [];
      lista.push(evento);
      mapa.set(chave, lista);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtrados]);

  const quantosAcompanho = seguirTudo ? eventos.length : seguindo.size;
  const filtroAtivo = tipo !== 'todos' || categoria !== 'todas' || publico !== 'todos' || interesse !== 'todos' || periodo !== 'proximos' || busca.trim() !== '' || soAcompanhados;

  const limparFiltros = () => {
    setTipo('todos');
    setCategoria('todas');
    setPublico('todos');
    setInteresse('todos');
    setPeriodo('tudo');
    setBusca('');
    setSoAcompanhados(false);
  };

  const comToken = async (acao: (idToken: string) => Promise<void>) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    await acao(idToken);
  };

  const alternarEvento = (evento: EventoAgenda) => {
    if (!user) return;
    setCarregandoId(evento.id);
    setAviso(null);
    startTransition(async () => {
      await comToken(async (idToken) => {
        const resposta = await alternarAcompanhamentoEvento(idToken, evento.id);
        if (!resposta.ok) {
          setAviso({ tipo: 'erro', texto: resposta.error });
          return;
        }
        setSeguindo((atual) => {
          const novo = new Set(atual);
          if (resposta.seguindo) novo.add(evento.id);
          else novo.delete(evento.id);
          return novo;
        });
      });
      setCarregandoId(null);
    });
  };

  const seguirDoFiltro = (seguir: boolean) => {
    if (!user) return;
    const ids = filtrados.map((e) => e.id);
    setAviso(null);
    startTransition(async () => {
      await comToken(async (idToken) => {
        const resposta = await seguirEventos(idToken, ids, seguir);
        if (!resposta.ok) {
          setAviso({ tipo: 'erro', texto: resposta.error });
          return;
        }
        setSeguindo((atual) => {
          const novo = new Set(atual);
          ids.forEach((id) => (seguir ? novo.add(id) : novo.delete(id)));
          return novo;
        });
        setAviso({
          tipo: 'ok',
          texto: seguir
            ? `Pronto! Você está acompanhando ${resposta.total} evento(s) deste filtro.`
            : `Você deixou de acompanhar ${resposta.total} evento(s) deste filtro.`,
        });
      });
    });
  };

  const alternarCalendarioInteiro = () => {
    if (!user) return;
    setAviso(null);
    startTransition(async () => {
      await comToken(async (idToken) => {
        const resposta = await definirSeguirCalendarioInteiro(idToken, !seguirTudo);
        if (!resposta.ok) {
          setAviso({ tipo: 'erro', texto: resposta.error });
          return;
        }
        setSeguirTudo(resposta.seguirTudo);
        setAviso({
          tipo: 'ok',
          texto: resposta.seguirTudo
            ? 'Pronto! Você acompanha o calendário inteiro — inclusive o que for publicado depois.'
            : 'Você deixou de acompanhar o calendário inteiro.',
        });
      });
    });
  };

  const urlICS = useMemo(() => {
    const parametros = new URLSearchParams();
    if (tipo !== 'todos') parametros.set('tipo', tipo);
    if (categoria !== 'todas') parametros.set('categoria', categoria);
    if (publico !== 'todos') parametros.set('publico', publico);
    if (interesse === 'alunos') parametros.set('interesse', 'alunos');
    if (interesse === 'professores') parametros.set('interesse', 'professores');
    if (periodo !== 'tudo') parametros.set('periodo', periodo);
    if (soAcompanhados && user) parametros.set('seguindo', '1');
    const query = parametros.toString();
    return `/api/events/ics${query ? `?${query}` : ''}`;
  }, [tipo, categoria, publico, interesse, periodo, soAcompanhados, user]);

  return (
    <div className="space-y-6">
      {/* ── Acompanhamento ── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        {user ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${seguirTudo ? 'bg-azul-eletrico text-white' : 'bg-azul-50 text-azul-eletrico'}`}>
                {seguirTudo ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {seguirTudo
                    ? 'Você acompanha o calendário inteiro'
                    : quantosAcompanho > 0
                    ? `Você acompanha ${quantosAcompanho} evento${quantosAcompanho !== 1 ? 's' : ''}`
                    : 'Escolha o que quer acompanhar'}
                </p>
                <p className="text-sm text-gray-500">
                  O que você marca aqui aparece na sua área e sai no arquivo .ics para o seu calendário.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={alternarCalendarioInteiro}
                disabled={emAcao}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-60 ${
                  seguirTudo
                    ? 'bg-azul-eletrico text-white hover:bg-azul-600'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {emAcao ? <Loader2 className="h-4 w-4 animate-spin" /> : seguirTudo ? <BellOff className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
                {seguirTudo ? 'Deixar de acompanhar tudo' : 'Acompanhar o calendário inteiro'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Quer acompanhar datas específicas?</p>
                <p className="text-sm text-gray-500">
                  Entre na sua conta para marcar eventos (ou o calendário inteiro) e levar a agenda com você.
                </p>
              </div>
            </div>
            <Link
              href="/minha-area"
              className="inline-flex items-center gap-2 rounded-xl bg-hero-gradient px-5 py-2.5 text-sm font-semibold text-white"
            >
              Entrar
            </Link>
          </div>
        )}

        {aviso && (
          <p className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm ${aviso.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {aviso.tipo === 'ok' ? <CalendarCheck className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
            {aviso.texto}
          </p>
        )}
      </div>

      {/* ── Filtros ── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por matrícula, feriado, conselho de classe..."
              className="input-field !pl-9"
              aria-label="Buscar na agenda"
            />
          </div>

          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input-field max-w-[240px]" aria-label="Filtrar por categoria">
            <option value="todas">Todas as categorias</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={publico} onChange={(e) => setPublico(e.target.value)} className="input-field max-w-[220px]" aria-label="Filtrar por público">
            <option value="todos">Todos os públicos</option>
            {publicos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className="input-field max-w-[190px]" aria-label="Filtrar por período">
            <option value="proximos">Próximos 60 dias</option>
            <option value="mes">Este mês</option>
            <option value="ano">Este ano</option>
            <option value="tudo">Todo o período</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTipo('todos')}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${tipo === 'todos' ? 'bg-azul-eletrico text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Todos os tipos
          </button>
          {tiposPresentes.map((t) => {
            const info = infoDoTipo(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                aria-pressed={tipo === t}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                  tipo === t ? 'bg-azul-eletrico text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${info.dot}`} aria-hidden />
                {info.label}
              </button>
            );
          })}

          <span className="mx-1 hidden h-5 w-px bg-gray-200 sm:block" />

          <button
            type="button"
            onClick={() => setInteresse(interesse === 'alunos' ? 'todos' : 'alunos')}
            aria-pressed={interesse === 'alunos'}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${interesse === 'alunos' ? 'bg-roxo-luminoso text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Interessa a alunos
          </button>
          <button
            type="button"
            onClick={() => setInteresse(interesse === 'professores' ? 'todos' : 'professores')}
            aria-pressed={interesse === 'professores'}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${interesse === 'professores' ? 'bg-roxo-luminoso text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Interessa a professores
          </button>

          {user && (
            <button
              type="button"
              onClick={() => setSoAcompanhados((v) => !v)}
              aria-pressed={soAcompanhados}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${soAcompanhados ? 'bg-azul-eletrico text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Bell className="h-3.5 w-3.5" />
              Só o que eu acompanho
            </button>
          )}

          {filtroAtivo && (
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500">
            <strong className="text-gray-900">{filtrados.length}</strong> de {eventos.length} evento(s)
            {filtroAtivo ? ' neste filtro' : ''}
          </p>

          <div className="flex flex-wrap gap-2">
            {user && filtrados.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => seguirDoFiltro(true)}
                  disabled={emAcao}
                  className="inline-flex items-center gap-2 rounded-xl bg-azul-eletrico px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-azul-600 disabled:opacity-60"
                >
                  <Bell className="h-4 w-4" />
                  Acompanhar os {filtrados.length} deste filtro
                </button>
                {filtrados.some((e) => seguindo.has(e.id)) && (
                  <button
                    type="button"
                    onClick={() => seguirDoFiltro(false)}
                    disabled={emAcao}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-60"
                  >
                    <BellOff className="h-4 w-4" />
                    Remover este filtro
                  </button>
                )}
              </>
            )}

            <a
              href={urlICS}
              download
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              {soAcompanhados && user ? 'Exportar o que acompanho' : 'Exportar .ics'}
            </a>
          </div>
        </div>
      </div>

      {/* ── Linha do tempo ── */}
      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center">
          {/* Estado vazio com a mascote pensando — em vez do ícone cinza de sempre */}
          <div className="mx-auto mb-4 w-[130px]">
            <MascoteInterativa nome="chat" />
          </div>
          <p className="font-semibold text-gray-700">Nenhum evento neste filtro</p>
          <p className="mt-1 text-sm text-gray-500">
            {eventos.length === 0
              ? 'A agenda ainda não recebeu eventos.'
              : 'Tente ampliar o período ou limpar os filtros.'}
          </p>
          {filtroAtivo && (
            <button type="button" onClick={limparFiltros} className="mt-4 rounded-xl bg-azul-eletrico px-5 py-2.5 text-sm font-semibold text-white">
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {porMes.map(([chave, eventosDoMes]) => {
            const [ano, mes] = chave.split('-').map(Number);
            return (
              <div key={chave}>
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-hero-gradient px-4 py-2 text-sm font-bold text-white">
                    {MESES[mes]} {ano}
                  </div>
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs text-gray-500">
                    {eventosDoMes.length} evento{eventosDoMes.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-3">
                  {eventosDoMes.map((evento) => {
                    const info = infoDoTipo(evento.tipo);
                    const inicio = soData(evento.data);
                    const fim = evento.dataFim ? soData(evento.dataFim) : null;
                    const acompanhando = seguirTudo || seguindo.has(evento.id);
                    const passou = fim ? fim < hoje : inicio < hoje;

                    return (
                      <div
                        key={evento.id}
                        className={`relative rounded-2xl border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-brand ${info.bg} ${passou ? 'opacity-60' : ''}`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                          <div className="flex flex-shrink-0 items-center gap-3 sm:w-16 sm:flex-col sm:items-center sm:text-center">
                            <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm">
                              <p className="text-xl font-black leading-none text-gray-900">{inicio.getUTCDate()}</p>
                              <p className="text-xs font-medium uppercase text-gray-400">{MESES_CURTOS[inicio.getUTCMonth()]}</p>
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className={`text-xs font-semibold ${info.color}`}>{info.label}</span>
                              {evento.categoria && (
                                <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs text-gray-600">{evento.categoria}</span>
                              )}
                              {passou && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">Já passou</span>}
                            </div>

                            <h3 className="mb-1 text-base font-bold text-gray-900">{evento.titulo}</h3>
                            {evento.descricao && (
                              <p className="mb-3 text-sm leading-relaxed text-gray-600">{evento.descricao}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                              {fim && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock className="h-4 w-4" />
                                  Até {comoDia(evento.dataFim!)}
                                </span>
                              )}
                              {evento.local && (
                                <span className="inline-flex items-center gap-1.5">
                                  <MapPin className="h-4 w-4" />
                                  {evento.local}
                                </span>
                              )}
                              {evento.publicoAlvo && <span className="text-xs text-gray-400">Para: {evento.publicoAlvo}</span>}
                              {evento.nivel && <span className="text-xs text-gray-400">{evento.nivel}</span>}
                            </div>

                            {evento.linkInscr && (
                              <a
                                href={evento.linkInscr}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-azul-eletrico hover:underline"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Abrir inscrição
                              </a>
                            )}
                            {evento.editalSlug && (
                              <Link
                                href={`/editais/${evento.editalSlug}`}
                                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-azul-eletrico hover:underline"
                              >
                                <Sparkles className="h-4 w-4 text-dourado-ifizinha" />
                                Ver o edital
                              </Link>
                            )}
                          </div>

                          <div className="flex flex-shrink-0 items-start gap-2">
                            {user ? (
                              <button
                                type="button"
                                onClick={() => alternarEvento(evento)}
                                disabled={carregandoId === evento.id}
                                aria-pressed={acompanhando}
                                title={acompanhando ? 'Deixar de acompanhar' : 'Acompanhar este evento'}
                                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all disabled:opacity-60 ${
                                  acompanhando
                                    ? 'bg-azul-eletrico text-white hover:bg-azul-600'
                                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {carregandoId === evento.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : acompanhando ? (
                                  <BellRing className="h-4 w-4" />
                                ) : (
                                  <Bell className="h-4 w-4" />
                                )}
                                <span className="hidden lg:inline">{acompanhando ? 'Acompanhando' : 'Acompanhar'}</span>
                              </button>
                            ) : (
                              <Link
                                href="/minha-area"
                                title="Entre para acompanhar este evento"
                                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50"
                              >
                                <Bell className="h-4 w-4" />
                                <span className="hidden lg:inline">Acompanhar</span>
                              </Link>
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
    </div>
  );
}
