import { describe, it, expect } from 'vitest';
import {
  FINANCIAMENTOS_SUGERIDOS,
  LIMITES_EQUIPE,
  normalizarEstudantes,
  normalizarFinanciamento,
  equipeDoProjeto,
  financiamentoDoProjeto,
} from '@/lib/projetos-equipe';

/**
 * Equipe de estudantes e financiamento do projeto.
 *
 * A página pública mostra bolsistas, voluntários e fontes de financiamento
 * junto ao resumo. Estes testes cobrem as regras que o SERVIDOR aplica antes
 * de gravar (o formulário pode mandar qualquer coisa: quem chama a Server
 * Action direto não passa por ele) e a filtragem que a tela usa.
 */

describe('FINANCIAMENTOS_SUGERIDOS', () => {
  it('traz as fontes pedidas pela coordenação, na ordem em que são exibidas', () => {
    expect(FINANCIAMENTOS_SUGERIDOS).toEqual([
      'IFPR',
      'CNPq',
      'Fundação Araucária',
      'Emenda Parlamentar',
    ]);
  });
});

describe('normalizarEstudantes', () => {
  it('apara os nomes e descarta vazios', () => {
    const r = normalizarEstudantes(['  Ana Souza ', '', '   ', 'Bruno Lima'], 'Estudantes bolsistas');
    expect(r).toEqual({ ok: true, valor: ['Ana Souza', 'Bruno Lima'] });
  });

  it('remove repetição (o mesmo nome duas vezes sujaria a exibição)', () => {
    const r = normalizarEstudantes(['Ana', 'Ana', 'Ana'], 'Estudantes voluntários');
    expect(r).toEqual({ ok: true, valor: ['Ana'] });
  });

  it('trata ausência como lista vazia (campo opcional)', () => {
    expect(normalizarEstudantes(undefined, 'Estudantes bolsistas')).toEqual({ ok: true, valor: [] });
    expect(normalizarEstudantes(null, 'Estudantes voluntários')).toEqual({ ok: true, valor: [] });
  });

  it('recusa valor que não é lista', () => {
    const r = normalizarEstudantes('Ana, Bruno', 'Estudantes bolsistas');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Estudantes bolsistas');
  });

  it('recusa mais itens que o teto', () => {
    const nomes = Array.from({ length: LIMITES_EQUIPE.estudantes.maxItens + 1 }, (_, i) => `Pessoa ${i}`);
    const r = normalizarEstudantes(nomes, 'Estudantes bolsistas');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(String(LIMITES_EQUIPE.estudantes.maxItens));
  });

  it('recusa nome maior que o teto por item', () => {
    const nome = 'a'.repeat(LIMITES_EQUIPE.estudantes.maxItem + 1);
    const r = normalizarEstudantes([nome], 'Estudantes voluntários');
    expect(r.ok).toBe(false);
  });
});

describe('normalizarFinanciamento', () => {
  it('aceita fontes sugeridas e "afins" (o campo é livre)', () => {
    const r = normalizarFinanciamento(['IFPR', 'CNPq', 'Fundação Araucária', 'Emenda Parlamentar', 'PIBEX']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toHaveLength(5);
  });

  it('apara, descarta vazios e deduplica', () => {
    const r = normalizarFinanciamento([' CNPq ', '', 'CNPq', 'IFPR']);
    expect(r).toEqual({ ok: true, valor: ['CNPq', 'IFPR'] });
  });

  it('recusa mais fontes que o teto', () => {
    const fontes = Array.from({ length: LIMITES_EQUIPE.financiamento.maxItens + 1 }, (_, i) => `Fonte ${i}`);
    expect(normalizarFinanciamento(fontes).ok).toBe(false);
  });
});

describe('equipeDoProjeto', () => {
  it('separa bolsistas e voluntários e conta o total', () => {
    expect(
      equipeDoProjeto({
        estudantesBolsistas: ['Ana', 'Bruno'],
        estudantesVoluntarios: ['Carla'],
      }),
    ).toEqual({ bolsistas: ['Ana', 'Bruno'], voluntarios: ['Carla'], total: 3 });
  });

  it('ignora vazio/espaço que tenha sobrado no banco', () => {
    const equipe = equipeDoProjeto({ estudantesBolsistas: ['Ana', '  '], estudantesVoluntarios: null });
    expect(equipe.bolsistas).toEqual(['Ana']);
    expect(equipe.voluntarios).toEqual([]);
    expect(equipe.total).toBe(1);
  });

  it('projeto sem equipe nenhuma tem total 0 (a página não renderiza o cartão)', () => {
    expect(equipeDoProjeto({})).toEqual({ bolsistas: [], voluntarios: [], total: 0 });
    expect(equipeDoProjeto({ estudantesBolsistas: [], estudantesVoluntarios: [] }).total).toBe(0);
  });
});

describe('financiamentoDoProjeto', () => {
  it('descarta vazio e repetição', () => {
    expect(financiamentoDoProjeto({ financiamento: ['IFPR', ' IFPR ', '', 'CNPq'] })).toEqual([
      'IFPR',
      'CNPq',
    ]);
  });

  it('sem financiamento informado, lista vazia', () => {
    expect(financiamentoDoProjeto({})).toEqual([]);
    expect(financiamentoDoProjeto({ financiamento: null })).toEqual([]);
  });
});
