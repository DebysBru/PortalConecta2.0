'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  User, Mail, Shield, FolderOpen, Calendar,
  Pencil, Check, X, AlertCircle, Loader2,
  Link2, Link2Off, Trash2, RefreshCw, CheckCircle,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithPopup, GoogleAuthProvider, signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getMyProfile, updateMyName, deleteMyAccount } from '@/actions/perfil';
import { UserRole } from '@prisma/client';

// ── Tipos ──────────────────────────────────────────────────────────────────────

type Profile = Awaited<ReturnType<typeof getMyProfile>>;

// ── Helpers ────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<UserRole, string> = {
  ESTUDANTE: 'Estudante',
  PROFESSOR: 'Professor',
  ADMIN: 'Administrador',
};

const ROLE_COLOR: Record<UserRole, string> = {
  ESTUDANTE:       'bg-gray-100 text-gray-600',
  PROFESSOR:       'bg-blue-100 text-blue-700',
  ADMIN:           'bg-amber-100 text-amber-700',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="font-semibold text-gray-800 text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatusBadge({ ok, message }: { ok: boolean; message: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium mt-2 ${ok ? 'text-green-600' : 'text-red-600'}`}>
      {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
      {message}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function PerfilPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // ── Edição de nome ──
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameStatus, setNameStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Revinculação Google ──
  const [relinkStatus, setRelinkStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [relinking, setRelinking] = useState(false);

  // ── Exclusão de conta ──
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Carregar perfil ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.email) return;
    getMyProfile(user.email).then((p) => {
      setProfile(p);
      setNameValue(p?.name ?? '');
      setLoadingProfile(false);
    });
  }, [user?.email]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  // ── Salvar nome ──────────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!user?.email) return;
    setSavingName(true);
    setNameStatus(null);
    const res = await updateMyName(user.email, nameValue);
    setSavingName(false);
    if (res.ok) {
      setProfile((p) => p ? { ...p, name: nameValue.trim() } : p);
      setEditingName(false);
      setNameStatus({ ok: true, msg: 'Nome atualizado!' });
      setTimeout(() => setNameStatus(null), 3000);
    } else {
      setNameStatus({ ok: false, msg: res.error });
    }
  };

  const handleCancelName = () => {
    setEditingName(false);
    setNameValue(profile?.name ?? '');
    setNameStatus(null);
  };

  // ── Revincular Google ────────────────────────────────────────────────────────
  const handleRelinkGoogle = async () => {
    if (!user?.email) return;
    setRelinking(true);
    setRelinkStatus(null);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseIdToken = await result.user.getIdToken();

      const res = await fetch('/api/auth/relink-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentEmail: user.email, firebaseIdToken }),
      });

      const data = await res.json() as { customToken?: string; newEmail?: string; error?: string };

      if (!res.ok) {
        setRelinkStatus({ ok: false, msg: data.error ?? 'Erro ao revincular.' });
        return;
      }

      // Re-autenticar com custom token SUAP (se disponível)
      if (data.customToken) {
        await signInWithCustomToken(auth, data.customToken);
      }

      setProfile((p) => p ? { ...p, email: data.newEmail ?? p.email, googleLinked: true } : p);
      setRelinkStatus({ ok: true, msg: `Novo e-mail vinculado: ${data.newEmail}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido.';
      if (msg.includes('popup-closed') || msg.includes('cancelled')) {
        setRelinkStatus({ ok: false, msg: 'Operação cancelada.' });
      } else {
        setRelinkStatus({ ok: false, msg: msg });
      }
    } finally {
      setRelinking(false);
    }
  };

  // ── Excluir conta ────────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!user?.email) return;
    setDeleting(true);
    setDeleteError('');

    try {
      // 1. Tentar deletar do Firebase Admin (best-effort)
      try {
        const idToken = await user.getIdToken();
        await fetch('/api/auth/delete-firebase-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firebaseIdToken: idToken }),
        });
      } catch { /* ignora */ }

      // 2. Deletar do banco
      const res = await deleteMyAccount(user.email);
      if (!res.ok) {
        setDeleteError(res.error);
        setDeleting(false);
        return;
      }

      // 3. Sign out e redirecionar
      await signOut();
      router.replace('/admin/login');
    } catch {
      setDeleteError('Erro inesperado. Tente novamente.');
      setDeleting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-gray-500">Não foi possível carregar o perfil.</p>
      </div>
    );
  }

  const avatarSrc = user?.photoURL ?? profile.suapFoto ?? null;
  const initials  = (profile.name ?? profile.email ?? '?').charAt(0).toUpperCase();

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Meu Perfil</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie suas informações e configurações de conta.</p>
      </div>

      {/* ── Card identidade ── */}
      <div className="bg-hero-gradient rounded-2xl p-5 flex items-center gap-4 shadow-sm">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {avatarSrc ? (
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-white/30">
              <Image src={avatarSrc} alt={profile.name ?? ''} fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white font-black text-2xl ring-2 ring-white/30">
              {initials}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-bold text-lg leading-tight truncate">
              {profile.name ?? 'Sem nome'}
            </p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLOR[profile.role]}`}>
              {ROLE_LABEL[profile.role]}
            </span>
          </div>
          <p className="text-white/65 text-sm truncate mt-0.5">{profile.email}</p>
          {profile.suapUsername && (
            <p className="text-white/50 text-xs mt-1 flex items-center gap-1">
              <span className="text-white/40">SUAP:</span> {profile.suapUsername}
            </p>
          )}
        </div>
      </div>

      {/* ── Informações pessoais ── */}
      <Section title="Informações Pessoais">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Nome de exibição</label>
          <div className="flex items-center gap-2">
            {editingName ? (
              <>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelName(); }}
                  maxLength={80}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-azul-eletrico/40"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-azul-eletrico text-white hover:bg-azul-eletrico/90 disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleCancelName}
                  disabled={savingName}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <p className="flex-1 text-sm text-gray-800 font-medium py-2">
                  {profile.name ?? <span className="text-gray-400 italic">Sem nome</span>}
                </p>
                <button
                  onClick={() => { setEditingName(true); setNameStatus(null); }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          {nameStatus && <StatusBadge ok={nameStatus.ok} message={nameStatus.msg} />}
        </div>

        {/* Membro desde */}
        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 text-xs text-gray-400">
          <Calendar className="w-3.5 h-3.5" />
          Membro desde {new Date(profile.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </div>
      </Section>

      {/* ── Conta SUAP (só aparece se tiver SUAP) ── */}
      {profile.suapUsername && (
        <Section title="Conta SUAP">
          <div className="flex items-center gap-3">
            {profile.suapFoto ? (
              <div className="relative w-12 h-12 rounded-xl overflow-hidden ring-1 ring-gray-100 flex-shrink-0">
                <Image src={profile.suapFoto} alt="" fill className="object-cover" unoptimized />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-azul-eletrico/10 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-azul-eletrico" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{profile.suapNome ?? profile.name}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3" /> Matrícula: <span className="font-mono text-gray-600">{profile.suapUsername}</span>
              </p>
              {profile.suapEmail && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Mail className="w-3 h-3" /> {profile.suapEmail}
                </p>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ── Projetos vinculados ── */}
      {profile.projetosAdmin.length > 0 && (
        <Section title={`Projetos (${profile.projetosAdmin.length})`}>
          <div className="space-y-2">
            {profile.projetosAdmin.map((p) => (
              <a
                key={p.id}
                href={`/admin/projetos`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-azul-eletrico/10 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-4 h-4 text-azul-eletrico" />
                </div>
                <span className="flex-1 text-sm text-gray-700 font-medium truncate">{p.nome}</span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* ── E-mail Google vinculado ── */}
      <Section title="E-mail Google vinculado">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <p className="text-sm font-medium text-gray-800 truncate">{profile.email}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1 ml-6">
              {profile.googleLinked
                ? 'Conta Google verificada e vinculada ao SUAP.'
                : 'E-mail de acesso ao portal.'}
            </p>
            {relinkStatus && <div className="ml-6"><StatusBadge ok={relinkStatus.ok} message={relinkStatus.msg} /></div>}
          </div>

          <button
            onClick={handleRelinkGoogle}
            disabled={relinking}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-all flex-shrink-0"
          >
            {relinking
              ? <><Loader2 className="w-4 h-4 animate-spin" />Aguarde...</>
              : <><RefreshCw className="w-4 h-4" />Trocar e-mail</>}
          </button>
        </div>
      </Section>

      {/* ── Zona de perigo ── */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-red-50">
          <h2 className="font-semibold text-red-700 text-sm flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Zona de Perigo
          </h2>
        </div>
        <div className="p-5">
          <p className="text-sm text-gray-500 mb-4">
            Ao excluir sua conta, todos os dados pessoais são removidos permanentemente.
            Posts, editais e eventos criados por você serão mantidos mas ficarão sem autor atribuído.
          </p>
          <button
            onClick={() => { setShowDeleteModal(true); setDeleteConfirm(''); setDeleteError(''); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-sm font-semibold transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Excluir minha conta
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
          ══════════════════════════════════════════════════════════════════════ */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 border border-gray-100">
            {/* Icon */}
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>

            <h3 className="text-lg font-bold text-gray-900 text-center">Excluir conta?</h3>
            <p className="text-sm text-gray-500 text-center mt-2 mb-5 leading-relaxed">
              Esta ação é <strong className="text-gray-700">irreversível</strong>. Para confirmar, digite seu nome abaixo:
            </p>

            {/* Campo de confirmação */}
            <p className="text-xs font-semibold text-gray-600 mb-1.5">
              Digite: <span className="font-mono text-red-600">{profile.name ?? profile.email}</span>
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Digite seu nome para confirmar"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 mb-3"
              autoFocus
            />

            {deleteError && (
              <div className="flex items-center gap-2 text-red-600 text-xs mb-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {deleteError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== (profile.name ?? profile.email)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {deleting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Excluindo...</>
                  : 'Excluir conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
