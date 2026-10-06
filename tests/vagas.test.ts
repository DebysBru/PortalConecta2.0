import { describe, it, expect } from 'vitest';
import {
  MAX_OCUPANTES_NA_MENSAGEM,
  descreverOcupante,
  listarOcupantes,
  mensagemVagaLotada,
  vagaExcedeCota,
} from '@/lib/vagas';

/**
 * Bloqueio de "vaga cheia" na seleção por vaga.
 *
 * Relato que originou estes testes: a coordenação mudou um aluno de
 * "selecionado" para "desistente" e continuou recebendo "a vaga já está com
 * todas as 1 posições preenchidas" — porque OUTRA inscrição da mesma vaga
 * seguia marcada como selecionado (estado antigo, com mais selecionados do que
 * posições). A mensagem antiga não dizia de quem era a vaga, então não havia
 * como entender nem resolver.
 *
 * REGRA QUE NÃO PODE REGREDIR: a mensagem sempre identifica quem ocupa.
 */

const VAGA = 'Bolsista — Monitoria de Robótica';

function ocupante(nome: string, protocolo: string) {
  return { nome, protocolo };
}

describe('contagem de ocupação', () => {
  it('acusa excesso só quando passa das posições', () => {
    expect(vagaExcedeCota(2, 1)).toBe(true);
    expect(vagaExcedeCota(3, 2)).toBe(true);
    expect(vagaExcedeCota(1, 1)).toBe(false);
    expect(vagaExcedeCota(0, 1)).toBe(false);
    expect(vagaExcedeCota(0, 0)).toBe(false);
  });
});

describe('descrição de quem ocupa', () => {
  it('mostra nome e protocolo', () => {
    expect(descreverOcupante(ocupante('Felipe Andrade Rocha', 'PRJ-2026-000005'))).toBe(
      'Felipe Andrade Rocha (PRJ-2026-000005)',
    );
  });

  it('não quebra com nome vazio', () => {
    expect(descreverOcupante(ocupante('', 'PRJ-1'))).toBe('Inscrito(a) sem nome (PRJ-1)');
  });

  it('lista todos e resume o excedente', () => {
    expect(listarOcupantes([])).toBe('');
    expect(listarOcupantes([ocupante('Ana', 'P1')])).toBe('Ana (P1)');
    expect(listarOcupantes([ocupante('Ana', 'P1'), ocupante('Bruno', 'P2')])).toBe('Ana (P1), Bruno (P2)');

    const muitos = Array.from({ length: MAX_OCUPANTES_NA_MENSAGEM + 2 }, (_, i) =>
      ocupante(`Pessoa ${i + 1}`, `P${i + 1}`),
    );
    const texto = listarOcupantes(muitos);
    expect(texto).toContain(`Pessoa ${MAX_OCUPANTES_NA_MENSAGEM} (P${MAX_OCUPANTES_NA_MENSAGEM})`);
    expect(texto).toContain('e mais 2');
    expect(texto).not.toContain(`Pessoa ${MAX_OCUPANTES_NA_MENSAGEM + 1}`);
  });
});

describe('mensagem de vaga lotada', () => {
  it('vaga de 1 posição ocupada: nomeia quem está com ela', () => {
    const msg = mensagemVagaLotada({
      titulo: VAGA,
      quantidade: 1,
      ocupantes: [ocupante('Felipe Andrade Rocha', 'PRJ-2026-000005')],
    });

    expect(msg).toContain(VAGA);
    expect(msg).toContain('Felipe Andrade Rocha (PRJ-2026-000005)');
    expect(msg).toMatch(/A única posição/);
    // Sempre diz o que fazer — antes só bloqueava.
    expect(msg).toMatch(/lista de espera/i);
    expect(msg).toMatch(/aumente a quantidade/i);
  });

  it('vaga de várias posições: fala no plural', () => {
    const msg = mensagemVagaLotada({
      titulo: 'Voluntário(a) — Educação Ambiental',
      quantidade: 2,
      ocupantes: [ocupante('Ana', 'P1'), ocupante('Bruno', 'P2')],
    });

    expect(msg).toMatch(/As 2 posições/);
    expect(msg).toMatch(/estão preenchidas/);
    expect(msg).toContain('Ana (P1)');
  });

  it('vaga com MAIS selecionados do que posições (o caso do relato)', () => {
    const msg = mensagemVagaLotada({
      titulo: VAGA,
      quantidade: 1,
      ocupantes: [
        ocupante('Carla Mendes Oliveira', 'PRJ-2026-900002-DEMO'),
        ocupante('Felipe Andrade Rocha', 'PRJ-2026-900005-DEMO'),
      ],
    });

    // Explica a inconsistência em vez de só dizer "cheia"...
    expect(msg).toMatch(/2 selecionados para 1 posição/);
    expect(msg).toMatch(/mais do que ela oferece/i);
    // ...e mostra que o bloqueio NÃO é da pessoa que acabou de sair.
    expect(msg).toContain('Carla Mendes Oliveira (PRJ-2026-900002-DEMO)');
    expect(msg).toContain('Felipe Andrade Rocha (PRJ-2026-900005-DEMO)');
  });

  it('nunca devolve mensagem sem dizer quem ocupa', () => {
    for (const quantidade of [1, 2, 3]) {
      const msg = mensagemVagaLotada({
        titulo: VAGA,
        quantidade,
        ocupantes: [ocupante('Alguém', 'PRJ-2026-000001')],
      });
      expect(msg).toContain('Alguém (PRJ-2026-000001)');
    }
  });
});
