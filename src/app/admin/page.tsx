'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, FolderOpen, Users, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import { getDashboardStats } from '@/actions/admin';
import { useAuth } from '@/contexts/AuthContext';

type Stats = { editaisAtivos: number; projetos: number; usuarios: number; eventos: number };

const STAT_CARDS = [
  { key: 'editaisAtivos', label: 'Editais Ativos', icon: FileText, color: 'text-azul-eletrico', bg: 'bg-azul-eletrico/10', href: '/admin/editais' },
  { key: 'projetos',      label: 'Projetos Ativos', icon: FolderOpen, color: 'text-roxo-luminoso', bg: 'bg-roxo-luminoso/10', href: '/admin/projetos' },
  { key: 'eventos',       label: 'Próximos Eventos', icon: Calendar, color: 'text-rosa-vibrante', bg: 'bg-rosa-vibrante/10', href: '/admin/agenda' },
  { key: 'usuarios',      label: 'Usuários', icon: Users, color: 'text-ciano-claro', bg: 'bg-ciano-claro/10', href: '/admin/usuarios' },
] as const;

export default function AdminDashboardPage() {
  const { user, isMasterAdmin } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(console.error);
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-hero-gradient rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Dashboard</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Bem-vindo de volta, <strong>{user?.displayName ?? user?.email}</strong>
          {isMasterAdmin && <span className="ml-2 text-xs bg-dourado-500/20 text-dourado-700 px-2 py-0.5 rounded-full font-semibold">Master Admin</span>}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, bg, href }) => (
          <Link
            key={key}
            href={href}
            className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-md transition-all group"
          >
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className={`text-3xl font-black ${color}`}>
              {stats ? stats[key] : '—'}
            </p>
            <p className="text-xs text-gray-500 font-medium mt-1">{label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Novo Edital', href: '/admin/editais', color: 'bg-azul-eletrico' },
            { label: 'Novo Projeto', href: '/admin/projetos', color: 'bg-roxo-luminoso' },
            { label: 'Novo Evento', href: '/admin/agenda', color: 'bg-rosa-vibrante' },
            { label: 'Novo Post', href: '/admin/posts', color: 'bg-ciano-claro' },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${action.color}`} />
                <span className="text-sm font-semibold text-gray-700">{action.label}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
