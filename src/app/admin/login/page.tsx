'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Mail, Lock, AlertCircle, User, KeyRound, LogIn, Link2, CheckCircle } from 'lucide-react';
import { useAuth, type SuapProfile } from '@/contexts/AuthContext';
import Image from 'next/image';

type LoginTab = 'suap' | 'email';
type LoginStep = 'login' | 'link_google';

export default function AdminLoginPage() {
  const { user, loading, signIn, signInWithGoogle, signInWithSuap, completeSuapGoogleLink } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<LoginTab>('suap');
  const [step, setStep] = useState<LoginStep>('login');

  // ── SUAP form ──
  const [suapUsername, setSuapUsername] = useState('');
  const [suapPassword, setSuapPassword] = useState('');

  // ── Google link step ──
  const [pendingToken, setPendingToken] = useState('');
  const [suapProfile, setSuapProfile] = useState<SuapProfile | null>(null);

  // ── Email form ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Impede o redirect automático enquanto o vínculo Google está em andamento.
  // signInWithPopup muda o estado Firebase imediatamente — sem esse flag o
  // useEffect abaixo redirecionaria para /admin antes da API salvar o vínculo.
  const linkingInProgress = useRef(false);

  useEffect(() => {
    if (!loading && user && !linkingInProgress.current) router.replace('/admin');
  }, [user, loading, router]);

  // ── Login via SUAP ──
  const handleSuapLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await signInWithSuap(suapUsername.trim(), suapPassword);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.type === 'firebase') {
        router.replace('/admin');
        return;
      }

      if (result.type === 'needs_google_link') {
        // Mostrar tela de vinculação obrigatória com dados do SUAP
        setPendingToken(result.pendingToken);
        setSuapProfile(result.suapProfile);
        setStep('link_google');
        return;
      }

      if (result.type === 'fallback') {
        setError(
          'SUAP verificado, mas Firebase Admin não está configurado. ' +
          'Configure FIREBASE_ADMIN_* no .env.local para login persistente.'
        );
      }
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Completar vínculo Google ──
  const handleCompleteGoogleLink = async () => {
    setError('');
    setSubmitting(true);
    // Bloqueia o useEffect de redirect enquanto a API ainda está salvando o vínculo
    linkingInProgress.current = true;
    try {
      const result = await completeSuapGoogleLink(pendingToken);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Vínculo salvo — agora pode redirecionar
      router.replace('/admin');
    } catch {
      setError('Erro inesperado ao vincular. Tente novamente.');
    } finally {
      linkingInProgress.current = false;
      setSubmitting(false);
    }
  };

  // ── Voltar para login ──
  const handleBackToLogin = () => {
    setStep('login');
    setPendingToken('');
    setSuapProfile(null);
    setError('');
    setSuapPassword('');
  };

  // ── Login via e-mail ──
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace('/admin');
    } catch {
      setError('E-mail ou senha incorretos.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Login via Google ──
  const handleGoogleLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      router.replace('/admin');
    } catch {
      setError('Não foi possível autenticar com o Google.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-hero-gradient flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-dourado-500 animate-sparkle" />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TELA DE VÍNCULO OBRIGATÓRIO COM GOOGLE
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 'link_google' && suapProfile) {
    return (
      <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-dourado-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-glow-dourado">
              ✨
            </div>
            <h1 className="text-2xl font-black text-white">Portal Conecta</h1>
            <p className="text-white/65 text-sm mt-1">Área Administrativa</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">

            {/* Header */}
            <div className="text-center mb-5">
              <div className="w-10 h-10 bg-dourado-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Link2 className="w-5 h-5 text-dourado-400" />
              </div>
              <h2 className="text-white font-bold text-lg">Vincule sua conta Google</h2>
              <p className="text-white/55 text-xs mt-1.5 leading-relaxed">
                Para acessar o portal, vincule um e-mail Google à sua conta SUAP.
                Isso facilita o acesso futuro.
              </p>
            </div>

            {/* Card do perfil SUAP */}
            <div className="bg-white/10 rounded-2xl p-4 mb-5 flex items-center gap-3 border border-white/10">
              {suapProfile.fotoUrl ? (
                <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-dourado-500/40 flex-shrink-0">
                  <Image
                    src={suapProfile.fotoUrl}
                    alt={suapProfile.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-dourado-500/30 flex items-center justify-center flex-shrink-0 ring-2 ring-dourado-500/40">
                  <User className="w-6 h-6 text-dourado-300" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{suapProfile.name}</p>
                <p className="text-white/50 text-xs truncate">{suapProfile.email}</p>
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-green-400 text-xs">SUAP verificado</span>
                </div>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="flex items-start gap-2 bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-red-200 text-xs mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Botão vincular Google */}
            <button
              onClick={handleCompleteGoogleLink}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-white/90 text-gray-800 font-semibold py-3 rounded-xl transition-all shadow-sm disabled:opacity-60 text-sm mb-3"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {submitting ? 'Vinculando...' : 'Vincular com Google'}
            </button>

            {/* Voltar */}
            <button
              onClick={handleBackToLogin}
              disabled={submitting}
              className="w-full py-2 text-white/50 hover:text-white/80 text-xs transition-colors disabled:opacity-40"
            >
              ← Voltar e usar outras credenciais SUAP
            </button>
          </div>

          <p className="text-white/40 text-xs text-center mt-6">
            O vínculo é permanente e garante acesso seguro ao portal.
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TELA DE LOGIN PRINCIPAL
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-dourado-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-glow-dourado">
            ✨
          </div>
          <h1 className="text-2xl font-black text-white">Portal Conecta</h1>
          <p className="text-white/65 text-sm mt-1">Área Administrativa</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">

          {/* ── Tabs ── */}
          <div className="flex gap-1 bg-white/10 rounded-xl p-1 mb-5">
            <button
              onClick={() => { setTab('suap'); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === 'suap'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              🏫 Login SUAP
            </button>
            <button
              onClick={() => { setTab('email'); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === 'email'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              ✉️ E-mail
            </button>
          </div>

          {/* ── SUAP Tab ── */}
          {tab === 'suap' && (
            <>
              <p className="text-white/60 text-xs text-center mb-4">
                Use a mesma matrícula e senha do{' '}
                <a href="https://suap.ifpr.edu.br" target="_blank" rel="noopener noreferrer"
                  className="underline text-white/80 hover:text-white">
                  suap.ifpr.edu.br
                </a>
              </p>

              <form onSubmit={handleSuapLogin} className="space-y-3">
                <div>
                  <label className="block text-white/80 text-xs font-medium mb-1.5">
                    Matrícula SUAP
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      value={suapUsername}
                      onChange={(e) => setSuapUsername(e.target.value)}
                      required
                      placeholder="20201IVA..."
                      autoComplete="username"
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dourado-500/50 focus:border-dourado-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-white/80 text-xs font-medium mb-1.5">Senha SUAP</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="password"
                      value={suapPassword}
                      onChange={(e) => setSuapPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      autoComplete="current-password"
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
                  className="w-full flex items-center justify-center gap-2 bg-dourado-500 hover:bg-dourado-400 text-gray-900 font-bold py-3 rounded-xl transition-all shadow-glow-dourado disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                >
                  <LogIn className="w-4 h-4" />
                  {submitting ? 'Verificando...' : 'Entrar com SUAP'}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-transparent px-3 text-white/40 text-xs">ou acesso direto</span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 bg-white/15 hover:bg-white/25 text-white font-semibold py-3 rounded-xl transition-all text-sm disabled:opacity-60 border border-white/20"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Entrar com Google
              </button>
            </>
          )}

          {/* ── E-mail Tab ── */}
          {tab === 'email' && (
            <>
              {/* Google button */}
              <button
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold py-3 rounded-xl hover:bg-white/90 transition-all mb-4 shadow-sm disabled:opacity-60"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Entrar com Google
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-transparent px-3 text-white/50 text-xs">ou</span>
                </div>
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-4">
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
                      placeholder="••••••••"
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
                  className="w-full bg-dourado-500 hover:bg-dourado-400 text-gray-900 font-bold py-3 rounded-xl transition-all shadow-glow-dourado disabled:opacity-60 text-sm"
                >
                  {submitting ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-white/40 text-xs text-center mt-6">
          Apenas administradores e equipes de projeto autorizados.
        </p>

        <div className="mt-4 text-center space-y-2">
          <Link href="/esqueci-senha" className="text-white/50 hover:text-white/80 text-xs transition-colors block">
            Esqueci minha senha
          </Link>
          <Link href="/cadastro" className="text-dourado-400 hover:text-dourado-300 text-xs font-semibold block">
            Criar nova conta
          </Link>
        </div>
      </div>
    </div>
  );
}
