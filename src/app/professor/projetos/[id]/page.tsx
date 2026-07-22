'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight, Users, FolderOpen, Calendar, Mail,
  Download, Search, Filter, AlertCircle, CheckCircle,
  Clock, XCircle, Eye, ArrowLeft, FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getProjetoDetalhes, listInscricoes, updateInscricaoStatus, exportInscricoesCSV, toggleInscricoes } from '@/actions/professor';
import { getStatusLabel, getStatusColor, formatDateShort } from '@/lib/utils';
import { Prisma } from '@prisma/client';

type Projeto = NonNullable<Awaited<ReturnType<typeof getProjetoDetalhes>>>;
type Inscricao = Prisma.InscricaoGetPayload<{}>;

export default function ProfessorProjetoDetalhePage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const router = useRouter();
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.email) return;
    getProjetoDetalhes(params.id, user.email)
      .then((p) => {
        if (!p) { router.replace('/professor'); return; }
        setProjeto(p);
        return listInscricoes(params.id, user.email!);
      })
      .then((result) => {
        if (result && 'data' in result && Array.isArray(result.data)) setInscricoes(result.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, params.id, router]);

  const handleStatusChange = async (inscricaoId: string, newStatus: string) => {
    const result = await updateInscricaoStatus(inscricaoId, newStatus);
    if (result.ok) {
      setInscricoes((prev) =>
        prev.map((i) => (i.id === inscricaoId ? { ...i, status: newStatus } : i))
      );
    }
  };

  const handleExport = async () => {
    if (!projeto) return;
    const csv = await exportInscricoesCSV(projeto.id);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscricoes-${projeto.slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleInscricoes = async () => {
    if (!projeto || !user?.email) return;
    const result = await toggleInscricoes(projeto.id, user.email);
    if (result.ok && 'data' in result && result.data) {
      setProjeto({ ...projeto, inscricoes_abertas: result.data.inscricoes_abertas });
    }
  };

  const filtered = inscricoes.filter((i) => {
    const matchesSearch =
      i.nome_completo.toLowerCase().includes(search.toLowerCase()) ||
      i.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = inscricoes.reduce(
    (acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 text-sm">Carregando detalhes...</div>
      </div>
    );
  }

  if (!projeto) return null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/professor" className="hover:text-azul-eletrico transition-colors">Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/professor/projetos" className="hover:text-azul-eletrico transition-colors">Projetos</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{projeto.nome}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div
          className="h-24 relative flex items-end p-6"
          style={{ background: `linear-gradient(135deg, ${projeto.corPrimaria} 0%, ${projeto.corPrimaria}cc 100%)` }}
        >
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white font-black text-2xl border border-white/30">
            {projeto.nome.charAt(0)}
          </div>
          <div className="ml-4 flex-1">
            <h1 className="text-2xl font-black text-white">{projeto.nome}</h1>
            <p className="text-white/80 text-sm">{projeto.area}</p>
          </div>
          <span className="text-white/80 text-xs bg-black/20 rounded-full px-3 py-1 font-medium">
            {getStatusLabel(projeto.status)}
          </span>
        </div>

        {/* Ações rápidas */}
        <div className="px-6 py-3 border-b border-gray-50 flex gap-2">
          <Link
            href={`/professor/projetos/${params.id}/posts`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Gerenciar Posts
          </Link>
          <button
            onClick={handleToggleInscricoes}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              projeto.inscricoes_abertas
                ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {projeto.inscricoes_abertas ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Inscrições Abertas
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" />
                Inscrições Fechadas
              </>
            )}
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 text-sm leading-relaxed mb-4">{projeto.descricao}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-1">Coordenador</p>
              <p className="font-medium text-gray-900">{projeto.coordenador}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Email</p>
              <p className="font-medium text-gray-900">{projeto.coordenadorEmail}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Vagas</p>
              <p className="font-medium text-gray-900">
                {projeto.vagasBolsista} bolsista{projeto.vagasVoluntario > 0 ? ` / ${projeto.vagasVoluntario} voluntário` : ''}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Inscrições</p>
              <p className="font-medium text-gray-900">{projeto.status === 'INSCRICOES_ABERTAS' ? 'Abertas' : 'Fechadas'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Inscritos */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-gray-900">Inscrições ({inscricoes.length})</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>
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
                {s !== 'todos' && statusCounts[s] ? ` (${statusCounts[s]})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma inscrição encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                  <th className="px-5 py-3 font-medium">Inscrito</th>
                  <th className="px-5 py-3 font-medium">Curso</th>
                  <th className="px-5 py-3 font-medium">Tipo</th>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((inscricao) => (
                  <tr key={inscricao.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{inscricao.nome_completo}</p>
                      <p className="text-xs text-gray-500">{inscricao.email}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{inscricao.curso ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{inscricao.tipo_interesse}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {formatDateShort(inscricao.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={inscricao.status}
                        onChange={(e) => handleStatusChange(inscricao.id, e.target.value)}
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
                    <td className="px-5 py-3">
                      <button
                        onClick={() => {
                          const detail = JSON.stringify({
                            protocolo: inscricao.protocolo,
                            nome: inscricao.nome_completo,
                            email: inscricao.email,
                            telefone: inscricao.telefone,
                            curso: inscricao.curso,
                            turma: inscricao.turma,
                            semestre: inscricao.semestre,
                            justificativa: inscricao.justificativa,
                            experiencia: inscricao.experiencia_previa,
                          }, null, 2);
                          alert(detail);
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FAQ */}
      {projeto.faq.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">FAQ do Projeto</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {projeto.faq.map((faq) => (
              <div key={faq.id} className="px-5 py-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">{faq.pergunta}</p>
                <p className="text-gray-600 text-sm">{faq.resposta}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
