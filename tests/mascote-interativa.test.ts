import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

// `next/link` e `next/image` exigem o contexto do App Router; fora do Next,
// renderizam como <a> e <img> (mesmo padrÃ£o de tests/rodape-institucional.test.ts).
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children, ...resto }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...resto }, children),
  };
});

vi.mock('next/image', async () => {
  const React = await import('react');
  // Repassa sÃ³ o que importa para o teste (o next/image real recebe props que nÃ£o
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
 * Mascote interativa das pÃ¡ginas internas.
 *
 * O que este teste protege: (1) as poses usadas nos cabeÃ§alhos sÃ£o seguras â€”
 * transparentes ou de fundo branco, porque o cabeÃ§alho Ã© branco, e nunca uma das
 * que gesticulam para a direita (foi o defeito corrigido duas vezes no Â§29 do
 * DECISIONS); (2) a interaÃ§Ã£o pedida estÃ¡ no markup (respiraÃ§Ã£o, hover, balÃ£o);
 * (3) a guarda de `prefers-reduced-motion` continua no CSS.
 */
describe('mascote interativa', () => {
  it('renderiza o balÃ£o de dica com o texto recebido', () => {
    const html = renderToStaticMarkup(
      React.createElement(MascoteInterativa, { nome: 'relogio', dica: 'Filtre pelo que te interessa!' }),
    );
    expect(html).toContain('Filtre pelo que te interessa!');
    expect(html).toContain('/ifizinha/mascote-relogio.webp');
  });

  it('sem dica nÃ£o aparece balÃ£o nenhum', () => {
    const html = renderToStaticMarkup(React.createElement(MascoteInterativa, { nome: 'hero' }));
    expect(html).not.toContain('rounded-br-sm');
  });

  it('traz respiraÃ§Ã£o, hover e sombra no markup', () => {
    const html = renderToStaticMarkup(React.createElement(MascoteInterativa, { nome: 'hero', dica: 'oi' }));
    expect(html).toContain('animate-respira');
    expect(html).toContain('group-hover:[animation-play-state:paused]');
    expect(html).toContain('group-hover:-translate-y-1.5');
    expect(html).toContain('group-hover:scale-[1.03]');
    expect(html).toContain('group-hover:drop-shadow-');
    // o wrapper de quem posiciona Ã© `pointer-events-none`; sem isto o :hover
    // nunca dispararia (o navegador nem testa o elemento)
    expect(html).toContain('pointer-events-auto');
  });

  it('a imagem Ã© decorativa (sem alt), para nÃ£o poluir leitor de tela', () => {
    const html = renderToStaticMarkup(React.createElement(MascoteInterativa, { nome: 'hero' }));
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('PageHero com mascote', () => {
  const base = {
    trilha: [{ href: '/', label: 'InÃ­cio' }, { label: 'Editais' }],
    etiqueta: 'Oportunidades',
    titulo: 'Editais & Oportunidades',
  };

  it('sem mascote nÃ£o reserva espaÃ§o Ã  direita nem renderiza imagem', () => {
    const html = renderToStaticMarkup(React.createElement(PageHero, base));
    expect(html).not.toContain('/ifizinha/');
    expect(html).not.toContain('xl:pr-[170px]');
  });

  it('com mascote reserva o canto direito e deixa a sobra para a seÃ§Ã£o seguinte cobrir', () => {
    const html = renderToStaticMarkup(
      React.createElement(PageHero, { ...base, mascote: { nome: 'relogio', dica: 'dica' } }),
    );
    expect(html).toContain('/ifizinha/mascote-relogio.webp');
    expect(html).toContain('xl:pr-[170px]');
    // recorte lateral sem criar barra de rolagem, e a sobra que a prÃ³xima faixa cobre
    expect(html).toContain('overflow-x-clip');
    expect(html).toContain('-mb-10');
  });

  it('continua mostrando o Ã­cone do cabeÃ§alho', () => {
    const html = renderToStaticMarkup(
      React.createElement(PageHero, { ...base, icone: React.createElement('span', null, 'ICONE'), mascote: { nome: 'hero' } }),
    );
    expect(html).toContain('ICONE');
  });
});

describe('poses usadas nos cabeÃ§alhos', () => {
  // Todas as poses de cabeÃ§alho precisam ser **transparentes**.
  //
  // Aprendido na prÃ¡tica: `fundo: 'branco'` (#FEFEFE) NÃƒO basta em faixa branca â€”
  // a diferenÃ§a de 1-2 nÃ­veis aparece como uma caixinha (e o WebP cria bandas na
  // Ã¡rea chapada). Foi o que aconteceu no cabeÃ§alho de /projetos com a pose
  // "de costas". As poses de estÃºdio agora existem em duas versÃµes: a original,
  // de fundo sÃ³lido, e a recortada (`*-recorte`), gerada por
  // `tools/recortar-fundo-poses.py`.
  const PAGINAS: { rota: string; arquivo: string; poses: string[] }[] = [
    { rota: '/editais', arquivo: 'src/app/editais/page.tsx', poses: ['hero'] },
    { rota: '/editais/[slug]', arquivo: 'src/app/editais/[slug]/page.tsx', poses: ['relogio'] },
    { rota: '/projetos', arquivo: 'src/app/projetos/page.tsx', poses: ['de-costas-recorte'] },
    { rota: '/projetos/[slug]', arquivo: 'src/app/projetos/[slug]/page.tsx', poses: ['hero'] },
    { rota: '/agenda', arquivo: 'src/app/agenda/page.tsx', poses: ['relogio'] },
    { rota: '/busca', arquivo: 'src/app/busca/page.tsx', poses: ['de-costas-recorte'] },
  ];

  for (const { rota, arquivo, poses } of PAGINAS) {
    it(`${rota} usa pose transparente no cabeÃ§alho`, () => {
      const fonte = readFileSync(join(process.cwd(), ...arquivo.split('/')), 'utf8');
      // aceita o slot do PageHero (`mascote={{ nome: 'x' }}`) e o uso direto do
      // componente (`<MascoteInterativa nome="x"`), como em /projetos/[slug]
      const usada =
        fonte.match(/mascote=\{\{\s*nome:\s*'([a-z-]+)'/)?.[1] ??
        fonte.match(/<MascoteInterativa\s+nome="([a-z-]+)"/)?.[1];
      expect(usada, `mascote do cabeÃ§alho de ${rota}`).toBeDefined();
      expect(poses).toContain(usada as string);
      expect(MASCOTES[usada as keyof typeof MASCOTES].fundo).toBe('transparente');
    });
  }

  it('nenhuma pose de fundo sÃ³lido sobrou nas pÃ¡ginas', () => {
    // Varre as pÃ¡ginas pÃºblicas: pose de fundo `cinza`/`branco` sobre faixa clara
    // Ã© exatamente o defeito que o usuÃ¡rio viu como "caixinha branca".
    const paginas = [
      'src/app/page.tsx',
      'src/app/editais/page.tsx',
      'src/app/projetos/page.tsx',
      'src/app/agenda/page.tsx',
      'src/app/busca/page.tsx',
      'src/components/sections/ProjetosGrid.tsx',
      'src/components/agenda/AgendaExplorer.tsx',
      'src/components/sections/PergunteIFizinha.tsx',
    ];
    const solidas = Object.entries(MASCOTES)
      .filter(([, dados]) => dados.fundo !== 'transparente')
      .map(([nome]) => nome);

    for (const pagina of paginas) {
      const fonte = readFileSync(join(process.cwd(), ...pagina.split('/')), 'utf8');
      for (const nome of solidas) {
        expect(fonte, `${pagina} usa a pose de fundo sÃ³lido "${nome}"`).not.toContain(`nome="${nome}"`);
      }
    }
  });
});

describe('mascote nos estados vazios', () => {
  // "Nada encontrado" Ã© onde a mascote mais rende: ela pensa em vez de um Ã­cone
  // cinza. O teste garante que ninguÃ©m troque de volta por um Ã­cone sem querer.
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
  it('globals.css desliga respiraÃ§Ã£o e hover em prefers-reduced-motion', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toMatch(/\.animate-respira[\s\S]{0,200}animation: none !important/);
    expect(css).toMatch(/\.ifizinha-hover[\s\S]{0,200}transform: none !important/);
  });

  it('a respiraÃ§Ã£o Ã© lenta (6s) â€” nÃ£o Ã© banner piscando', async () => {
    const config = readFileSync(join(process.cwd(), 'tailwind.config.ts'), 'utf8');
    expect(config).toContain('"respira":    "respira 6s ease-in-out infinite"');
    expect(config).toMatch(/respira: \{[\s\S]{0,120}translateY\(-6px\)/);
  });
});
