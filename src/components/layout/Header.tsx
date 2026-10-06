'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Sparkles, BookOpen, FolderOpen, Calendar, ChevronRight, LayoutDashboard, LogIn, LogOut, User, Search, Heart, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { abrirChatIFizinha } from '@/lib/ifizinha-chat';

const navItems = [
  { href: '/editais', label: 'Editais', icon: BookOpen, description: 'Oportunidades traduzidas pela IFizinha' },
  { href: '/projetos', label: 'Projetos', icon: FolderOpen, description: '25+ projetos de extensão ativos' },
  { href: '/agenda', label: 'Agenda', icon: Calendar, description: 'Prazos e eventos do campus' },
  { href: '/busca', label: 'Buscar', icon: Search, description: 'Busca global em projetos, editais e posts' },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, userRole, loading, signOut } = useAuth();

  // Só Admin e Professor têm um painel pra administrar (editais/projetos
  // pro Admin, os próprios projetos pro Professor) — Estudante não tem
  // painel nenhum, então o link nem deve aparecer pra ele.
  const painelHref = userRole === 'ADMIN' ? '/admin' : userRole === 'PROFESSOR' ? '/professor' : null;
  const painelLabel = userRole === 'ADMIN' ? 'Admin' : 'Painel';

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        // Header sempre claro (como no mockup do redesign): antes ele era
        // transparente sobre o hero escuro da home, e agora o logo real da
        // marca (texto azul-marinho) precisa de fundo claro para ler.
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        'bg-white/95 backdrop-blur-md border-b border-gray-100',
        isScrolled && 'shadow-md'
      )}
    >
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo — imagem oficial da marca (símbolo + nome + assinatura) */}
          <Link href="/" className="flex items-center group" aria-label="Portal Conecta — página inicial">
            <Image
              src="/ifizinha/logo-completo.webp"
              alt="Portal Conecta — IFPR Campus Ivaiporã"
              width={1400}
              height={467}
              priority
              unoptimized
              className="h-9 md:h-11 w-auto transition-transform group-hover:scale-[1.03]"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-azul-eletrico/10 text-azul-eletrico'
                      : 'text-gray-600 hover:text-azul-eletrico hover:bg-gray-100'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* CTA + Admin + Mobile Toggle */}
          <div className="flex items-center gap-2">
            <Link
              href="/editais"
              className={cn(
                'hidden md:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                'bg-hero-gradient text-white shadow hover:opacity-90 hover:shadow-md'
              )}
            >
              <Sparkles className="w-4 h-4" />
              Ver Editais
            </Link>

            {/* Abre o chat da IFizinha (o widget vive no layout raiz e escuta
                o evento — ver src/lib/ifizinha-chat.ts). Rótulo só a partir de
                lg para o header não apertar em telas médias. */}
            <button
              type="button"
              onClick={abrirChatIFizinha}
              title="Pergunte à IFizinha"
              aria-label="Pergunte à IFizinha — abrir o chat"
              className="hidden md:flex items-center gap-1.5 px-3 lg:px-4 py-2 rounded-lg text-sm font-semibold text-white bg-rosa-vibrante hover:bg-rosa-600 shadow transition-all"
            >
              <MessageCircle className="w-4 h-4 flex-shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">Pergunte à IFizinha</span>
            </button>

            {/* Admin / Login button */}
            {!loading && (
              user ? (
                <div className="flex items-center gap-1">
                  <NotificationBell tom="claro" />
                  <Link
                    href="/minha-area"
                    title="Minha área: favoritos, notificações e alertas"
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all',
                      'text-gray-600 hover:text-azul-eletrico hover:bg-gray-100'
                    )}
                  >
                    <Heart className="w-4 h-4" />
                    <span className="hidden md:inline">Minha área</span>
                  </Link>
                  <Link
                    href="/meus-dados"
                    title="Meus Dados"
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all',
                      'text-gray-600 hover:text-azul-eletrico hover:bg-gray-100'
                    )}
                  >
                    <span className="hidden md:inline">Meus Dados</span>
                  </Link>
                  {painelHref && (
                    <Link
                      href={painelHref}
                      title={painelLabel === 'Admin' ? 'Painel Admin' : 'Painel do Professor'}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all',
                        'text-gray-600 hover:text-azul-eletrico hover:bg-gray-100'
                      )}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span className="hidden md:inline">{painelLabel}</span>
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    title="Sair"
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all',
                      'text-gray-600 hover:text-red-600 hover:bg-red-50'
                    )}
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden md:inline">Sair</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/admin/login"
                  title="Entrar"
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    'text-gray-500 hover:text-azul-eletrico hover:bg-gray-100'
                  )}
                >
                  <LogIn className="w-4 h-4" />
                </Link>
              )
            )}

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                'md:hidden p-2 rounded-lg transition-colors',
                'text-gray-700 hover:bg-gray-100'
              )}
              aria-label="Abrir menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-xl">
          <div className="container mx-auto px-4 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl transition-all',
                    isActive
                      ? 'bg-azul-eletrico/10 text-azul-eletrico'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center',
                        isActive ? 'bg-azul-eletrico text-white' : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              );
            })}

            {/* Conta */}
            {!loading && (
              <div className="pt-2 mt-2 border-t border-gray-100 space-y-1">
                {user ? (
                  <>
                    <Link
                      href="/minha-area"
                      className="flex items-center gap-3 p-4 rounded-xl text-gray-700 hover:bg-gray-50 transition-all"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center">
                        <Heart className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-sm">Minha área</p>
                    </Link>
                    <Link
                      href="/meus-dados"
                      className="flex items-center gap-3 p-4 rounded-xl text-gray-700 hover:bg-gray-50 transition-all"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center">
                        <User className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-sm">Meus Dados</p>
                    </Link>
                    {painelHref && (
                      <Link
                        href={painelHref}
                        className="flex items-center gap-3 p-4 rounded-xl text-gray-700 hover:bg-gray-50 transition-all"
                      >
                        <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center">
                          <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <p className="font-semibold text-sm">{painelLabel === 'Admin' ? 'Painel Admin' : 'Painel do Professor'}</p>
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 p-4 rounded-xl text-red-600 hover:bg-red-50 transition-all w-full"
                    >
                      <div className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
                        <LogOut className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-sm">Sair</p>
                    </button>
                  </>
                ) : (
                  <Link
                    href="/admin/login"
                    className="flex items-center gap-3 p-4 rounded-xl text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center">
                      <LogIn className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-sm">Entrar</p>
                  </Link>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-gray-100 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  abrirChatIFizinha();
                }}
                className="flex items-center justify-center gap-2 w-full p-4 rounded-xl bg-rosa-vibrante text-white font-semibold"
              >
                <MessageCircle className="w-5 h-5" />
                Pergunte à IFizinha
              </button>
              <Link
                href="/editais"
                className="flex items-center justify-center gap-2 w-full p-4 rounded-xl bg-hero-gradient text-white font-semibold"
              >
                <Sparkles className="w-5 h-5" />
                Ver todos os Editais
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
