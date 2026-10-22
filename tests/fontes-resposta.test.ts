import { describe, expect, it } from 'vitest';
import {
  filtrarFontesCitadas,
  montarFontesDeChunks,
  montarFontesDeRegistros,
  rotuloCategoria,
  rotuloDoLink,
} from '@/lib/fontes-resposta';
import type { ChunkSearchResult } from '@/lib/busca-vetorial';

/**
 * A lista de fontes é a garantia de que a pessoa consegue conferir a origem da
 * informação — ela aparece mesmo quando o modelo esquece de citar no texto.
 * Por isso estes testes cobrem o que NÃO pode regredir: link por documento,
 * deduplicação e ordenação.
 */

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
    // Todo documento da base do site tem URL de origem; a lista de fontes só
    // mostra o que dá para abrir, então o padrão do teste tem link.
    documento_url: 'https://ifpr.edu.br/ivaipora/edital-de-teste.pdf',
    ...parcial,
  };
}

describe('montarFontesDeChunks', () => {
  it('usa a URL do documento quando fornecida pelo mapa', () => {
    const fontes = montarFontesDeChunks(
      [chunk({ documento_id: 'doc-1' })],
      new Map([['doc-1', 'https://ifpr.edu.br/ivaipora/edital/']])
    );

    expect(fontes).toHaveLength(1);
    expect(fontes[0].url).toBe('https://ifpr.edu.br/ivaipora/edital/');
    expect(fontes[0].numero).toBe(1);
    expect(fontes[0].documentoId).toBe('doc-1');
  });

  it('cai para a URL que veio no metadata do chunk', () => {
    const fontes = montarFontesDeChunks([
      chunk({ documento_url: 'https://ifpr.edu.br/ivaipora/outro/', documento_id: 'doc-2' }),
    ]);

    expect(fontes[0].url).toBe('https://ifpr.edu.br/ivaipora/outro/');
  });

  it('deduplica chunks do mesmo documento e mantém o de maior similaridade', () => {
    const fontes = montarFontesDeChunks([
      chunk({ id: 'a', documento_id: 'doc-1', similarity: 0.4, texto: 'Trecho fraco' }),
      chunk({ id: 'b', documento_id: 'doc-1', similarity: 0.9, texto: 'Trecho forte' }),
      chunk({ id: 'c', documento_id: 'doc-2', similarity: 0.6, documento_titulo: 'PPC Agronomia' }),
    ]);

    expect(fontes).toHaveLength(2);
    expect(fontes[0].documentoId).toBe('doc-1');
    expect(fontes[0].trecho).toContain('Trecho forte');
    expect(fontes[1].documentoId).toBe('doc-2');
    expect(fontes.map((f) => f.numero)).toEqual([1, 2]);
  });

  it('ordena por similaridade, para o número 1 ser o trecho mais relevante', () => {
    const fontes = montarFontesDeChunks([
      chunk({ documento_id: 'doc-a', similarity: 0.3, documento_titulo: 'Menos relevante' }),
      chunk({ documento_id: 'doc-b', similarity: 0.95, documento_titulo: 'Mais relevante' }),
    ]);

    expect(fontes[0].titulo).toBe('Mais relevante');
    expect(fontes[0].numero).toBe(1);
  });

  it('limita a 6 fontes para não poluir a resposta', () => {
    const muitos = Array.from({ length: 10 }, (_, indice) =>
      chunk({ documento_id: `doc-${indice}`, similarity: 0.5, documento_titulo: `Doc ${indice}` })
    );

    expect(montarFontesDeChunks(muitos)).toHaveLength(6);
  });

  it('traz a data de atualização do metadata quando existe', () => {
    const fontes = montarFontesDeChunks([
      chunk({ metadata: { ultima_atualizacao: '2018-07-04' } }),
    ]);

    expect(fontes[0].data).toBe('2018-07-04');
  });
});

describe('montarFontesDeRegistros', () => {
  it('numera projetos e editais continuando a lista de documentos', () => {
    const fontes = montarFontesDeRegistros(
      4,
      [{ nome: 'Projeto Horta', slug: 'horta', area: 'Agronomia' }],
      [{ titulo: 'Edital de Bolsas', slug: 'bolsas', categoria: 'BOLSAS' }]
    );

    expect(fontes.map((f) => f.numero)).toEqual([4, 5]);
    expect(fontes[0].url).toBe('/projetos/horta');
    expect(fontes[1].url).toBe('/editais/bolsas');
    expect(fontes[0].tipo).toBe('projeto');
    expect(fontes[1].tipo).toBe('edital');
  });

  it('deixa url nula quando o registro não tem slug', () => {
    const fontes = montarFontesDeRegistros(1, [{ nome: 'Projeto antigo', slug: null }]);
    expect(fontes[0].url).toBeNull();
  });
});

describe('rótulos', () => {
  it('traduz as categorias do extrator', () => {
    expect(rotuloCategoria('edital')).toBe('Edital');
    expect(rotuloCategoria('ppc')).toBe('Projeto Pedagógico de Curso');
    expect(rotuloCategoria('secretaria')).toBe('Secretaria Acadêmica');
    expect(rotuloCategoria(null)).toBe('Documento');
  });

  it('mostra o domínio do link, sem www', () => {
    expect(rotuloDoLink('https://www.ifpr.edu.br/ivaipora/')).toBe('ifpr.edu.br');
    expect(rotuloDoLink('/projetos/horta')).toBe('portal.ifcoding.com.br');
    expect(rotuloDoLink(null)).toBe('');
  });
});

describe('filtrarFontesCitadas', () => {
  const fontes = [
    { numero: 1, titulo: 'PPC Eletrotécnica', url: 'https://ifpr.edu.br/a.pdf', categoria: 'Curso', tipo: 'documento' as const, trecho: null, data: null },
    { numero: 2, titulo: 'Edital 164/2025', url: 'https://ifpr.edu.br/b.pdf', categoria: 'Edital', tipo: 'documento' as const, trecho: null, data: null },
    { numero: 3, titulo: 'Projeto Horta', url: '/projetos/horta', categoria: 'Agronomia', tipo: 'projeto' as const, trecho: null, data: null },
  ];

  it('mantém só as fontes que o texto citou', () => {
    const resultado = filtrarFontesCitadas('A carga é de 1.333 horas [1]. Veja o projeto [3].', fontes);
    expect(resultado.map((f) => f.numero)).toEqual([1, 3]);
  });

  it('número citado que não existe na lista cai no fallback de documentos', () => {
    // Modelo citou um número fora da faixa (alucinou): não dá para exibir link
    // de fonte inexistente, então mostra as fontes de documento disponíveis.
    const resultado = filtrarFontesCitadas('Conforme o documento [9].', fontes);
    expect(resultado.map((f) => f.numero)).toEqual([1, 2]);
  });

  it('quando o modelo não cita nada, mostra até 3 fontes de documento', () => {
    const resultado = filtrarFontesCitadas('A carga é de 1.333 horas.', fontes);
    expect(resultado.map((f) => f.numero)).toEqual([1, 2]);
    expect(resultado.every((f) => f.tipo === 'documento')).toBe(true);
  });

  it('não repete a mesma fonte citada várias vezes', () => {
    const resultado = filtrarFontesCitadas('[1] confirma [1] de novo [2].', fontes);
    expect(resultado.map((f) => f.numero)).toEqual([1, 2]);
  });
});
