import { describe, it, expect } from 'vitest';
import {
  ICONE_PADRAO,
  ICONES_DE_POST,
  capaDoPost,
  chaveDeIconeValida,
  iconeDaChave,
  semCapaEscolhida,
  type ChaveIconePost,
} from '@/lib/post-capa';

/**
 * Capa do post (imagem ou ícone nativo).
 *
 * Contexto: o card de "Últimas Atualizações" só sabia mostrar `imagemUrl` e o
 * formulário do professor não tinha campo de imagem — todo post criado por ele
 * aparecia num quadrado cinza vazio. Agora existe catálogo de ícones com
 * significado e o card nunca fica vazio.
 *
 * O que estes testes travam:
 *  - o catálogo é fechado e coerente (chave única, rótulo, classes literais);
 *  - chave inválida NUNCA é aceita (o servidor valida com esta função);
 *  - imagem tem precedência sobre ícone;
 *  - nada devolve `undefined` — o componente sempre tem o que desenhar.
 */

const CHAVES_ESPERADAS: ChaveIconePost[] = [
  'aviso', 'inscricoes', 'selecao', 'prazo', 'evento',
  'formacao', 'reuniao', 'atividade', 'conquista', 'documento',
];

describe('catálogo de ícones', () => {
  it('tem as chaves combinadas, sem repetição', () => {
    const chaves = ICONES_DE_POST.map((i) => i.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
    expect([...chaves].sort()).toEqual([...CHAVES_ESPERADAS].sort());
  });

  it('todo ícone tem rótulo, descrição, componente e classes', () => {
    for (const icone of ICONES_DE_POST) {
      expect(icone.rotulo.length).toBeGreaterThan(2);
      expect(icone.descricao.length).toBeGreaterThan(5);
      expect(typeof icone.Icone).not.toBe('undefined');
      // Classe do Tailwind precisa ser LITERAL no código: classe montada em
      // tempo de execução não entra no CSS gerado e o ícone sai sem cor.
      expect(icone.fundo).toMatch(/^bg-[a-z]+-\d{2,3}$/);
      expect(icone.cor).toMatch(/^text-[a-z-]+(-\d{2,3})?$/);
    }
  });

  it('o ícone padrão também tem tudo o que precisa', () => {
    expect(ICONE_PADRAO.rotulo).toBe('Publicação');
    expect(ICONE_PADRAO.fundo).toMatch(/^bg-[a-z]+-\d{2,3}$/);
    expect(ICONE_PADRAO.cor).toMatch(/^text-[a-z-]+(-\d{2,3})?$/);
  });
});

describe('validação da chave (usada pelo servidor)', () => {
  it('aceita só as chaves do catálogo', () => {
    for (const chave of CHAVES_ESPERADAS) expect(chaveDeIconeValida(chave)).toBe(true);
  });

  it('recusa qualquer outra coisa', () => {
    expect(chaveDeIconeValida('inventado')).toBe(false);
    expect(chaveDeIconeValida('')).toBe(false);
    expect(chaveDeIconeValida(null)).toBe(false);
    expect(chaveDeIconeValida(undefined)).toBe(false);
    expect(chaveDeIconeValida(7)).toBe(false);
    expect(chaveDeIconeValida({ chave: 'aviso' })).toBe(false);
    // Nem "herança" de protótipo passa
    expect(chaveDeIconeValida('toString')).toBe(false);
    expect(chaveDeIconeValida('constructor')).toBe(false);
  });
});

describe('resolução da capa', () => {
  it('imagem tem precedência sobre o ícone', () => {
    const capa = capaDoPost({ imagemUrl: '/files/imagens/2026/10/foto.png', icone: 'evento' });
    expect(capa).toEqual({ tipo: 'imagem', url: '/files/imagens/2026/10/foto.png' });
  });

  it('espaço em branco na URL não conta como imagem', () => {
    expect(capaDoPost({ imagemUrl: '   ', icone: 'prazo' })).toMatchObject({
      tipo: 'icone',
      chave: 'prazo',
    });
  });

  it('sem imagem, usa o ícone escolhido', () => {
    const capa = capaDoPost({ imagemUrl: null, icone: 'selecao' });
    expect(capa.tipo).toBe('icone');
    if (capa.tipo === 'icone') {
      expect(capa.chave).toBe('selecao');
      expect(capa.icone.rotulo).toBe('Seleção / resultado');
    }
  });

  it('sem imagem e sem ícone, cai no padrão (nunca fica vazio)', () => {
    for (const post of [{}, { imagemUrl: null, icone: null }, { icone: 'inexistente' }, { icone: '' }]) {
      const capa = capaDoPost(post);
      expect(capa.tipo).toBe('icone');
      if (capa.tipo === 'icone') {
        expect(capa.icone.rotulo).toBe(ICONE_PADRAO.rotulo);
        expect(capa.chave).toBeNull();
      }
    }
  });

  it('iconeDaChave nunca devolve undefined', () => {
    expect(iconeDaChave('aviso').rotulo).toBe('Aviso');
    expect(iconeDaChave('nao-existe').rotulo).toBe(ICONE_PADRAO.rotulo);
    expect(iconeDaChave(null).rotulo).toBe(ICONE_PADRAO.rotulo);
    expect(iconeDaChave(undefined).rotulo).toBe(ICONE_PADRAO.rotulo);
  });

  it('distingue "sem capa escolhida" de "capa escolhida"', () => {
    expect(semCapaEscolhida({})).toBe(true);
    expect(semCapaEscolhida({ imagemUrl: '  ', icone: null })).toBe(true);
    expect(semCapaEscolhida({ icone: 'chave-invalida' })).toBe(true);
    expect(semCapaEscolhida({ imagemUrl: '/files/imagens/2026/10/foto.png' })).toBe(false);
    expect(semCapaEscolhida({ icone: 'conquista' })).toBe(false);
  });
});
