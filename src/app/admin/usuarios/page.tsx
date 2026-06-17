'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Plus, Trash2, Users, AlertCircle, ShieldCheck } from 'lucide-react';
import { listUsuarios, updateUserRole, deleteUser, inviteUser, listProjetos } from '@/actions/admin';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@prisma/client';
import { formatDateShort } from '@/lib/utils';

type User = Awaited<ReturnType<typeof listUsuarios>>[number];
type Projeto = Awaited<ReturnType<typeof listProjetos>>[number];

const ROLE_LABELS: Record<UserRole, string> = {
  ESTUDANTE: 'Estudante',
  PROFESSOR: 'Professor',
  ADMIN: 'Administrador',
};

const ROLE_COLORS: Record<UserRole, string> = {
  ESTUDANTE: 'bg-gray-100 text-gray-600',
  PROFESSOR: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-dourado-500/20 text-dourado-700',
};

export default function AdminUsuariosPage() {
  const { user: currentUser, isMasterAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('PROFESSOR');
  const [inviteProjetoId, setInviteProjetoId] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const load = () => {
    listUsuarios().then(setUsers).catch(console.error);
    listProjetos().then(setProjetos).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  if (!isMasterAdmin) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-8 text-center">
          <ShieldCheck className="w-10 h-10 text-orange-400 mx-auto mb-3" />
          <h2 className="font-bold text-orange-800">Acesso Restrito</h2>
          <p className="text-orange-600 text-sm mt-1">Apenas o Administrador Master pode gerenciar usuários.</p>
        </div>
      </div>
    );
  }

  const handleRoleChange = (userId: string, role: UserRole) => {
    if (role === 'PROFESSOR') {
      alert('Para atribuir "Professor", por favor utilize o formulário de convite acima para selecionar o projeto.');
      return;
    }
    startTransition(async () => {
      const r = await updateUserRole(userId, role);
      if (r.ok) load(); else setError(r.error);
    });
  };

  const handleDelete = (userId: string) => {
    if (userId === currentUser?.uid) return;
    if (!confirm('Excluir este usuário permanentemente?')) return;
    startTransition(async () => {
      const r = await deleteUser(userId);
      if (r.ok) load(); else setError(r.error);
    });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (inviteRole === 'PROFESSOR' && !inviteProjetoId) {
      setError('Selecione um projeto para o professor.');
      return;
    }
    startTransition(async () => {
      const r = await inviteUser(inviteEmail, inviteRole, inviteRole === 'PROFESSOR' ? inviteProjetoId : undefined);
      if (r.ok) { setInviteEmail(''); setInviteProjetoId(''); load(); } else setError(r.error);
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Usuários</h1>
        <p className="text-gray-500 text-sm">{users.length} usuário(s) registrado(s)</p>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Convidar / Autorizar Usuário
        </h2>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            placeholder="email@exemplo.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="input-field flex-1"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as UserRole)}
            className="input-field sm:w-48"
          >
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          {inviteRole === 'PROFESSOR' && (
            <select
              value={inviteProjetoId}
              onChange={(e) => setInviteProjetoId(e.target.value)}
              className="input-field sm:w-48"
              required
            >
              <option value="">Selecione um Projeto</option>
              {projetos.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="bg-azul-eletrico text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-azul-eletrico/90 transition-all text-sm disabled:opacity-60"
          >
            Autorizar
          </button>
        </form>
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs mt-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {users.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum usuário ainda</p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-gray-50">
              {users.map((u) => {
                const isSelf = u.email === currentUser?.email;
                return (
                  <div key={u.id} className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-azul-eletrico/10 flex items-center justify-center text-azul-eletrico font-bold text-sm flex-shrink-0">
                      {(u.name ?? u.email ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{u.name ?? '—'}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      <div className="mt-1.5">
                        {isSelf ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role]}`}>
                            {ROLE_LABELS[u.role]}
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-azul-eletrico/30"
                          >
                            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        )}
                        {u.role === 'PROFESSOR' && u.projetosAdmin && u.projetosAdmin.length > 0 && (
                          <p className="text-[10px] text-gray-500 mt-1 font-medium bg-gray-50 px-2 py-1 rounded-md inline-block">
                            Projetos: {u.projetosAdmin.map(p => p.nome).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    {!isSelf && (
                      <button onClick={() => handleDelete(u.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Usuário</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Papel</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Desde</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.email === currentUser?.email;
                    return (
                      <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-azul-eletrico/10 flex items-center justify-center text-azul-eletrico font-bold text-sm flex-shrink-0">
                              {(u.name ?? u.email ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{u.name ?? '—'}</p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isSelf ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role]}`}>
                              {ROLE_LABELS[u.role]}
                            </span>
                          ) : (
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-azul-eletrico/30"
                            >
                              {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                              ))}
                            </select>
                          )}
                          {u.role === 'PROFESSOR' && u.projetosAdmin && u.projetosAdmin.length > 0 && (
                            <div className="mt-1">
                              <span className="text-[10px] text-gray-500 font-medium bg-gray-50 px-2 py-0.5 rounded-md">
                                Projetos: {u.projetosAdmin.map(p => p.nome).join(', ')}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDateShort(u.createdAt)}</td>
                        <td className="px-4 py-3">
                          {!isSelf && (
                            <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
