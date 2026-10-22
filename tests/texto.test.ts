import { describe, it, expect } from 'vitest';
import { textoSimples } from '@/lib/texto';

/**
 * Regressão do card da home que mostrava `&lt;p style="line-height:1.2"...&gt;`
 * em vez da descrição do projeto.
 */
describe('textoSimples', () => {
  it('remove tags HTML reais e mantém o texto', () => {
    const html = '<p style="line-height:1.2; text-align:justify"><span>Em instituições públicas de ensino</span></p>';
    expect(textoSimples(html)).toBe('Em instituições públicas de ensino');
  });

  it('remove tags que chegaram escapadas como entidades', () => {
    expect(textoSimples('&lt;p style="line-height:1.2"&gt;Olá&lt;/p&gt;')).toBe('Olá');
  });

  it('decodifica acentos e entidades comuns', () => {
    expect(textoSimples('Institui&ccedil;&otilde;es p&uacute;blicas &amp; gratuitas')).toBe(
      'Instituições públicas & gratuitas',
    );
  });

  it('remove script/style e não deixa sobra de CSS', () => {
    const html = '<style>.x{color:red}</style><script>alert(1)</script><p>Texto</p>';
    expect(textoSimples(html)).toBe('Texto');
  });

  it('tolera nulo, vazio e texto sem HTML', () => {
    expect(textoSimples(null)).toBe('');
    expect(textoSimples(undefined)).toBe('');
    expect(textoSimples('   ')).toBe('');
    expect(textoSimples('Projeto de extensão')).toBe('Projeto de extensão');
  });
});
