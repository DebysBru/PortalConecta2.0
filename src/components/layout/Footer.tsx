import React from 'react';
import Link from 'next/link';
import { Sparkles, Heart, ExternalLink, Instagram, Mail, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-300">
      {/* IFizinha CTA */}
      <div className="bg-hero-gradient py-12">
        <div className="container mx-auto px-4 max-w-7xl text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-white/80 text-sm mb-4">
            <Sparkles className="w-4 h-4" />
            Dica da IFizinha
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Nunca perca um edital importante!
          </h2>
          <p className="text-white/80 max-w-xl mx-auto mb-6">
            A IFizinha traduz todos os editais do IFPR para você entender de verdade.
            Confira sempre o edital oficial para ter certeza dos detalhes.
          </p>
          <Link
            href="/editais"
            className="inline-flex items-center gap-2 bg-white text-azul-eletrico font-semibold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors shadow-lg"
          >
            <Sparkles className="w-5 h-5" />
            Ver Editais Abertos
          </Link>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container mx-auto px-4 max-w-7xl py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-hero-gradient flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-white text-lg block leading-none">Portal Conecta</span>
                <span className="text-azul-eletrico text-xs">IFPR Campus Ivaiporã</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4 max-w-sm">
              Centralizando a comunicação institucional do IFPR Campus Ivaiporã.
              Editais, projetos e agenda em um só lugar, traduzidos pela IFizinha.
            </p>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <MapPin className="w-4 h-4 text-azul-eletrico flex-shrink-0" />
              <span>Ivaiporã – PR | Campus IFPR</span>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Navegação</h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: '/', label: 'Início' },
                { href: '/editais', label: 'Editais' },
                { href: '/projetos', label: 'Projetos' },
                { href: '/agenda', label: 'Agenda' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contato</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://ifpr.edu.br/ivaipora"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Site Oficial IFPR
                </a>
              </li>
              <li>
                <a
                  href="mailto:ivaipora@ifpr.edu.br"
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  ivaipora@ifpr.edu.br
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/ifpr.ivaipora"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                  @ifpr.ivaipora
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>
            © {new Date().getFullYear()} Portal Conecta IFPR Ivaiporã. Todos os direitos reservados.
          </p>
          <p className="flex items-center gap-1">
            Desenvolvido com <Heart className="w-3 h-3 text-rosa-vibrante fill-rosa-vibrante" /> pelo{' '}
            <span className="text-azul-eletrico font-medium">Marketing Digital Solidário</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
