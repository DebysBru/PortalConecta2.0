import { describe, expect, it } from 'vitest';
import { detectarPessoaCitada } from '@/lib/pessoa-na-pergunta';

/**
 * Caso real que motivou este módulo (conversa no portal, 22/10/2026):
 *
 *   "quais projetos o prof. Ronan está envolvido?"
 *   → a IFizinha listou 5 projetos e esqueceu o do TV Box.
 *
 * O prof. Ronan coordena 6. A consulta do chat pegava os 10 projetos do topo do
 * portal (por destaque/status) e só 1 era dele; os outros vinham incompletos da
 * busca semântica. O conserto é reconhecer o nome e filtrar por coordenador.
 */

const COORDENADORES = [
  'Ronan Anacleto Lopes',
  'Suelen Cristina Uber',
  'Sonia Maria da Costa Mendes',
  'Lucas dos Santos Umeoka',
  'Aline Spaciari Matioli',
  null,
  '',
];

describe('detectarPessoaCitada', () => {
  it('reconhece o primeiro nome ("prof. Ronan")', () => {
    expect(detectarPessoaCitada('quais projetos o prof. Ronan está envolvido?', COORDENADORES))
      .toBe('Ronan Anacleto Lopes');
  });

  it('reconhece sobrenome com acento e maiúscula', () => {
    expect(detectarPessoaCitada('projetos da professora Suélen', COORDENADORES))
      .toBe('Suelen Cristina Uber');
  });

  it('prefere o nome completo quando a pergunta traz mais de um token', () => {
    expect(detectarPessoaCitada('o que o professor Ronan Anacleto Lopes coordena?', COORDENADORES))
      .toBe('Ronan Anacleto Lopes');
  });

  it('não inventa pessoa quando a pergunta é sobre tema', () => {
    expect(detectarPessoaCitada('quais projetos de extensão estão abertos?', COORDENADORES))
      .toBeNull();
  });

  it('não confunde palavras comuns com sobrenomes', () => {
    expect(detectarPessoaCitada('como funciona a matrícula no campus?', COORDENADORES))
      .toBeNull();
  });

  it('ignora partículas ("dos", "da") na comparação', () => {
    expect(detectarPessoaCitada('projetos do Lucas Umeoka', COORDENADORES))
      .toBe('Lucas dos Santos Umeoka');
  });

  it('devolve null quando não há nomes conhecidos', () => {
    expect(detectarPessoaCitada('projetos do Ronan', [])).toBeNull();
  });
});
