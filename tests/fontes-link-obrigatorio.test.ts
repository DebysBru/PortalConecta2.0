import { describe, expect, it } from 'vitest';
import { montarFontesDeChunks } from '@/lib/fontes-resposta';
import type { ChunkSearchResult } from '@/lib/busca-vetorial';

function chunk(parcial: Partial<ChunkSearchResult>): ChunkSearchResult {
  return {
    id: 'c1',
    documento_id: 'doc-1',
    chunk_index: 0,
    texto: 'Trecho de teste com informação institucional.',
    secao: null,
    categoria: 'edital',
    pagina_inicial: null,
    pagina_final: null,
    metadata: {},
    documento_titulo: 'Edital de Transferência 2018',
    documento_tipo: 'site_ifpr',
    similarity: 0.8,
    documento_url: 'https://ifpr.edu.br/ivaipora/edital/',
    ...parcial,
  };
}

describe('montarFontesDeChunks — link obrigatório', () => {
  it('não lista documento sem link (fonte sem link não serve para conferir)', () => {
    const fontes = montarFontesDeChunks([
      chunk({ documento_id: 'sem-url', documento_url: null }),
      chunk({ documento_id: 'com-url', documento_url: 'https://ifpr.edu.br/ok.pdf', documento_titulo: 'Documento ok' }),
    ]);

    expect(fontes).toHaveLength(1);
    expect(fontes[0].titulo).toBe('Documento ok');
    expect(fontes[0].numero).toBe(1);
  });

  it('numera a partir do início informado', () => {
    const fontes = montarFontesDeChunks([chunk({})], new Map(), 3);
    expect(fontes[0].numero).toBe(3);
  });
});
