import { describe, expect, it } from 'vitest';
import { trechoParaContexto } from '@/lib/trecho-contexto';

/**
 * Caso real (22/10/2026): a IFizinha respondeu "as descrições que eu tenho
 * aqui estão incompletas (o texto vem cortado)". O chat mandava HTML cru
 * (`<p style="border:none">...`) cortado em 200 caracteres — as 233 descrições
 * de projeto do portal são HTML do editor rico e a média tem 4.421 caracteres.
 */

describe('trechoParaContexto', () => {
  it('remove HTML e entidades', () => {
    const html = '<p style="border:none"><span style="font-family:Calibri">O campus Ivaipor&atilde; do IFPR</span></p>';
    expect(trechoParaContexto(html, 500)).toBe('O campus Ivaiporã do IFPR');
  });

  it('não mexe em texto que cabe no limite', () => {
    expect(trechoParaContexto('Texto curto.', 100)).toBe('Texto curto.');
  });

  it('corta no fim de uma frase, sem reticências', () => {
    const texto = 'Primeira frase do projeto. Segunda frase com mais detalhe. Terceira frase que não cabe.';
    const resultado = trechoParaContexto(texto, 45);

    expect(resultado).toBe('Primeira frase do projeto.');
    expect(resultado).not.toContain('…');
  });

  it('quando não há fim de frase, corta na palavra inteira', () => {
    const texto = 'palavra1 palavra2 palavra3 palavra4 palavra5';
    const resultado = trechoParaContexto(texto, 24);

    expect(resultado).toBe('palavra1 palavra2');
    expect(resultado.endsWith(' ')).toBe(false);
  });

  it('devolve vazio para nulo, indefinido ou HTML sem texto', () => {
    expect(trechoParaContexto(null, 100)).toBe('');
    expect(trechoParaContexto(undefined, 100)).toBe('');
    expect(trechoParaContexto('<div><span>   </span></div>', 100)).toBe('');
  });

  it('não devolve só marcação quando o limite é pequeno', () => {
    const html = '<p style="margin:0"><span style="font-size:11pt">Conteúdo real do projeto</span></p>';
    const resultado = trechoParaContexto(html, 20);

    expect(resultado).toBe('Conteúdo real do');
    expect(resultado.startsWith('<')).toBe(false);
  });
});
