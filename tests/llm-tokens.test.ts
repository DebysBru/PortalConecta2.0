import { describe, it, expect } from 'vitest';
import { tokensParaResposta, LlmRespostaTruncadaError } from '@/lib/llm';

/**
 * Orçamento de tokens da IA (Dec. 36).
 *
 * O `deepseek-flash` é modelo de raciocínio: os `reasoning_tokens` são gerados
 * ANTES da resposta e dividem o mesmo `max_tokens`. Pedir só o tamanho da
 * resposta truncava o JSON do edital (finish_reason "length") e a tela mostrava
 * "a IA encontrou um problema" — que sugere repetir, mas repetir falhava igual.
 * Estes testes travam a conta (resposta + reserva, com o teto do provider) e o
 * tipo de erro que o `extract-pdf` converte em 422.
 */

describe('tokensParaResposta', () => {
  it('soma a reserva de raciocínio ao tamanho da resposta', () => {
    expect(tokensParaResposta(2000)).toBe(6000);
    expect(tokensParaResposta(3000)).toBe(7000);
  });

  it('respeita o teto de saída do DeepSeek (8.000), sem passar dele', () => {
    expect(tokensParaResposta(4000)).toBe(8000);
    expect(tokensParaResposta(4001)).toBe(8000);
    expect(tokensParaResposta(100_000)).toBe(8000);
  });

  it('nunca pede menos que a reserva de raciocínio, mesmo para resposta vazia', () => {
    expect(tokensParaResposta(0)).toBe(4000);
  });
});

describe('LlmRespostaTruncadaError', () => {
  it('carrega finish_reason "length" e o usage da chamada truncada', () => {
    const usage = { prompt_tokens: 900, completion_tokens: 8000 };
    const erro = new LlmRespostaTruncadaError(usage);

    expect(erro).toBeInstanceOf(Error);
    expect(erro.name).toBe('LlmRespostaTruncadaError');
    expect(erro.finishReason).toBe('length');
    expect(erro.usage).toBe(usage);
    expect(erro.message).toContain('truncada');
  });

  it('usage é opcional (chamada sem metadados não quebra)', () => {
    const erro = new LlmRespostaTruncadaError();
    expect(erro.usage).toBeNull();
  });
});
