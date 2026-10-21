import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// `next/link` exige o contexto do App Router; fora do Next, renderiza como <a>.
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children, ...resto }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...resto }, children),
  };
});

const { Footer } = await import('@/components/layout/Footer');

/**
 * Conteúdo institucional do rodapé.
 *
 * Contexto: até 05/10/2026 o rodapé trazia o Instagram `@ifpr.ivaipora`, que não
 * é o perfil oficial — o oficial é `ifpr.campus.ivaipora` (confirmado no rodapé
 * de https://ifpr.edu.br/ivaipora/). Endereço, e-mail da comunicação e o
 * perfil da IFizinha entraram junto. Este teste existe para ninguém "limpar"
 * esses dados sem perceber, e para garantir que o mapa continua sendo um embed
 * apontando para o endereço do campus.
 */
describe('rodapé — dados institucionais do IFPR Campus Ivaiporã', () => {
  const html = renderToStaticMarkup(React.createElement(Footer));

  it('mostra o endereço oficial completo', () => {
    expect(html).toContain('Rua Max Arthur Greipel, nº 505');
    expect(html).toContain('Parque Industrial I');
    expect(html).toContain('Porfírio Basso');
    expect(html).toContain('Caixa Postal 138');
    expect(html).toContain('Ivaiporã/PR');
    expect(html).toContain('CEP 86.873-400');
  });

  it('linka o site oficial e o e-mail da comunicação', () => {
    expect(html).toContain('https://ifpr.edu.br/ivaipora/');
    expect(html).toContain('mailto:comunicacao.ivaipora@ifpr.edu.br');
    expect(html).toContain('comunicacao.ivaipora@ifpr.edu.br');
  });

  it('linka o Instagram oficial do campus e o da IFizinha', () => {
    expect(html).toContain('https://www.instagram.com/ifpr.campus.ivaipora/');
    expect(html).toContain('@ifpr.campus.ivaipora');
    expect(html).toContain('https://www.instagram.com/ifizinha.ifpr/');
    expect(html).toContain('@ifizinha.ifpr');
    // o perfil que estava errado não pode voltar
    expect(html).not.toContain('ifpr.ivaipora');
  });

  it('embute o mapa do endereço do campus (sem chave de API) e oferece o link direto', () => {
    expect(html).toContain('https://www.google.com/maps?q=');
    expect(html).toContain('output=embed');
    expect(html).toContain(encodeURIComponent('Rua Max Arthur Greipel, 505 - Parque Industrial I, Ivaiporã - PR, 86873-400'));
    expect(html).toContain('https://www.google.com/maps/search/?api=1');
    expect(html).toContain('Ver no Google Maps');
  });

  it('o iframe do mapa é lazy (não pesa a primeira dobra) e tem título acessível', () => {
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('title="Mapa — IFPR Campus Ivaiporã');
  });
});
