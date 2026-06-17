'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, Search, Download, ChevronRight, Eye,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { listMyProjetos, listInscricoes, updateInscricaoStatus, exportInscricoesCSV } from '@/actions/professor';
import { formatDateShort } from '@/lib/utils';
import { Prisma } from '@prisma/client';

type Projeto = Awaited<ReturnType<typeof listMyProjetos>>[number];
type Inscricao = Prisma.InscricaoGetPayload<{}>;

export default function ProfessorInscricoesPage() {
  const { user } = useAuth();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [selectedProjeto, setSelectedProjeto] = useState<string>('');
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInscricoes, setLoadingInscricoes] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  useEffect(() => {
    if (!user?.email) return;
    listMyProjetos(user.email)
      .then((p) => {
        setProjetos(p);
        if (p.length > 0) setSelectedProjeto(p[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!selectedProjeto || !user?.email) return;
    setLoadingInscricoes(true);
    listInscricoes(selectedProjeto, user.email)
      .then((result) => {
        if (result && 'data' in result && Array.isArray(result.data)) setInscricoes(result.data);
        else setInscricoes([]);
      })
      .catch(() => setInscricoes([]))
      .finally(() => setLoadingInscricoes(false));
  }, [selectedProjeto, user]);

  const handleStatusChange = async (inscricaoId: string, newStatus: string) => {
    const result = await updateInscricaoStatus(inscricaoId, newStatus);
    if (result.ok) {
      setInscricoes((prev) =>
        prev.map((i) => (i.id === inscricaoId ? { ...i, status: newStatus } : i))
      );
    }
  };

  const handleExport = async () => {
    if (!selectedProjeto) return;
    const projeto = projetos.find((p) => p.id === selectedProjeto);
    const csv = await exportInscricoesCSV(selectedProjeto);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscricoes-${projeto?.slug ?? 'projeto'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = inscricoes.filter((i) => {
    const matchesSearch =
      i.nome_completo.toLowerCase().includes(search.toLowerCase()) ||
      i.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 text-sm">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Inscrições</h1>
        <p className="text-gray-500 text-sm">Gerencie as inscrições dos seus projetos</p>
      </div>

      {/* Seletor de projeto */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Selecionar Projeto</label>
        <select
          value={selectedProjeto}
          onChange={(e) => setSelectedProjeto(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico bg-white"
        >
          {projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({p._count?.inscricoes ?? 0} inscritos)
            </option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-gray-900">
            Inscrições ({filtered.length})
          </h2>
          <button
            onClick={handleExport}
            disabled={!selectedProjeto}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>

        {/* Filtros */}
        <div className="px-5 py-3 border-b border-gray-50 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['todos', 'recebida', 'em_analise', 'selecionado', 'nao_selecionado'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-azul-eletrico text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === 'todos' ? 'Todos' : s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {loadingInscricoes ? (
          <div className="text-center py-12 text-gray-400 text-sm">Carregando inscrições...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma inscrição encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                  <th className="px-5 py-3 font-medium">Protocolo</th>
                  <th className="px-5 py-3 font-medium">Inscrito</th>
                  <th className="px-5 py-3 font-medium">Curso</th>
                  <th className="px-5 py-3 font-medium">Tipo</th>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{i.protocolo}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{i.nome_completo}</p>
                      <p className="text-xs text-gray-500">{i.email}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{i.curso ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{i.tipo_interesse}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{formatDateShort(i.created_at)}</td>
                    <td className="px-5 py-3">
                      <select
                        value={i.status}
                        onChange={(e) => handleStatusChange(i.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-azul-eletrico/30"
                      >
                        <option value="recebida">Recebida</option>
                        <option value="em_analise">Em análise</option>
                        <option value="selecionado">Selecionado</option>
                        <option value="lista_espera">Lista espera</option>
                        <option value="nao_selecionado">Não selecionado</option>
                        <option value="desistente">Desistente</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
