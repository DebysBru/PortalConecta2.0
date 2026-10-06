import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

// `next/link` e `next/image` exigem o contexto do App Router; fora do Next,
// renderizam como <a> e <img> (mesmo padrão de tests/rodape-institucional.test.ts).
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children, ...resto }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...resto }, children),
  };
});

vi.mock('next/image', async () => {
  const React = await import('react');
  // Repassa só o que importa para o teste (o next/image real recebe props que não
  // existem em <img>, como `unoptimized` e `sizes`).
  return {
    default: ({ src, alt, className, ...resto }: { src: string; alt: string; className?: string }) =>
      React.createElement('img', {
        src,
        alt,
        className,
        'aria-hidden': (resto as Record<string, unknown>)['aria-hidden'],
      }),
  };
});

const { PageHero } = await import('@/components/layout/PageHero');
const { MascoteInterativa } = await import('@/components/ifizinha/MascoteInterativa');
const { MASCOTES } = await import('@/components/ifizinha/MascoteIFizinha');

/**
 * Mascote interativa das páginas internas.
 *
 * O que este teste protege: (1) as poses usadas nos cabeçalhos são seguras —
 * transparentes ou de fundo branco, porque o cabeçalho é branco, e nunca uma das
 * que gesticulam para a direita (foi o defeito corrigido duas vezes no §29 do
 * DECISIONS); (2) a interação pedida está no markup (respiração, hover, balão);
 * (3) a guarda de `prefers-reduced-motion` continua no CSS.
 */
describe('mascote interativa', () => {
  it('renderiza o balão de dica com o texto recebido', () => {
    const html = renderToStaticMarkup(
      React.createElement(MascoteInterativa, { nome: 'relogio', dica: 'Filtre pelo que te interessa!' }),
    );
    expect(html).toContain('Filtre pelo que te interessa!');
    expect(html).toContain('/ifizinha/mascote-relogio.webp');
  });

  it('sem dica não aparece balão nenhum', () => {
    const html = renderToStaticMarkup(React.createElement(MascoteInterativa, { nome: 'hero' }));
    expect(html).not.toContain('rounded-br-sm');
  });

  it('traz respiração, hover e sombra no markup', () => {
    const html = renderToStaticMarkup(React.createElement(MascoteInterativa, { nome: 'hero', dica: 'oi' }));
    expect(html).toContain('animate-respira');
    expect(html).toContain('group-hover:[animation-play-state:paused]');
    expect(html).toContain('group-hover:-translate-y-1.5');
    expect(html).toContain('group-hover:scale-[1.03]');
    expect(html).toContain('group-hover:drop-shadow-');
    // o wrapper de quem posiciona é `pointer-events-none`; sem isto o :hover
    // nunca dispararia (o navegador nem testa o elemento)
    expect(html).toContain('pointer-events-auto');
  });

  it('a imagem é decorativa (sem alt), para não poluir leitor de tela', () => {
    const html = renderToStaticMarkup(React.createElement(MascoteInterativa, { nome: 'hero' }));
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('PageHero com mascote', () => {
  const base = {
    trilha: [{ href: '/', label: 'Início' }, { label: 'Editais' }],
    etiqueta: 'Oportunidades',
    titulo: 'Editais & Oportunidades',
  };

  it('sem mascote não reserva espaço à direita nem renderiza imagem', () => {
    const html = renderToStaticMarkup(React.createElement(PageHero, base));
    expect(html).not.toContain('/ifizinha/');
    expect(html).not.toContain('xl:pr-[190px]');
  });

  it('com mascote reserva o canto direito e deixa a sobra para a seção seguinte cobrir', () => {
    const html = renderToStaticMarkup(
      React.createElement(PageHero, { ...base, mascote: { nome: 'relogio', dica: 'dica' } }),
    );
    expect(html).toContain('/ifizinha/mascote-relogio.webp');
    expect(html).toContain('xl:pr-[190px]');
    // recorte lateral sem criar barra de rolagem, e a sobra que a próxima faixa cobre
    expect(html).toContain('overflow-x-clip');
    expect(html).toContain('-mb-10');
  });

  it('continua mostrando o ícone do cabeçalho', () => {
    const html = renderToStaticMarkup(
      React.createElement(PageHero, { ...base, icone: React.createElement('span', null, 'ICONE'), mascote: { nome: 'hero' } }),
    );
    expect(html).toContain('ICONE');
  });
});

describe('poses usadas nos cabeçalhos', () => {
  // O cabeçalho é branco (ou a cor do projeto, no caso do /projetos/[slug]):
  // pose de fundo `cinza` (#F7F7F7) deixaria um retângulo visível, e pose que
  // gesticula para a direita apontaria para fora da tela.
  const PAGINAS: { rota: string; arquivo: string; poses: string[] }[] = [
    { rota: '/editais', arquivo: 'src/app/editais/page.tsx', poses: ['hero'] },
    { rota: '/editais/[slug]', arquivo: 'src/app/editais/[slug]/page.tsx', poses: ['relogio'] },
    { rota: '/projetos', arquivo: 'src/app/projetos/page.tsx', poses: ['de-costas'] },
    { rota: '/projetos/[slug]', arquivo: 'src/app/projetos/[slug]/page.tsx', poses: ['hero'] },
    { rota: '/agenda', arquivo: 'src/app/agenda/page.tsx', poses: ['relogio'] },
    { rota: '/busca', arquivo: 'src/app/busca/page.tsx', poses: ['de-costas'] },
  ];

  for (const { rota, arquivo, poses } of PAGINAS) {
    it(`${rota} usa pose segura no cabeçalho`, () => {
      const fonte = readFileSync(join(process.cwd(), ...arquivo.split('/')), 'utf8');
      // aceita o slot do PageHero (`mascote={{ nome: 'x' }}`) e o uso direto do
      // componente (`<MascoteInterativa nome="x"`), como em /projetos/[slug]
      const usada =
        fonte.match(/mascote=\{\{\s*nome:\s*'([a-z-]+)'/)?.[1] ??
        fonte.match(/<MascoteInterativa\s+nome="([a-z-]+)"/)?.[1];
      expect(usada, `mascote do cabeçalho de ${rota}`).toBeDefined();
      expect(poses).toContain(usada as string);
      // o fundo da pose precisa ser transparente ou branco
      const fundo = MASCOTES[usada as keyof typeof MASCOTES].fundo;
      expect(['transparente', 'branco']).toContain(fundo);
    });
  }
});

describe('mascote nos estados vazios', () => {
  // "Nada encontrado" é onde a mascote mais rende: ela pensa em vez de um ícone
  // cinza. O teste garante que ninguém troque de volta por um ícone sem querer.
  const VAZIOS = [
    { onde: 'agenda (filtro sem resultado)', arquivo: 'src/components/agenda/AgendaExplorer.tsx' },
    { onde: 'projetos (filtro sem resultado)', arquivo: 'src/app/projetos/ProjetosExplorer.tsx' },
    { onde: 'editais (nenhum publicado)', arquivo: 'src/app/editais/page.tsx' },
    { onde: 'busca (nenhum resultado)', arquivo: 'src/app/busca/page.tsx' },
  ];

  for (const { onde, arquivo } of VAZIOS) {
    it(`${onde} mostra a mascote`, () => {
      const fonte = readFileSync(join(process.cwd(), ...arquivo.split('/')), 'utf8');
      expect(fonte).toContain('<MascoteInterativa nome="chat"');
    });
  }
});

describe('acessibilidade do movimento', () => {
  it('globals.css desliga respiração e hover em prefers-reduced-motion', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toMatch(/\.animate-respira[\s\S]{0,200}animation: none !important/);
    expect(css).toMatch(/\.ifizinha-hover[\s\S]{0,200}transform: none !important/);
  });

  it('a respiração é lenta (6s) — não é banner piscando', async () => {
    const config = readFileSync(join(process.cwd(), 'tailwind.config.ts'), 'utf8');
    expect(config).toContain('"respira":    "respira 6s ease-in-out infinite"');
    expect(config).toMatch(/respira: \{[\s\S]{0,120}translateY\(-6px\)/);
  });
});
