'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FolderOpen, Users, FileText, TrendingUp,
  AlertCircle, ChevronRight, Clock, Eye,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getProfessorStats, listMyProjetos } from '@/actions/professor';
import { formatDateShort, getStatusLabel, getStatusColor } from '@/lib/utils';

type Stats = Awaited<ReturnType<typeof getProfessorStats>>;
type Projeto = Awaited<ReturnType<typeof listMyProjetos>>[number];

export default function ProfessorDashboardPage() {
  const { user, userRole } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getProfessorStats(user.email!),
      listMyProjetos(user.email!),
    ])
      .then(([s, p]) => { setStats(s); setProjetos(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 text-sm">Carregando dashboard...</div>
      </div>
    );
  }

  const statCards = [
    { label: 'Meus Projetos', value: stats?.totalProjetos ?? 0, icon: FolderOpen, color: 'text-azul-eletrico', bg: 'bg-azul-eletrico/10' },
    { label: 'Projetos Ativos', value: stats?.projetosAtivos ?? 0, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Inscritos', value: stats?.totalInscritos ?? 0, icon: Users, color: 'text-roxo-luminoso', bg: 'bg-roxo-luminoso/10' },
    { label: 'Inscrições Pendentes', value: stats?.inscricoesPendentes ?? 0, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Olá, {user?.displayName ?? 'Professor'}!</h1>
        <p className="text-gray-500 text-sm">Aqui está o resumo dos seus projetos e inscrições.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Projetos recentes */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Meus Projetos</h2>
          <Link href="/professor/projetos" className="text-sm text-azul-eletrico font-semibold hover:underline">
            Ver todos
          </Link>
        </div>
        {projetos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum projeto encontrado</p>
            <p className="text-sm mt-1">Você não coordena nenhum projeto no momento.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {projetos.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={`/professor/projetos/${p.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: p.corPrimaria }}
                >
                  {p.nome.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{p.nome}</p>
                  <p className="text-xs text-gray-500">{p.area}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(p.status)}`}>
                    {getStatusLabel(p.status)}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">{p._count?.inscricoes ?? 0} inscritos</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
