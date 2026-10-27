import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CampoUrlDaCapa, ehCaminhoDoStorage } from '@/components/ui/CampoUrlDaCapa';

/**
 * Campo de URL da capa do post.
 *
 * Regressão do bug relatado em 21/10/2026: a imagem enviada do computador fica
 * em `/files/...` e, num `<input type="url">`, o navegador recusava o formulário
 * com "Insira um URL" — além de permitir apagar o caminho e desvincular a
 * imagem sem querer.
 *
 * O que este teste trava:
 *  - caminho do storage nunca vira `<input>` editável;
 *  - URL externa (ou campo vazio) usa `type="text"`, nunca `type="url"`;
 *  - a URL de outro domínio, mesmo protocol-relative (`//cdn...`), não é
 *    confundida com arquivo do portal.
 */

function renderizar(imagemUrl: string) {
  return renderToStaticMarkup(
    React.createElement(CampoUrlDaCapa, { imagemUrl, onChange: () => {} }),
  );
}

describe('caminho do storage', () => {
  it('reconhece arquivos servidos pelo portal', () => {
    expect(ehCaminhoDoStorage('/files/imagens/2026/10/foto.png')).toBe(true);
    expect(ehCaminhoDoStorage('  /files/pdf/2026/10/a.pdf  ')).toBe(true);
  });

  it('não confunde com URL externa nem com protocol-relative', () => {
    expect(ehCaminhoDoStorage('https://exemplo.com/foto.png')).toBe(false);
    expect(ehCaminhoDoStorage('//cdn.exemplo.com/foto.png')).toBe(false);
    expect(ehCaminhoDoStorage('')).toBe(false);
    expect(ehCaminhoDoStorage(null)).toBe(false);
    expect(ehCaminhoDoStorage(undefined)).toBe(false);
  });
});

describe('campo da capa', () => {
  it('imagem do computador aparece como informação, sem input editável', () => {
    const html = renderizar('/files/imagens/2026/10/foto.png');

    expect(html).toContain('/files/imagens/2026/10/foto.png');
    expect(html).toContain('Remover');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('type="url"');
  });

  it('URL externa usa input de texto (o navegador não valida como URL)', () => {
    const html = renderizar('https://exemplo.com/capa.png');

    expect(html).toContain('<input');
    expect(html).toContain('type="text"');
    expect(html).toContain('value="https://exemplo.com/capa.png"');
    expect(html).not.toContain('type="url"');
  });

  it('sem imagem o campo externo continua disponível', () => {
    const html = renderizar('');

    expect(html).toContain('ou cole uma URL de imagem externa');
    expect(html).toContain('<input');
    expect(html).not.toContain('Imagem salva no servidor');
  });
});
