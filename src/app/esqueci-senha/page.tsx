'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Mail, AlertCircle, Loader2, CheckCircle, Sparkles, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function EsqueciSenhaPage() {
  const { user, loading } = useAuth();

  const [email, setEmail] = useState('');
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
    return (
      <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Você já está logado</h1>
          <Link href="/admin" className="text-dourado-400 hover:text-dourado-300 font-semibold text-sm">
            Ir para o painel →
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/admin/login`,
      });
      setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('Não encontramos uma conta com este e-mail.');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else {
        setError('Erro ao enviar e-mail. Tente novamente.');
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
          <h1 className="text-2xl font-black text-white">Esqueci Minha Senha</h1>
          <p className="text-white/65 text-sm mt-1">Enviaremos um link de recuperação</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
          {success && (
            <div className="flex items-start gap-2 bg-green-500/20 border border-green-400/30 rounded-xl p-3 text-green-200 text-xs mb-4">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {success}
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-white/80 text-xs font-medium mb-1.5">E-mail cadastrado</label>
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
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Enviar Link de Recuperação'}
              </button>
            </form>
          )}

          {success && (
            <button
              onClick={() => { setSuccess(''); setEmail(''); }}
              className="w-full py-2 text-white/60 hover:text-white text-xs transition-colors"
            >
              Enviar para outro e-mail
            </button>
          )}
        </div>

        <div className="text-center mt-6">
          <Link href="/admin/login" className="inline-flex items-center gap-1.5 text-white/50 hover:text-white/80 text-xs transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
