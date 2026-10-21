import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { MascoteInterativa } from '@/components/ifizinha/MascoteInterativa';
import type { NomeMascote } from '@/components/ifizinha/MascoteIFizinha';

type ItemTrilha = { href?: string; label: string };

type PageHeroProps = {
  /** Trilha de navegação: o último item é a página atual (sem link). */
  trilha: ItemTrilha[];
  /** Etiqueta curta acima do título, com a barrinha colorida (ex.: "Oportunidades"). */
  etiqueta: string;
  titulo: string;
  descricao?: string;
  /** Cor do destaque: use as variantes seguras para texto pequeno
   *  (`text-azul-eletrico`, `text-roxo-luminoso`, `text-rosa-600`, `text-ciano-700`). */
  cor?: string;
  icone?: React.ReactNode;
  /** Fundo do quadrado do ícone (ex.: "bg-azul-50"). */
  fundoIcone?: string;
  /**
   * Mascote à direita do cabeçalho, com hover, respiração e balão de dica.
   *
   * Escolha a pose pela **direção do gesto** (ver §29 do DECISIONS): aqui ela
   * fica no canto direito, então só entram poses que olham/gesticulam para a
   * esquerda (`relogio`) ou neutras (`hero`, `chat`, `de-costas`). Poses que
   * gesticulam para a direita (`apontando`, `apresentando`, `projetos`) ficariam
   * apontando para fora da tela.
   *
   * Atenção ao `fundo` da pose em MASCOTES: o cabeçalho é branco, então pose de
   * fundo `cinza` (#F7F7F7) deixaria um retângulo visível.
   */
  mascote?: { nome: NomeMascote; dica?: string };
  /** Chips, estatísticas ou dicas abaixo da descrição. */
  children?: React.ReactNode;
};

/**
 * Cabeçalho das páginas internas.
 *
 * Antes cada página abria com uma faixa escura (`bg-hero-gradient` com texto
 * branco), que era a linguagem da versão antiga do portal. Depois do redesign a
 * marca vive em fundo claro (ver a capa da home), então este componente concentra
 * esse cabeçalho num lugar só: trilha, etiqueta, título, descrição, ícone e o que
 * mais a página precisar (chips de estatística, dica da IFizinha...).
 *
 * O `pt-28` existe porque o Header é `fixed` — sem ele o título fica embaixo do
 * menu. Quem usar este componente já herda isso.
 */
export function PageHero({
  trilha,
  etiqueta,
  titulo,
  descricao,
  cor = 'text-azul-eletrico',
  icone,
  fundoIcone = 'bg-azul-50',
  mascote,
  children,
}: PageHeroProps) {
  return (
    <section className="relative overflow-x-clip border-b border-gray-100 bg-white pt-28 pb-10">
      {/* Mascote do cabeçalho: encosta na borda direita e atravessa a divisão —
          o bloco de conteúdo logo abaixo (que tem fundo próprio e `z-10`) cobre a
          sobra, então ela termina exatamente na divisão em vez de aparecer
          cortada no meio do branco. `overflow-x-clip` corta só a lateral, sem
          criar barra de rolagem. */}
      {mascote && (
        <div className="pointer-events-none absolute bottom-0 right-0 hidden w-[170px] xl:block 2xl:w-[185px]">
          <div className="-mr-6 -mb-10">
            <MascoteInterativa nome={mascote.nome} dica={mascote.dica} />
          </div>
        </div>
      )}

      <div className={`container mx-auto max-w-7xl px-4 ${mascote ? 'xl:pr-[170px] 2xl:pr-[200px]' : ''}`}>
        <nav aria-label="Trilha" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
          {trilha.map((item, i) => (
            <React.Fragment key={`${item.label}-${i}`}>
              {i > 0 && <ChevronRight className="h-4 w-4 text-gray-300" aria-hidden />}
              {item.href ? (
                <Link href={item.href} className="transition-colors hover:text-azul-eletrico">
                  {item.label}
                </Link>
              ) : (
                <span className="font-medium text-gray-900">{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>

        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-6 w-1 rounded-full bg-hero-gradient" aria-hidden />
              <p className={`text-sm font-semibold uppercase tracking-wider ${cor}`}>{etiqueta}</p>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-gray-900 md:text-4xl">{titulo}</h1>

            {descricao && (
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-gray-500 md:text-lg">
                {descricao}
              </p>
            )}

            {children}
          </div>

          {icone && (
            <div
              className={`hidden h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl md:flex ${fundoIcone}`}
              aria-hidden
            >
              {icone}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
