import { describe, it, expect } from 'vitest';
import { analisarCapturaSuap } from '@/lib/suap-import';
import { normalizaSiglaSuap } from '@/lib/suap-api';

/**
 * Importação de projetos do SUAP pela captura do navegador.
 *
 * O caso que importa: o arquivo que o script `public/modelos/capturar-suap-semanal.js`
 * gera (chaves `extensao` e `pesquisa`) precisa ser lido inteiro, sem erro, e o
 * resumo tem que mostrar quantos são do campus configurado — porque a API do SUAP
 * **não filtra por campus** e é aqui que o filtro acontece.
 */

const SIGLA = 'IVAIPODG';

const projeto = (over: Record<string, unknown> = {}) => ({
  id: 1,
  titulo: 'Projeto de teste',
  resumo: 'Resumo',
  dt_inicio: '2026-01-01',
  dt_final: '2026-12-31',
  situacao: 'Em execução',
  campus_id: 1,
  campus_sigla: SIGLA,
  campus_nome: 'Ivaiporã',
  nome_coordenador: 'Fulano',
  email_coordenador: 'fulano@ifpr.edu.br',
  ...over,
});

describe('captura gerada pelo script do navegador', () => {
  const captura = JSON.stringify({
    origem: 'captura-suap-navegador',
    geradoEm: '2026-10-06T19:00:00.000Z',
    extensao: [projeto({ id: 10 }), projeto({ id: 11, campus_sigla: 'CURITIBADG' })],
    pesquisa: [projeto({ id: 20, situacao: 'Concluído' })],
  });

  it('lê os dois grupos e marca a fonte de cada projeto', () => {
    const r = analisarCapturaSuap(captura, SIGLA);
    expect(r.erros).toHaveLength(0);
    expect(r.projetos).toHaveLength(3);
    expect(r.resumo.porFonte).toEqual({ extensao: 2, pesquisa: 1 });
    expect(r.projetos.map((p) => p._fonte)).toEqual(['extensao', 'extensao', 'pesquisa']);
  });

  it('conta quantos são do campus configurado, sem descartar os outros do arquivo', () => {
    const r = analisarCapturaSuap(captura, SIGLA);
    // a filtragem por campus acontece na gravação (aplicarProjetosDoSuap recebe
    // só o que interessa), mas a prévia precisa mostrar os dois números
    expect(r.resumo.noCampusAlvo).toBe(2);
    expect(r.resumo.porCampus[SIGLA]).toBe(2);
    expect(r.resumo.porCampus.CURITIBADG).toBe(1);
  });

  it('resume por situação', () => {
    const r = analisarCapturaSuap(captura, SIGLA);
    expect(r.resumo.porSituacao['Em execução']).toBe(2);
    expect(r.resumo.porSituacao['Concluído']).toBe(1);
  });

  it('avisa quando nenhum projeto é do campus configurado', () => {
    const r = analisarCapturaSuap(
      JSON.stringify({ extensao: [projeto({ campus_sigla: 'OUTROCAMPUS' })], pesquisa: [] }),
      SIGLA,
    );
    expect(r.resumo.noCampusAlvo).toBe(0);
    expect(r.avisos.join(' ')).toContain('Nenhum projeto do campus');
  });

  it('compara a sigla sem diferenciar maiúsculas e acentos', () => {
    const r = analisarCapturaSuap(
      JSON.stringify({ extensao: [projeto({ campus_sigla: 'ivaipodg' })], pesquisa: [] }),
      'IVAIPODG',
    );
    expect(r.resumo.noCampusAlvo).toBe(1);
  });
});

describe('outros formatos aceitos', () => {
  it('lista simples (com _fonte em cada item)', () => {
    const r = analisarCapturaSuap(JSON.stringify([projeto({ id: 5, _fonte: 'pesquisa' })]), SIGLA);
    expect(r.projetos[0]._fonte).toBe('pesquisa');
    expect(r.erros).toHaveLength(0);
  });

  it('lista simples sem _fonte assume extensão e avisa', () => {
    const r = analisarCapturaSuap(JSON.stringify([projeto({ id: 6 })]), SIGLA);
    expect(r.projetos[0]._fonte).toBe('extensao');
    expect(r.avisos.join(' ')).toContain('sem "_fonte"');
  });

  it('resposta crua paginada ({ results })', () => {
    const r = analisarCapturaSuap(
      JSON.stringify({ count: 1, next: null, results: [projeto({ id: 7 })], _fonte: 'pesquisa' }),
      SIGLA,
    );
    expect(r.projetos[0]._fonte).toBe('pesquisa');
    expect(r.erros).toHaveLength(0);
  });

  it('formato embrulhado em { projetos: ... }', () => {
    const r = analisarCapturaSuap(JSON.stringify({ projetos: [projeto({ id: 8 })] }), SIGLA);
    expect(r.projetos).toHaveLength(1);
  });

  it('deduplica quando o mesmo projeto aparece em duas páginas (fica o último)', () => {
    const r = analisarCapturaSuap(
      JSON.stringify({
        extensao: [projeto({ id: 9, titulo: 'Antigo' }), projeto({ id: 9, titulo: 'Atualizado' })],
        pesquisa: [],
      }),
      SIGLA,
    );
    expect(r.projetos).toHaveLength(1);
    expect(r.projetos[0].titulo).toBe('Atualizado');
  });

  it('não confunde ids iguais de fontes diferentes', () => {
    const r = analisarCapturaSuap(
      JSON.stringify({ extensao: [projeto({ id: 3 })], pesquisa: [projeto({ id: 3 })] }),
      SIGLA,
    );
    expect(r.projetos).toHaveLength(2);
  });
});

describe('erros de conteúdo', () => {
  it('JSON quebrado', () => {
    const r = analisarCapturaSuap('{"extensao": [}', SIGLA);
    expect(r.projetos).toHaveLength(0);
    expect(r.erros[0].motivo).toContain('JSON inválido');
  });

  it('formato não reconhecido', () => {
    const r = analisarCapturaSuap('{"foo": 1}', SIGLA);
    expect(r.erros[0].motivo).toContain('Formato não reconhecido');
  });

  it('item sem id e item sem título entram na lista de erros, sem derrubar o resto', () => {
    const r = analisarCapturaSuap(
      JSON.stringify({
        extensao: [projeto({ id: 1 }), { titulo: 'Sem id' }, { id: 2 }, 'texto solto'],
        pesquisa: [],
      }),
      SIGLA,
    );
    expect(r.projetos).toHaveLength(1);
    expect(r.erros).toHaveLength(3);
    expect(r.erros[0].motivo).toContain('"id"');
    expect(r.erros[1].motivo).toContain('"titulo"');
  });

  it('aceita id em texto (a API às vezes devolve string)', () => {
    const r = analisarCapturaSuap(JSON.stringify([{ id: '42', titulo: 'Com id texto', campus_sigla: SIGLA }]), SIGLA);
    expect(r.projetos[0].id).toBe(42);
  });

  it('ignora o BOM que o Bloco de Notas (e o PowerShell) coloca no arquivo', () => {
    // Sem isso, quem salva a captura pelo Windows recebe "JSON inválido:
    // Unexpected token ''" — erro que não diz nada sobre a causa real.
    const r = analisarCapturaSuap('\uFEFF' + JSON.stringify({ extensao: [projeto({ id: 77 })], pesquisa: [] }), SIGLA);
    expect(r.erros).toHaveLength(0);
    expect(r.projetos).toHaveLength(1);
  });

  it('conteúdo vazio', () => {
    const r = analisarCapturaSuap('', SIGLA);
    expect(r.projetos).toHaveLength(0);
    expect(r.erros.length).toBeGreaterThan(0);
  });
});

describe('normalizaSiglaSuap', () => {
  it('ignora caixa, acento e pontuação', () => {
    expect(normalizaSiglaSuap('Ivaiporã')).toBe(normalizaSiglaSuap('IVAIPORA'));
    expect(normalizaSiglaSuap('ivaipodg')).toBe(normalizaSiglaSuap('IVAIPODG'));
    expect(normalizaSiglaSuap(null)).toBe('');
  });
});
