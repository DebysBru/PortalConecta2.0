import React from 'react';
import { Sparkles } from 'lucide-react';
import { MascoteIFizinha, type NomeMascote } from '@/components/ifizinha/MascoteIFizinha';

/**
 * Mascote com vida: respira, reage ao mouse e dá uma dica.
 *
 * Usada nos cabeçalhos das páginas internas (Editais, Projetos, Agenda). É um
 * componente **de servidor**: tudo o que acontece aqui é CSS (hover e animação),
 * então não entra JavaScript nenhum no navegador por causa da mascote.
 *
 * Três camadas, de fora para dentro (cada uma cuida de uma coisa só):
 *   1. `group` + o balão de dica, que aparece no hover;
 *   2. a respiração (`animate-respira`), que **pausa** no hover;
 *   3. o hover em si — sobe 6px, cresce 3% e a sombra fica mais funda e difusa.
 *
 * Acessibilidade: a imagem é decorativa (`aria-hidden`, porque não recebe `alt`),
 * o balão é `aria-hidden` e nada de informação existe só no hover. Com
 * `prefers-reduced-motion`, globals.css desliga animação e transições.
 */
export function MascoteInterativa({
  nome,
  dica,
  prioridade = false,
  className,
}: {
  nome: NomeMascote;
  /** Texto curto do balão. Sem ele, a mascote fica só com respiração e hover. */
  dica?: string;
  prioridade?: boolean;
  className?: string;
}) {
  return (
    // `pointer-events-auto` porque quem posiciona a mascote (PageHero, seções)
    // usa `pointer-events-none` no wrapper para não roubar cliques — sem isso o
    // `:hover` nunca dispara, porque o navegador nem testa o elemento.
    <div className={`group pointer-events-auto relative ${className ?? ''}`}>
      {dica && (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-[44%] right-full mr-3 hidden w-[212px] translate-x-3 rounded-2xl rounded-br-sm border border-gray-100 bg-white/95 px-4 py-3 text-sm font-medium leading-snug text-gray-700 opacity-0 shadow-[0_10px_30px_rgba(15,23,42,0.14)] backdrop-blur transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100 xl:block"
        >
          <Sparkles className="mb-1 h-4 w-4 text-dourado-500" aria-hidden />
          {dica}
        </div>
      )}

      {/* Camada 2: respiração (pausa quando o mouse chega perto) */}
      <div className="animate-respira group-hover:[animation-play-state:paused]">
        {/* Camada 3: o hover — sobe, cresce e ganha sombra mais profunda */}
        <div className="ifizinha-hover transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-hover:scale-[1.03]">
          <MascoteIFizinha
            nome={nome}
            prioridade={prioridade}
            className="ifizinha-hover drop-shadow-[0_10px_18px_rgba(15,23,42,0.10)] transition-[filter] duration-300 ease-out group-hover:drop-shadow-[0_26px_38px_rgba(15,23,42,0.22)]"
          />
        </div>
      </div>
    </div>
  );
}
