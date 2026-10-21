import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Assets da mascote/ilustrações da IFizinha — **já otimizados** por
 * `tools/otimizar-assets-ifizinha.py` (originais de 14,7 MB → ~1,9 MB no total,
 * e cada página carrega só o que usa).
 *
 * `fundo` é a regra de encaixe medida nos originais:
 * - `transparente`: pode ir sobre qualquer fundo (WebP com alfa);
 * - `branco` / `cinza`: o arquivo tem fundo sólido (#FDFDFD/#FEFEFE ≈ branco,
 *   #F7F7F7 ≈ gray-50). Só entra em seção com o mesmo tom, senão aparece um
 *   retângulo. Ver DOCUMENTACAO/REDESIGN_IFIZINHA.md §4.2.
 */
export const MASCOTES = {
  hero: {
    src: '/ifizinha/mascote-hero.webp',
    width: 900,
    height: 1200,
    fundo: 'transparente',
    descricao: 'IFizinha de meio corpo segurando um tablet',
  },
  apresentando: {
    src: '/ifizinha/mascote-apresentando.webp',
    width: 800,
    height: 1000,
    fundo: 'transparente',
    descricao: 'IFizinha apresentando com as duas mãos abertas',
  },
  relogio: {
    src: '/ifizinha/mascote-relogio.webp',
    width: 800,
    height: 1067,
    fundo: 'transparente',
    descricao: 'IFizinha apontando para o relógio de pulso',
  },
  apontando: {
    src: '/ifizinha/mascote-apontando.webp',
    width: 800,
    height: 1000,
    fundo: 'transparente',
    descricao: 'IFizinha apontando para o lado',
  },
  chat: {
    src: '/ifizinha/mascote-chat.webp',
    width: 900,
    height: 675,
    fundo: 'transparente',
    descricao: 'IFizinha deitada, com o queixo apoiado nas mãos',
  },
  'apontando-logo': {
    src: '/ifizinha/pose-apontando-logo.webp',
    width: 800,
    height: 1201,
    fundo: 'cinza',
    descricao: 'IFizinha apontando para o logo na camiseta',
  },
  'de-costas': {
    src: '/ifizinha/pose-de-costas.webp',
    width: 800,
    height: 1000,
    fundo: 'branco',
    descricao: 'IFizinha de costas, apontando para o logo nas costas da camiseta',
  },
  neutra: {
    src: '/ifizinha/pose-neutra.webp',
    width: 800,
    height: 1200,
    fundo: 'cinza',
    descricao: 'IFizinha de frente, com os braços ao lado do corpo',
  },
  editais: {
    src: '/ifizinha/pose-editais.webp',
    width: 800,
    height: 800,
    fundo: 'branco',
    descricao: 'IFizinha com uma prancheta na mão fazendo sinal de positivo',
  },
  projetos: {
    src: '/ifizinha/pose-projetos.webp',
    width: 800,
    height: 800,
    fundo: 'cinza',
    descricao: 'IFizinha apresentando com as mãos abertas',
  },
  prazos: {
    src: '/ifizinha/pose-prazos.webp',
    width: 800,
    height: 1067,
    fundo: 'cinza',
    descricao: 'IFizinha apontando para o relógio de pulso',
  },
  // ── Poses em JPEG com o fundo recortado ────────────────────────────────────
  // As poses acima (`cinza`/`branco`) vêm de fotos de estúdio: o fundo é sólido
  // (#FEFEFE, #F7F7F7...) e sobre uma faixa branca aparece como uma caixinha —
  // 1-2 níveis de diferença já são visíveis e o WebP ainda cria bandas na área
  // chapada. Estas versões passaram por `tools/recortar-fundo-poses.py`, que
  // remove o fundo por inundação a partir das bordas (preservando a camiseta
  // branca, que está dentro da silhueta) e grava com transparência de verdade.
  // Prefira estas quando o fundo da seção for branco ou claro.
  'de-costas-recorte': {
    src: '/ifizinha/pose-de-costas-recorte.webp',
    width: 542,
    height: 986,
    fundo: 'transparente',
    descricao: 'IFizinha de costas, apontando para o logo nas costas da camiseta',
  },
  'editais-recorte': {
    src: '/ifizinha/pose-editais-recorte.webp',
    width: 670,
    height: 796,
    fundo: 'transparente',
    descricao: 'IFizinha com uma prancheta na mão fazendo sinal de positivo',
  },
  'projetos-recorte': {
    src: '/ifizinha/pose-projetos-recorte.webp',
    width: 789,
    height: 769,
    fundo: 'transparente',
    descricao: 'IFizinha apresentando com as mãos abertas',
  },
  'prazos-recorte': {
    src: '/ifizinha/pose-prazos-recorte.webp',
    width: 740,
    height: 1037,
    fundo: 'transparente',
    descricao: 'IFizinha apontando para o relógio de pulso',
  },
  'apontando-logo-recorte': {
    src: '/ifizinha/pose-apontando-logo-recorte.webp',
    width: 492,
    height: 1149,
    fundo: 'transparente',
    descricao: 'IFizinha apontando para o logo na camiseta',
  },
} as const;

export type NomeMascote = keyof typeof MASCOTES;

interface MascoteIFizinhaProps {
  nome: NomeMascote;
  /** Texto alternativo. Sem ele a imagem é tratada como decorativa. */
  alt?: string;
  className?: string;
  /** Carrega junto com a página — só o hero precisa disso. */
  prioridade?: boolean;
  /** Esconde abaixo de `lg` (padrão quando ela é decoração da seção). */
  somenteDesktop?: boolean;
}

export function MascoteIFizinha({
  nome,
  alt = '',
  className,
  prioridade = false,
  somenteDesktop = false,
}: MascoteIFizinhaProps) {
  const dados = MASCOTES[nome];

  return (
    <Image
      src={dados.src}
      alt={alt}
      width={dados.width}
      height={dados.height}
      sizes={`(max-width: 1024px) 60vw, ${dados.width}px`}
      priority={prioridade}
      loading={prioridade ? undefined : 'lazy'}
      // Os arquivos já vêm no tamanho de exibição e em WebP; o servidor não
      // tem `sharp`, então servir direto evita o fallback do Next gastando CPU
      // da VPS a cada requisição.
      unoptimized
      aria-hidden={alt ? undefined : true}
      className={cn('h-auto w-full select-none', somenteDesktop && 'hidden lg:block', className)}
    />
  );
}
