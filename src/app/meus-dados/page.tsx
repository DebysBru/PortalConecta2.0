'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  User, Mail, Download, AlertCircle, ChevronRight,
  FileText, Clock, CheckCircle, XCircle, Trash2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getMinhasInscricoes, exportMinhasInscricoesCSV, solicitarExclusaoDados } from '@/actions/meus-dados';
import { formatDateShort } from '@/lib/utils';

type Inscricao = Awaited<ReturnType<typeof getMinhasInscricoes>>[number];

const STATUS_COLORS: Record<string, string> = {
  recebida: 'bg-gray-100 text-gray-700',
  em_analise: 'bg-yellow-100 text-yellow-700',
  selecionado: 'bg-green-100 text-green-700',
  lista_espera: 'bg-blue-100 text-blue-700',
  nao_selecionado: 'bg-red-100 text-red-700',
  desistente: 'bg-orange-100 text-orange-700',
};

export default function MeusDadosPage() {
  const { user } = useAuth();
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExclusao, setShowExclusao] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    if (!user?.email) return;
    getMinhasInscricoes(user.email)
      .then(setInscricoes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleExport = async () => {
    if (!user?.email) return;
    const csv = await exportMinhasInscricoesCSV(user.email);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minhas-inscricoes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExclusao = async () => {
    if (!user?.email) return;
    setExcluindo(true);
    try {
      const result = await solicitarExclusaoDados(user.email, motivo);
      if (result.ok) {
        setSucesso(`${result.count} inscrição(ões) marcada(s) como desistente. Seus dados foram anonimizados.`);
        setShowExclusao(false);
        setMotivo('');
        // Recarregar lista
        const updated = await getMinhasInscricoes(user.email);
        setInscricoes(updated);
      }
    } finally {
      setExcluindo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 text-sm">Carregando seus dados...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-hero-gradient pt-24 pb-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-2 text-white/70 text-sm mb-4">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">Meus Dados</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-1">Meus Dados</h1>
          <p className="text-white/80 text-sm">Visualize e gerencie suas inscrições no Portal Conecta</p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-3xl py-8 space-y-6">
        {/* Info do usuário */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-azul-eletrico/10 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-azul-eletrico" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{user?.displayName ?? 'Estudante'}</h2>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={inscricoes.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={() => setShowExclusao(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Solicitar Exclusão
          </button>
        </div>

        {/* Sucesso */}
        {sucesso && (
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            {sucesso}
          </div>
        )}

        {/* Lista de inscrições */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">Suas Inscrições ({inscricoes.length})</h2>
          </div>

          {inscricoes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhuma inscrição encontrada</p>
              <p className="text-sm mt-1">Você ainda não se inscreveu em nenhum projeto.</p>
              <Link href="/projetos" className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-azul-eletrico hover:underline">
                Explorar projetos
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {inscricoes.map((i) => (
                <div key={i.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/projetos/${i.projeto.slug}`}
                          className="font-semibold text-gray-900 text-sm hover:text-azul-eletrico transition-colors"
                        >
                          {i.projeto.nome}
                        </Link>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-400">{i.projeto.area}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="font-mono">{i.protocolo}</span>
                        <span>•</span>
                        <span>{i.tipo_interesse}</span>
                        <span>•</span>
                        <span>{formatDateShort(i.created_at)}</span>
                      </div>
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[i.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {i.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LGPD Info */}
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
          <h3 className="font-bold text-blue-900 text-sm mb-2">Seus Direitos (LGPD)</h3>
          <ul className="text-sm text-blue-700 space-y-1.5">
            <li>• Você pode visualizar todas as suas inscrições</li>
            <li>• Você pode exportar seus dados em formato CSV</li>
            <li>• Você pode solicitar a exclusão dos seus dados</li>
            <li>• Seus dados são tratados conforme a Lei 13.709/2018 (LGPD)</li>
          </ul>
        </div>

        {/* Modal de exclusão */}
        {showExclusao && (
          <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowExclusao(false)} />
            <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Solicitar Exclusão de Dados</h2>
                <button onClick={() => setShowExclusao(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-orange-700">
                      <p className="font-semibold mb-1">Atenção:</p>
                      <p>A solicitação de exclusão irá marcar suas inscrições como "desistente" e anonimizar seus dados pessoais. Esta ação é irreversível.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                  <textarea
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico min-h-[80px] resize-none"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Informe o motivo da exclusão..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowExclusao(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleExclusao}
                    disabled={excluindo}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-all disabled:opacity-60"
                  >
                    {excluindo ? 'Processando...' : 'Confirmar Exclusão'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
