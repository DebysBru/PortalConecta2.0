'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight, Trash2, AlertTriangle, CheckCircle, Loader2,
  Shield, Database, RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getLimpezaStats, limparTabelas } from '@/actions/admin';
import { LIMPEZA_TABLES } from '@/lib/limpeza-tables';

export default function LimparDadosPage() {
  const { user, isMasterAdmin } = useAuth();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; deleted?: Record<string, number> } | null>(null);
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [confirmEmail, setConfirmEmail] = useState('');

  useEffect(() => {
    getLimpezaStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (!isMasterAdmin) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Acesso Restrito</h1>
        <p className="text-gray-500 mb-6">Apenas o Master Admin pode acessar esta página.</p>
        <Link href="/admin" className="text-azul-eletrico font-semibold hover:underline">
          Voltar ao Dashboard
        </Link>
      </div>
    );
  }

  const totalRegistros = Object.values(stats).reduce((a, b) => a + b, 0);
  const selectedCount = Array.from(selected).reduce((sum, key) => sum + (stats[key] || 0), 0);

  const toggleAll = () => {
    if (selected.size === LIMPEZA_TABLES.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(LIMPEZA_TABLES.map((t) => t.key)));
    }
  };

  const toggleSafe = () => {
    const safeKeys = LIMPEZA_TABLES.filter((t) => t.safe).map((t) => t.key);
    if (safeKeys.every((k) => selected.has(k))) {
      setSelected(new Set(Array.from(selected).filter((k) => !safeKeys.includes(k))));
    } else {
      setSelected(new Set([...Array.from(selected), ...safeKeys]));
    }
  };

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleDelete = async () => {
    if (confirmStep < 2) return;
    if (!confirmEmail) return;

    setDeleting(true);
    setResult(null);

    try {
      const res = await limparTabelas(Array.from(selected), confirmEmail);
      if (res.ok) {
        setResult({ ok: true, message: 'Dados apagados com sucesso!', deleted: res.data?.deleted });
        setSelected(new Set());
        setConfirmStep(0);
        setConfirmEmail('');
        const newStats = await getLimpezaStats();
        setStats(newStats);
      } else {
        setResult({ ok: false, message: res.error });
      }
    } catch {
      setResult({ ok: false, message: 'Erro ao apagar dados' });
    } finally {
      setDeleting(false);
    }
  };

  const safeTables = LIMPEZA_TABLES.filter((t) => t.safe);
  const dangerTables = LIMPEZA_TABLES.filter((t) => !t.safe);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/admin" className="hover:text-azul-eletrico transition-colors">Dashboard</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-900 font-medium">Limpar Dados</span>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Database className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 mb-1">Limpar Dados do Banco</h1>
            <p className="text-gray-500 text-sm">
              Selecione quais tabelas deseja apagar. Útil para limpar o banco antes de ir para produção.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total de registros no banco</p>
            <p className="text-3xl font-black text-gray-900">{totalRegistros.toLocaleString('pt-BR')}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Selecionados para apagar</p>
            <p className={`text-3xl font-black ${selectedCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {selectedCount.toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      </div>

      {result && (
        <div className={`rounded-2xl border p-4 mb-6 flex items-start gap-3 ${
          result.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {result.ok ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <div>
            <p className="font-semibold text-sm">{result.message}</p>
            {result.deleted && (
              <div className="mt-2 text-xs space-y-0.5">
                {Object.entries(result.deleted).map(([key, count]) => {
                  const table = LIMPEZA_TABLES.find((t) => t.key === key);
                  return table ? (
                    <p key={key}>{table.icon} {table.label}: {count} registros apagados</p>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selection controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={toggleAll}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {selected.size === LIMPEZA_TABLES.length ? 'Desmarcar Todas' : 'Marcar Todas'}
        </button>
        <button
          onClick={toggleSafe}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
        >
          Marcar Seguras
        </button>
        <button
          onClick={() => { setSelected(new Set()); setConfirmStep(0); setConfirmEmail(''); setResult(null); }}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Limpar Seleção
        </button>
      </div>

      {/* Tables */}
      <div className="space-y-4 mb-8">
        {/* Safe tables */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 bg-green-50 border-b border-green-100">
            <h2 className="font-bold text-green-800 text-sm">Tabelas Seguras para Limpar</h2>
            <p className="text-xs text-green-600">Dados gerados pelo sistema que podem ser recriados</p>
          </div>
          <div className="divide-y divide-gray-50">
            {safeTables.map((table) => (
              <label
                key={table.key}
                className={`flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selected.has(table.key) ? 'bg-red-50/50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(table.key)}
                  onChange={() => toggle(table.key)}
                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 accent-red-600"
                />
                <span className="text-lg">{table.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{table.label}</p>
                </div>
                <span className={`text-sm font-mono ${stats[table.key] > 0 ? 'text-gray-700' : 'text-gray-300'}`}>
                  {loading ? '...' : (stats[table.key] || 0).toLocaleString('pt-BR')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Danger tables */}
        <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
            <h2 className="font-bold text-red-800 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Tabelas Perigosas
            </h2>
            <p className="text-xs text-red-600">Dados primários — apagar requer confirmação extra</p>
          </div>
          <div className="divide-y divide-gray-50">
            {dangerTables.map((table) => (
              <label
                key={table.key}
                className={`flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selected.has(table.key) ? 'bg-red-50/50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(table.key)}
                  onChange={() => toggle(table.key)}
                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 accent-red-600"
                />
                <span className="text-lg">{table.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{table.label}</p>
                </div>
                <span className={`text-sm font-mono ${stats[table.key] > 0 ? 'text-gray-700' : 'text-gray-300'}`}>
                  {loading ? '...' : (stats[table.key] || 0).toLocaleString('pt-BR')}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Confirm & Delete */}
      {selected.size > 0 && (
        <div className="bg-white rounded-2xl border-2 border-red-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Confirmar Limpeza
          </h3>

          <div className="bg-red-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-800 font-medium">
              Você está prestes a apagar <strong>{selectedCount.toLocaleString('pt-BR')} registros</strong> de{' '}
              <strong>{selected.size} tabela(s)</strong>.
            </p>
            <p className="text-xs text-red-600 mt-1">Esta ação é irreversível.</p>
          </div>

          {confirmStep === 0 && (
            <button
              onClick={() => setConfirmStep(1)}
              className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors"
            >
              Quero apagar estes dados
            </button>
          )}

          {confirmStep === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Tem certeza? Clique novamente para confirmar que deseja apagar os dados selecionados.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmStep(2)}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors"
                >
                  Sim, tenho certeza
                </button>
                <button
                  onClick={() => setConfirmStep(0)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {confirmStep === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Para confirmar, digite o email do master admin:
              </p>
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder="email@ifpr.edu.br"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={!confirmEmail || deleting}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deleting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Apagando...</>
                  ) : (
                    <><Trash2 className="w-4 h-4" /> Apagar Dados</>
                  )}
                </button>
                <button
                  onClick={() => { setConfirmStep(0); setConfirmEmail(''); }}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
