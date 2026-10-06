'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail, AlertCircle, Loader2, CheckCircle, Sparkles, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { MENSAGENS, mensagemAmigavel } from '@/lib/mensagens';

export default function EsqueciSenhaPage() {
  const { user, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-azul-eletrico animate-sparkle" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 pt-24">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Você já está logado</h1>
          <Link href="/admin" className="text-azul-eletrico hover:text-azul-700 font-semibold text-sm">
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

    // Mensagem de sucesso sempre igual, exista ou não conta com esse e-mail —
    // revelar "não encontramos uma conta" permite enumerar quais e-mails
    // estão cadastrados no sistema (achado S16).
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/admin/login`,
      });
      setSuccess(MENSAGENS.emailEnviado);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setSuccess(MENSAGENS.emailEnviado);
      } else if (err.code === 'auth/invalid-email') {
        setError(MENSAGENS.emailInvalido);
      } else {
        setError(mensagemAmigavel(err, MENSAGENS.falhaEnvioEmail));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // `pt-24` porque o Header é `fixed` (o PublicWrapper monta Header/Footer em
  // qualquer rota que não seja /admin).
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 pt-24">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block" aria-label="Portal Conecta — página inicial">
            <Image
              src="/ifizinha/logo-completo.webp"
              alt="Portal Conecta — IFPR Campus Ivaiporã"
              width={1400}
              height={467}
              unoptimized
              className="mx-auto mb-4 h-10 w-auto"
            />
          </Link>
          <h1 className="text-2xl font-black text-gray-900">Esqueci Minha Senha</h1>
          <p className="text-gray-500 text-sm mt-1">Enviaremos um link de recuperação</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl">
          {success && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-xs mb-4">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {success}
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-field">E-mail cadastrado</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="seu@email.com"
                    className="input-field !pl-9"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-hero-gradient hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all shadow-card-brand disabled:opacity-60 text-sm"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Enviar Link de Recuperação'}
              </button>
            </form>
          )}

          {success && (
            <button
              onClick={() => { setSuccess(''); setEmail(''); }}
              className="w-full py-2 text-gray-500 hover:text-gray-900 text-xs transition-colors"
            >
              Enviar para outro e-mail
            </button>
          )}
        </div>

        <div className="text-center mt-6">
          <Link href="/admin/login" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-xs transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
