import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, BookOpen, FolderOpen, Calendar, GraduationCap, ArrowRight, Rocket } from 'lucide-react';
import { MascoteIFizinha } from '@/components/ifizinha/MascoteIFizinha';

interface HeroIFizinhaProps {
  config?: Record<string, any>;
}

/**
 * Etiquetas da capa. São atalhos reais (não decoração): cada uma leva para a
 * área correspondente do portal. "Bolsas" aponta para /editais porque é lá que
 * as bolsas aparecem (o filtro de categoria daquela página tem "Bolsas").
 */
const ETIQUETAS = [
  { href: '/editais', rotulo: 'Editais', icone: BookOpen, classe: 'text-azul-eletrico' },
  { href: '/projetos', rotulo: 'Projetos', icone: FolderOpen, classe: 'text-roxo-luminoso' },
  { href: '/agenda', rotulo: 'Agenda', icone: Calendar, classe: 'text-rosa-vibrante' },
  { href: '/editais', rotulo: 'Bolsas', icone: GraduationCap, classe: 'text-ciano-claro' },
];

/**
 * Capa da home.
 *
 * Antes era um gradiente escuro de tela cheia com um card de chat. Agora é
 * claro, com a foto do campus à direita e a IFizinha na frente — como no mockup
 * do redesign (DOCUMENTACAO/REDESIGN_IFIZINHA.md).
 *
 * Sobre a mascote: ela fica ancorada na **borda direita e no rodapé da seção**
 * (o recorte do arquivo termina na altura da cintura, então alinhar o fundo da
 * imagem com o fim da seção faz ela "sair" de dentro da capa, em vez de parecer
 * uma figura solta flutuando no meio do texto).
 *
 * Os textos continuam vindo do `siteConfig` (admin → Configurações): se o
 * responsável já tiver trocado o título, ele continua valendo.
 */
export function HeroIFizinha({ config = {} }: HeroIFizinhaProps) {
  const titulo = config.hero_titulo || 'Tudo do IFPR.';
  const subtitulo = config.hero_subtitulo || 'Só que explicado direto.';
  const ctaEditais = config.hero_cta_editais || 'Ver oportunidades';
  const ctaProjetos = config.hero_cta_projetos || 'Explorar projetos';

  return (
    <section className="relative overflow-hidden bg-white">
      {/* Foto do campus (lg+): fica atrás da mascote, com véu branco da esquerda
          para a direita, senão o texto perde contraste. */}
      <div className="absolute inset-y-0 right-0 hidden w-[64%] lg:block" aria-hidden>
        <Image
          src="/ifizinha/banner-campus-3.webp"
          alt=""
          fill
          priority
          unoptimized
          sizes="64vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-white/10" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </div>

      <div className="relative container mx-auto max-w-7xl px-4 pt-24 md:pt-28">
        <div className="grid items-end gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-4">
          {/* Texto */}
          <div className="pb-10 lg:pb-24">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 mb-4">
              Informação · Oportunidades · Vida no campus
            </p>

            <h1 className="text-4xl md:text-5xl lg:text-[3.4rem] font-black leading-[1.05] tracking-tight text-gray-900 mb-5">
              {titulo}
              <br />
              {/* `.text-gradient` já recorta o gradiente no texto (ver globals.css) */}
              <span className="text-gradient">{subtitulo}</span>
            </h1>

            <p className="text-gray-600 text-base md:text-lg leading-relaxed mb-6 max-w-[34rem]">
              Editais, projetos, oportunidades e datas importantes do campus em um só lugar —
              com a <strong className="font-semibold text-gray-800">IFizinha</strong> traduzindo
              o burocrátês para você.
            </p>

            {/* Etiquetas de atalho */}
            <div className="flex flex-wrap gap-2 mb-8">
              {ETIQUETAS.map(({ href, rotulo, icone: Icone, classe }) => (
                <Link
                  key={rotulo}
                  href={href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow"
                >
                  <Icone className={`w-4 h-4 ${classe}`} />
                  {rotulo}
                </Link>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/editais"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-hero-gradient px-7 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:opacity-95 hover:shadow-xl active:scale-[0.98]"
              >
                <Rocket className="w-5 h-5 flex-shrink-0" />
                {ctaEditais}
              </Link>
              <Link
                href="/projetos"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-base font-semibold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md active:scale-[0.98]"
              >
                <FolderOpen className="w-5 h-5 flex-shrink-0" />
                {ctaProjetos}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Mascote: ancorada no fim da seção e encostando na borda direita */}
          <div className="relative flex justify-center lg:justify-end lg:pt-12">
            {/* Balão de fala: fica à esquerda da cabeça dela, para não cobrir o rosto */}
            <div className="pointer-events-none absolute left-0 top-0 hidden max-w-[210px] rounded-2xl rounded-bl-sm border border-gray-100 bg-white/95 px-4 py-3 text-sm font-medium text-gray-700 shadow-lg backdrop-blur xl:block">
              <Sparkles className="mb-1 h-4 w-4 text-dourado-500" />
              Conectando você com o que importa!
            </div>

            <div className="w-[240px] sm:w-[300px] lg:w-[400px] xl:w-[440px] lg:-mr-8">
              <MascoteIFizinha
                nome="hero"
                prioridade
                className="drop-shadow-[0_18px_35px_rgba(15,23,42,0.18)]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
