'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Mail, Lock, User, AlertCircle, Loader2, CheckCircle, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ensureUser } from '@/actions/admin';
import { TurnstileWidget } from '@/components/ui/turnstile-widget';
import { MENSAGENS, mensagemAmigavel } from '@/lib/mensagens';

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Marca que a conta acabou de ser criada nesta tela — mantém a mensagem de
  // sucesso visível por um instante antes de seguir para o painel.
  const [contaCriada, setContaCriada] = useState(false);

  // Redireciona quem já está autenticado. Precisa ser em `useEffect`, nunca
  // durante a renderização: `router.replace()` no corpo do componente é
  // navegação durante o render (o React reclama de atualizar outro componente
  // no meio do render e a página cai com "Application error: a client-side
  // exception has occurred").
  //
  // Esperar `loading === false` também garante que o cookie de sessão httpOnly
  // já foi criado pelo AuthContext antes de irmos para /admin — sem isso o
  // layout protegido não vê a sessão e devolve para /admin/login. É a mesma
  // correção aplicada em admin/login e professor/login (ver DECISIONS.md).
  useEffect(() => {
    if (loading || !user) return;
    const timer = setTimeout(() => router.replace('/admin'), contaCriada ? 1500 : 0);
    return () => clearTimeout(timer);
  }, [user, loading, contaCriada, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-azul-eletrico animate-sparkle" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError(MENSAGENS.senhaCurta);
      return;
    }

    if (password !== confirmPassword) {
      setError(MENSAGENS.senhasNaoConferem);
      return;
    }

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
      setError(MENSAGENS.verificacaoSegurancaPendente);
      return;
    }

    setSubmitting(true);
    try {
      const captchaCheck = await fetch('/api/auth/verify-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: captchaToken }),
      });
      if (!captchaCheck.ok) {
        const data = await captchaCheck.json().catch(() => ({}));
        setError(mensagemAmigavel(data.error, MENSAGENS.verificacaoSegurancaFalhou));
        setSubmitting(false);
        return;
      }

      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await ensureUser(email, name);
      setSuccess(MENSAGENS.contaCriada);
      // Quem navega daqui é o useEffect (user + loading), não um timer local:
      // ele só dispara depois que o AuthContext terminou de gravar o cookie de
      // sessão — ver comentário no topo do componente.
      setContaCriada(true);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError(MENSAGENS.emailJaCadastrado);
      } else if (err.code === 'auth/invalid-email') {
        setError(MENSAGENS.emailInvalido);
      } else if (err.code === 'auth/weak-password') {
        setError(MENSAGENS.senhaFraca);
      } else {
        setError(mensagemAmigavel(err, MENSAGENS.erroInesperadoOrientacao));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // `pt-24` porque o Header é `fixed` (o PublicWrapper monta Header/Footer em
  // qualquer rota que não seja /admin) — sem isso o cartão fica embaixo do menu.
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
          <h1 className="text-2xl font-black text-gray-900">Criar Conta</h1>
          <p className="text-gray-500 text-sm mt-1">Portal Conecta IFPR</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl">
          {success && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-xs mb-4">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-field">Nome completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Seu nome"
                  className="input-field !pl-9"
                />
              </div>
            </div>

            <div>
              <label className="label-field">E-mail</label>
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

            <div>
              <label className="label-field">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Mínimo 6 caracteres"
                  className="input-field !pl-9"
                />
              </div>
            </div>

            <div>
              <label className="label-field">Confirmar senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repita a senha"
                  className="input-field !pl-9"
                />
              </div>
            </div>

            <TurnstileWidget onVerify={setCaptchaToken} />

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
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : 'Criar Conta'}
            </button>
          </form>
        </div>

        <p className="text-gray-500 text-xs text-center mt-6">
          Já tem conta?{' '}
          <Link href="/admin/login" className="text-azul-eletrico hover:text-azul-700 font-semibold">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
