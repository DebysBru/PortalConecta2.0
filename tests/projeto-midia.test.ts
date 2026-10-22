import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LogoDoProjeto } from '@/components/projetos/LogoDoProjeto';
import { estiloDaCapa, temCapa } from '@/lib/projeto-midia';

/**
 * Consistência visual do projeto: o mesmo logo em todas as telas e a capa
 * substituindo o fundo azul.
 *
 * Regressão do relato de 22/10/2026: o detalhe do projeto mostrava a imagem,
 * mas os cards da home/listagem mostravam só a inicial ("P") — o mesmo projeto
 * aparecia diferente conforme a tela.
 */
describe('logo do projeto', () => {
  it('usa a imagem quando existe', () => {
    const html = renderToStaticMarkup(
      React.createElement(LogoDoProjeto, { nome: 'Projeto Teste', logoUrl: '/files/logo.webp' }),
    );

    expect(html).toContain('src="/files/logo.webp"');
    expect(html).toContain('alt="Logo Projeto Teste"');
    expect(html).toContain('object-cover');
  });

  it('sem logo, usa a mesma inicial em qualquer tela', () => {
    const html = renderToStaticMarkup(
      React.createElement(LogoDoProjeto, { nome: 'Projeto Teste', logoUrl: null }),
    );

    expect(html).toContain('P');
    expect(html).not.toContain('<img');
  });
});

describe('capa do projeto', () => {
  it('sem capa mantém o gradiente da cor do projeto', () => {
    const estilo = estiloDaCapa('#2F52D3', null);

    expect(estilo.background).toContain('#2F52D3');
    expect(estilo.backgroundImage).toBeUndefined();
    expect(temCapa(null)).toBe(false);
  });

  it('com capa, usa a imagem como background com overlay', () => {
    const estilo = estiloDaCapa('#2F52D3', '/files/capa.webp');

    expect(estilo.backgroundImage).toContain('url("/files/capa.webp")');
    expect(estilo.backgroundImage).toContain('linear-gradient');
    expect(estilo.backgroundSize).toBe('cover');
    expect(estilo.backgroundPosition).toBe('center');
    expect(temCapa('/files/capa.webp')).toBe(true);
  });

  it('escapa aspas para não quebrar o CSS', () => {
    const estilo = estiloDaCapa('#2F52D3', '/files/a"b.webp').backgroundImage ?? '';

    expect(estilo).toContain('/files/ab.webp');
  });
});
