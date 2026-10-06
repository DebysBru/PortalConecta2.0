import { describe, it, expect } from 'vitest';
import {
  LIMITES, OPCOES, validarAno, validarCampos, validarCorHexadecimal, validarEmail,
  validarJsonPequeno, validarListaDeTextos, validarMapaDeRespostas, validarNumero,
  validarOpcao, validarTelefone, validarTexto, validarTextoOpcional, validarUrl,
} from '@/lib/validacao';

/**
 * Limites de entrada e validadores usados pelas Server Actions.
 *
 * Contexto: até esta mudança a maioria dos campos não tinha teto nenhum no
 * servidor — um título de projeto de 5 mil caracteres, um `valorBolsa` negativo
 * (ou 1e308) e um link `javascript:` que vira XSS armazenado quando alguém clica.
 * O `maxLength` do formulário é conforto: quem chama a action direto não passa
 * por ele. Estes testes travam o que o SERVIDOR aceita.
 */

const REPETE = (n: number) => 'a'.repeat(n);

describe('texto com mínimo e máximo', () => {
  it('aceita no limite exato e devolve sem espaços nas pontas', () => {
    const r = validarTexto('  Projeto de Robótica  ', 'Nome', { min: 2, max: 120 });
    expect(r).toEqual({ ok: true, valor: 'Projeto de Robótica' });

    const noLimite = validarTexto(REPETE(120), 'Nome', { min: 2, max: 120 });
    expect(noLimite.ok).toBe(true);
  });

  it('recusa acima do teto e diz quantos caracteres vieram', () => {
    const r = validarTexto(REPETE(121), 'Nome', { min: 2, max: 120 });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('Nome');
      expect(r.error).toContain('120');
      expect(r.error).toContain('121 caracteres');
    }
  });

  it('recusa abaixo do mínimo', () => {
    expect(validarTexto('a', 'Nome', { min: 2, max: 120 }).ok).toBe(false);
    expect(validarTexto('   ', 'Nome', { min: 2, max: 120 }).ok).toBe(false);
  });

  it('recusa valor que não é texto', () => {
    expect(validarTexto(42, 'Nome', { min: 2, max: 120 }).ok).toBe(false);
    expect(validarTexto(null, 'Nome', { min: 2, max: 120 }).ok).toBe(false);
    expect(validarTexto({ a: 1 }, 'Nome', { min: 2, max: 120 }).ok).toBe(false);
  });

  it('opcional: vazio vira null, mas o teto continua valendo', () => {
    expect(validarTextoOpcional('', 'Resumo', LIMITES.resumo)).toEqual({ ok: true, valor: null });
    expect(validarTextoOpcional('   ', 'Resumo', LIMITES.resumo)).toEqual({ ok: true, valor: null });
    expect(validarTextoOpcional(null, 'Resumo', LIMITES.resumo)).toEqual({ ok: true, valor: null });
    expect(validarTextoOpcional(REPETE(401), 'Resumo', LIMITES.resumo).ok).toBe(false);
  });
});

describe('campo de opção', () => {
  it('aceita só o que está previsto', () => {
    expect(validarOpcao('BOLSISTA', 'Tipo', OPCOES.tipoInteresse)).toEqual({ ok: true, valor: 'BOLSISTA' });
    expect(validarOpcao('ADMIN', 'Tipo', OPCOES.tipoInteresse).ok).toBe(false);
    expect(validarOpcao('', 'Tipo', OPCOES.tipoInteresse).ok).toBe(false);
    expect(validarOpcao(null, 'Tipo', OPCOES.tipoInteresse).ok).toBe(false);
    expect(validarOpcao(7, 'Tipo', OPCOES.tipoInteresse).ok).toBe(false);
  });

  it('o status do post também é validado (não confia no tipo do TS)', () => {
    expect(validarOpcao('PUBLICADO', 'Situação', ['RASCUNHO', 'PUBLICADO'] as const).ok).toBe(true);
    expect(validarOpcao('DELETADO', 'Situação', ['RASCUNHO', 'PUBLICADO'] as const).ok).toBe(false);
  });
});

describe('listas de texto (áreas, habilidades, tags)', () => {
  it('limita quantidade e tamanho de cada item', () => {
    const vinte = Array.from({ length: 20 }, (_, i) => `area ${i}`);
    expect(validarListaDeTextos(vinte, 'Áreas').ok).toBe(true);

    const vinteUm = [...vinte, 'area 20'];
    expect(validarListaDeTextos(vinteUm, 'Áreas').ok).toBe(false);

    expect(validarListaDeTextos([REPETE(61)], 'Áreas').ok).toBe(false);
    expect(validarListaDeTextos([REPETE(60)], 'Áreas').ok).toBe(true);
  });

  it('limpa espaços, descarta vazios e remove repetição', () => {
    const r = validarListaDeTextos(['  robótica ', 'robótica', '', '   ', 'educação'], 'Áreas');
    expect(r).toEqual({ ok: true, valor: ['robótica', 'educação'] });
  });

  it('recusa o que não é lista', () => {
    expect(validarListaDeTextos('robótica', 'Áreas').ok).toBe(false);
    expect(validarListaDeTextos({ 0: 'x' }, 'Áreas').ok).toBe(false);
    expect(validarListaDeTextos(null, 'Áreas')).toEqual({ ok: true, valor: [] });
  });
});

describe('números com faixa', () => {
  it('valor da bolsa: teto de 9.999,99 com duas casas', () => {
    expect(validarNumero(1500, 'Valor da bolsa', LIMITES.valorBolsa, { opcional: true }))
      .toEqual({ ok: true, valor: 1500 });
    expect(validarNumero(9999.99, 'Valor da bolsa', LIMITES.valorBolsa, { opcional: true }).ok).toBe(true);

    // O caso que a coordenação citou: nada de 5 dígitos, negativo ou absurdo.
    for (const absurdo of [10000, 1e308, -1, 99999.999]) {
      expect(validarNumero(absurdo, 'Valor da bolsa', LIMITES.valorBolsa, { opcional: true }).ok).toBe(false);
    }
    expect(validarNumero(10.999, 'Valor da bolsa', LIMITES.valorBolsa, { opcional: true }).ok).toBe(false);
  });

  it('recusa NaN, Infinity e texto que não é número', () => {
    for (const invalido of [Number.NaN, Infinity, -Infinity, 'abc', {}, []]) {
      expect(validarNumero(invalido, 'Quantidade', LIMITES.quantidadeVagas).ok).toBe(false);
    }
  });

  it('aceita número em texto (o form manda string)', () => {
    expect(validarNumero('12', 'Quantidade', LIMITES.quantidadeVagas, { inteiro: true }))
      .toEqual({ ok: true, valor: 12 });
  });

  it('inteiro não aceita quebrado; faixa respeita o mínimo', () => {
    expect(validarNumero(2.5, 'Quantidade', LIMITES.quantidadeVagas, { inteiro: true }).ok).toBe(false);
    expect(validarNumero(0, 'Quantidade', LIMITES.quantidadeVagas, { inteiro: true }).ok).toBe(false);
    expect(validarNumero(-3, 'Quantidade', LIMITES.quantidadeVagas, { inteiro: true }).ok).toBe(false);
  });

  it('carga horária semanal não passa de uma semana inteira', () => {
    expect(validarNumero(168, 'Carga horária', LIMITES.cargaHoraria, { inteiro: true }).ok).toBe(true);
    expect(validarNumero(169, 'Carga horária', LIMITES.cargaHoraria, { inteiro: true }).ok).toBe(false);
  });

  it('opcional: vazio vira null; obrigatório: vazio é erro', () => {
    expect(validarNumero('', 'Valor', LIMITES.valorBolsa, { opcional: true })).toEqual({ ok: true, valor: null });
    expect(validarNumero(null, 'Valor', LIMITES.valorBolsa, { opcional: true })).toEqual({ ok: true, valor: null });
    expect(validarNumero('', 'Valor', LIMITES.valorBolsa).ok).toBe(false);
  });

  it('ano fora da janela razoável é recusado', () => {
    expect(validarAno(2026, 'Ano').ok).toBe(true);
    expect(validarAno(1999, 'Ano').ok).toBe(false);
    expect(validarAno(999999, 'Ano').ok).toBe(false);
    expect(validarAno(null, 'Ano')).toEqual({ ok: true, valor: null });
  });
});

describe('URL — o campo que vira link na página', () => {
  it('aceita http, https e caminho interno do portal', () => {
    expect(validarUrl('https://ifpr.edu.br/edital', 'Site', { opcional: true }))
      .toEqual({ ok: true, valor: 'https://ifpr.edu.br/edital' });
    expect(validarUrl('http://exemplo.com', 'Site', { opcional: true }).ok).toBe(true);
    expect(validarUrl('/files/pdf/2026/10/doc.pdf', 'Arquivo', { opcional: true }).ok).toBe(true);
  });

  it('BLOQUEIA javascript:, data:, vbscript: e file: (XSS armazenado)', () => {
    const perigosos = [
      'javascript:alert(document.cookie)',
      'JaVaScRiPt:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ];
    for (const url of perigosos) {
      const r = validarUrl(url, 'Link', { opcional: true });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/http/i);
    }
  });

  it('recusa texto que não é endereço e URL gigante', () => {
    expect(validarUrl('www.ifpr.edu.br', 'Site', { opcional: true }).ok).toBe(false);
    expect(validarUrl('//evil.com', 'Site', { opcional: true }).ok).toBe(false);
    expect(validarUrl(`https://x.com/${REPETE(600)}`, 'Site', { opcional: true }).ok).toBe(false);
  });

  it('vazio vira null; obrigatório recusa vazio', () => {
    expect(validarUrl('', 'Site', { opcional: true })).toEqual({ ok: true, valor: null });
    expect(validarUrl('', 'Site', { opcional: false }).ok).toBe(false);
  });
});

describe('e-mail, telefone e cor', () => {
  it('e-mail válido passa; o resto não', () => {
    expect(validarEmail('aluno@estudantes.ifpr.edu.br')).toEqual({ ok: true, valor: 'aluno@estudantes.ifpr.edu.br' });
    for (const invalido of ['sem-arroba', 'a@b', 'a b@c.com', 'a@b.', `${REPETE(160)}@x.com`, 42]) {
      expect(validarEmail(invalido).ok).toBe(false);
    }
  });

  it('telefone: formatos brasileiros passam, o resto não', () => {
    expect(validarTelefone('(43) 99999-0000')).toEqual({ ok: true, valor: '(43) 99999-0000' });
    expect(validarTelefone('43999990000').ok).toBe(true);
    expect(validarTelefone('+55 43 99999-0000').ok).toBe(true);
    expect(validarTelefone('123').ok).toBe(false);
    expect(validarTelefone('99999999999999999').ok).toBe(false);
    expect(validarTelefone('(43) 99999-0000 script').ok).toBe(false);
    expect(validarTelefone('')).toEqual({ ok: true, valor: null });
  });

  it('cor hexadecimal (vai direto para o CSS da página)', () => {
    expect(validarCorHexadecimal('#2F52D3')).toEqual({ ok: true, valor: '#2F52D3' });
    expect(validarCorHexadecimal('#fff').ok).toBe(true);
    for (const invalida of ['azul', '#12345', 'red; background: url(x)', 'javascript:alert(1)']) {
      expect(validarCorHexadecimal(invalida).ok).toBe(false);
    }
  });
});

describe('campos JSON pequenos', () => {
  it('aceita objeto dentro do teto e recusa o que incha o banco', () => {
    expect(validarJsonPequeno({ a: 'b' }, 'Formulário').ok).toBe(true);
    // 40 KB de JSON passa do teto de 32 KB.
    expect(validarJsonPequeno({ texto: REPETE(40 * 1024) }, 'Formulário').ok).toBe(false);
  });

  it('respostas do formulário extra: teto por resposta e tipo conferido', () => {
    expect(validarMapaDeRespostas({ q1: 'resposta curta' }, 'Respostas'))
      .toEqual({ ok: true, valor: { q1: 'resposta curta' } });
    expect(validarMapaDeRespostas({ q1: ['a', 'b'] }, 'Respostas').ok).toBe(true);
    expect(validarMapaDeRespostas({ q1: 3, q2: true }, 'Respostas').ok).toBe(true);

    expect(validarMapaDeRespostas({ q1: REPETE(LIMITES.respostaExtra + 1) }, 'Respostas').ok).toBe(false);
    expect(validarMapaDeRespostas({ q1: { aninhado: 'x' } }, 'Respostas').ok).toBe(false);
    expect(validarMapaDeRespostas({ q1: [1, 2] }, 'Respostas').ok).toBe(false);
    expect(validarMapaDeRespostas('texto', 'Respostas').ok).toBe(false);
  });
});

describe('combinador de campos', () => {
  it('devolve os valores já tratados quando tudo passa', () => {
    const r = validarCampos({
      nome: () => validarTexto('  Projeto  ', 'Nome', LIMITES.titulo),
      vagas: () => validarNumero('5', 'Vagas', LIMITES.quantidadeVagas, { inteiro: true }),
    });

    expect(r).toEqual({ ok: true, valor: { nome: 'Projeto', vagas: 5 } });
  });

  it('para na primeira falha e devolve a mensagem do campo', () => {
    const r = validarCampos({
      nome: () => validarTexto(REPETE(500), 'Nome', LIMITES.titulo),
      vagas: () => validarNumero(5, 'Vagas', LIMITES.quantidadeVagas, { inteiro: true }),
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Nome');
  });
});
