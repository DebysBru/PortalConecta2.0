'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail, Lock, User, AlertCircle, Loader2, CheckCircle, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ensureUser } from '@/actions/admin';

export default function CadastroPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-hero-gradient flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-dourado-500 animate-sparkle" />
      </div>
    );
  }

  if (user) {
    router.replace('/admin');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await ensureUser(email, name);
      setSuccess('Conta criada com sucesso! Redirecionando...');
      setTimeout(() => router.replace('/admin'), 1500);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado.');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else if (err.code === 'auth/weak-password') {
        setError('Senha muito fraca. Use pelo menos 6 caracteres.');
      } else {
        setError('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <div className="w-16 h-16 bg-dourado-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-glow-dourado">
              ✨
            </div>
          </Link>
          <h1 className="text-2xl font-black text-white">Criar Conta</h1>
          <p className="text-white/65 text-sm mt-1">Portal Conecta IFPR</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
          {success && (
            <div className="flex items-start gap-2 bg-green-500/20 border border-green-400/30 rounded-xl p-3 text-green-200 text-xs mb-4">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/80 text-xs font-medium mb-1.5">Nome completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Seu nome"
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dourado-500/50 focus:border-dourado-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-white/80 text-xs font-medium mb-1.5">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dourado-500/50 focus:border-dourado-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-white/80 text-xs font-medium mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dourado-500/50 focus:border-dourado-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-white/80 text-xs font-medium mb-1.5">Confirmar senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repita a senha"
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dourado-500/50 focus:border-dourado-500/50"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-red-200 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-dourado-500 hover:bg-dourado-400 text-gray-900 font-bold py-3 rounded-xl transition-all shadow-glow-dourado disabled:opacity-60 text-sm"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : 'Criar Conta'}
            </button>
          </form>
        </div>

        <p className="text-white/50 text-xs text-center mt-6">
          Já tem conta?{' '}
          <Link href="/admin/login" className="text-dourado-400 hover:text-dourado-300 font-semibold">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
