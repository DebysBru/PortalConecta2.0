import { describe, it, expect } from 'vitest';
import {
  GRUPOS_CURSOS,
  TODOS_OS_CURSOS,
  SEMESTRES,
  SEMESTRE_MAX,
  anosDeIngresso,
  anoDeTurma,
  ehAnoIngressoValido,
  ehCursoConhecido,
  ehSemestreValido,
  fonteDeLegado,
  fonteDePerfil,
  formatarSemestreInscricao,
  indiceSemestre,
  mesclarFontesAcademicas,
  parseSemestreInscricao,
  periodoLetivo,
  periodoLetivoLegivel,
  rotuloSemestre,
  semestreAtual,
  turmaDeIngresso,
} from '@/lib/perfil-academico';
import {
  podeDesistir,
  podeResponderConvocacao,
  rotuloRespostaAluno,
  ehRespostaConvocacao,
} from '@/lib/inscricao-aluno';

/**
 * Perfil acadêmico do estudante: catálogo de cursos, ano de ingresso e o
 * semestre que avança sozinho.
 *
 * O que precisa ficar travado:
 *  - o catálogo é o MESMO em toda a aplicação (era texto livre no perfil);
 *  - o semestre nunca regride, nunca passa de 10 e nunca é inventado quando o
 *    estudante não informou nada;
 *  - a leitura dos dados antigos (turma / "2024.5") não perde informação.
 */

describe('catálogo de cursos', () => {
  it('não repete curso entre os grupos', () => {
    const unicos = new Set(TODOS_OS_CURSOS);
    expect(unicos.size).toBe(TODOS_OS_CURSOS.length);
  });

  it('achata exatamente o que os grupos oferecem', () => {
    const dosGrupos = GRUPOS_CURSOS.flatMap((g) => g.options);
    expect(TODOS_OS_CURSOS).toEqual(dosGrupos);
    expect(TODOS_OS_CURSOS.length).toBeGreaterThan(0);
  });

  it('reconhece só curso do catálogo', () => {
    expect(ehCursoConhecido('Sistemas de Informação')).toBe(true);
    expect(ehCursoConhecido('Informática')).toBe(false); // texto livre do modelo antigo
    expect(ehCursoConhecido('')).toBe(false);
  });
});

describe('semestres do curso', () => {
  it('oferece de 1º a 10º', () => {
    expect(SEMESTRES[0]).toBe(1);
    expect(SEMESTRES[SEMESTRES.length - 1]).toBe(SEMESTRE_MAX);
    expect(SEMESTRES).toHaveLength(10);
  });

  it('rotula e valida', () => {
    expect(rotuloSemestre(3)).toBe('3º semestre');
    expect(ehSemestreValido(1)).toBe(true);
    expect(ehSemestreValido(10)).toBe(true);
    expect(ehSemestreValido(0)).toBe(false);
    expect(ehSemestreValido(11)).toBe(false);
    expect(ehSemestreValido(2.5)).toBe(false);
    expect(ehSemestreValido('2')).toBe(false);
    expect(ehSemestreValido(null)).toBe(false);
  });
});

describe('ano de ingresso', () => {
  it('lista do ano atual para trás, sem repetir', () => {
    const hoje = new Date('2026-03-10T12:00:00');
    const anos = anosDeIngresso(hoje);
    expect(anos[0]).toBe(2026);
    expect(anos[1]).toBe(2025);
    expect(new Set(anos).size).toBe(anos.length);
    expect(anos[anos.length - 1]).toBe(2000);
  });

  it('recusa ano no futuro e ano anterior ao catálogo', () => {
    const hoje = new Date('2026-03-10T12:00:00');
    expect(ehAnoIngressoValido(2026, hoje)).toBe(true);
    expect(ehAnoIngressoValido(2027, hoje)).toBe(false);
    expect(ehAnoIngressoValido(1999, hoje)).toBe(false);
    expect(ehAnoIngressoValido(2024.5, hoje)).toBe(false);
    expect(ehAnoIngressoValido('2024', hoje)).toBe(false);
  });

  it('deriva a turma do ano de ingresso', () => {
    expect(turmaDeIngresso(2024)).toBe('Turma 2024');
    expect(turmaDeIngresso(null)).toBeNull();
  });

  it('lê o ano de uma turma escrita de várias formas', () => {
    expect(anoDeTurma('Turma 2024')).toBe(2024);
    expect(anoDeTurma('turma 2019')).toBe(2019);
    expect(anoDeTurma('2021')).toBe(2021);
    expect(anoDeTurma('sem ano')).toBeNull();
    expect(anoDeTurma(null)).toBeNull();
  });
});

describe('semestre automático', () => {
  it('conta semestres letivos (1º: jan–jun, 2º: jul–dez)', () => {
    expect(indiceSemestre(new Date('2026-01-15T12:00:00'))).toBe(2026 * 2);
    expect(indiceSemestre(new Date('2026-06-30T12:00:00'))).toBe(2026 * 2);
    expect(indiceSemestre(new Date('2026-07-01T12:00:00'))).toBe(2026 * 2 + 1);
    expect(indiceSemestre(new Date('2026-12-31T12:00:00'))).toBe(2026 * 2 + 1);
  });

  it('avança um semestre a cada semestre letivo', () => {
    const referencia = new Date('2024-03-01T12:00:00'); // 1º semestre de 2024
    expect(semestreAtual(1, referencia, new Date('2024-05-01T12:00:00'))).toBe(1);
    expect(semestreAtual(1, referencia, new Date('2024-08-01T12:00:00'))).toBe(2);
    expect(semestreAtual(1, referencia, new Date('2025-03-01T12:00:00'))).toBe(3);
    expect(semestreAtual(1, referencia, new Date('2026-03-10T12:00:00'))).toBe(5);
  });

  it('não regride quando a data de hoje é anterior à referência', () => {
    const referencia = new Date('2026-08-01T12:00:00');
    expect(semestreAtual(6, referencia, new Date('2026-03-01T12:00:00'))).toBe(6);
  });

  it('satura no 10º semestre em vez de inventar 15º', () => {
    const referencia = new Date('2019-03-01T12:00:00');
    expect(semestreAtual(1, referencia, new Date('2026-03-01T12:00:00'))).toBe(SEMESTRE_MAX);
  });

  it('não inventa semestre quando não há valor informado', () => {
    expect(semestreAtual(null, new Date('2024-03-01T12:00:00'))).toBeNull();
    expect(semestreAtual(undefined, null)).toBeNull();
    expect(semestreAtual(Number.NaN, new Date('2024-03-01T12:00:00'))).toBeNull();
  });

  it('sem data de referência devolve o próprio valor informado', () => {
    expect(semestreAtual(4, null, new Date('2030-03-01T12:00:00'))).toBe(4);
  });

  it('normaliza valor fora da faixa em vez de quebrar a tela', () => {
    expect(semestreAtual(0, null)).toBe(1);
    expect(semestreAtual(99, null)).toBe(SEMESTRE_MAX);
    expect(semestreAtual(3.7, null)).toBe(3);
  });

  it('aceita referência em texto (o que vem serializado do servidor)', () => {
    expect(semestreAtual(2, '2025-03-01T12:00:00', new Date('2026-03-10T12:00:00'))).toBe(4);
    expect(semestreAtual(2, 'data-invalida', new Date('2026-03-10T12:00:00'))).toBe(2);
  });
});

describe('período letivo', () => {
  it('formata no padrão da inscrição e em texto corrido', () => {
    expect(periodoLetivo(new Date('2026-03-10T12:00:00'))).toBe('2026.1');
    expect(periodoLetivo(new Date('2026-09-10T12:00:00'))).toBe('2026.2');
    expect(periodoLetivoLegivel(new Date('2026-09-10T12:00:00'))).toBe('2º semestre de 2026');
  });
});

describe('ponte com o formato antigo "2024.5"', () => {
  it('formata ano de ingresso + semestre', () => {
    expect(formatarSemestreInscricao(2024, 5)).toBe('2024.5');
    expect(formatarSemestreInscricao(null, 5)).toBe('');
    expect(formatarSemestreInscricao(2024, null)).toBe('');
  });

  it('lê de volta o que ele mesmo escreveu', () => {
    expect(parseSemestreInscricao('2024.5')).toEqual({ anoIngresso: 2024, semestre: 5 });
    expect(parseSemestreInscricao(' 2024 . 10 ')).toEqual({ anoIngresso: 2024, semestre: 10 });
  });

  it('não chuta o que não entende', () => {
    expect(parseSemestreInscricao('2024.11')).toBeNull();
    expect(parseSemestreInscricao('2024')).toBeNull();
    expect(parseSemestreInscricao('5º semestre')).toBeNull();
    expect(parseSemestreInscricao('')).toBeNull();
    expect(parseSemestreInscricao(null)).toBeNull();
  });

  it('IGNORA o formato "2026/1" (ano letivo do dado antigo, não ano de ingresso)', () => {
    // As inscrições reais gravadas antes desta mudança usam "AAAA/S" com o
    // sentido de "ano letivo / semestre do ano". Interpretar como "entrou em
    // 2026, 1º semestre" marcaria um aluno do 3º ano como calouro — melhor
    // deixar em branco e o estudante escolher na lista.
    expect(parseSemestreInscricao('2026/1')).toBeNull();
    expect(parseSemestreInscricao('2026-1')).toBeNull();
  });
});

describe('fontes dos dados acadêmicos', () => {
  it('lê as colunas novas do perfil', () => {
    const referencia = new Date('2026-03-01T12:00:00');
    expect(
      fonteDePerfil({
        curso: 'Física',
        anoIngresso: 2023,
        semestreAtual: 6,
        semestreReferencia: referencia,
        matricula: '20231FIS001',
        telefone: '(43) 99999-0000',
        curriculoLattes: 'https://lattes.cnpq.br/1',
      }),
    ).toEqual({
      curso: 'Física',
      anoIngresso: 2023,
      semestre: 6,
      semestreReferencia: referencia,
      matricula: '20231FIS001',
      telefone: '(43) 99999-0000',
      curriculoLattes: 'https://lattes.cnpq.br/1',
    });
  });

  it('ignora semestre corrompido no banco em vez de propagar', () => {
    expect(fonteDePerfil({ semestreAtual: 42 }).semestre).toBeNull();
  });

  it('lê as colunas legadas priorizando a turma sobre o ano do semestre', () => {
    expect(
      fonteDeLegado({ turma: 'Turma 2023', semestre: '2024.2', matricula: 'X' }),
    ).toMatchObject({ anoIngresso: 2023, semestre: 2, matricula: 'X' });
  });

  it('sem turma, usa o ano do "2024.2"', () => {
    expect(fonteDeLegado({ semestre: '2024.2' })).toMatchObject({
      anoIngresso: 2024,
      semestre: 2,
    });
  });

  it('legado nunca inventa avanço automático (não sabe quando foi escrito)', () => {
    expect(fonteDeLegado({ semestre: '2020.1' }).semestreReferencia).toBeNull();
  });

  it('preenche campo a campo, na ordem das fontes', () => {
    const mesclado = mesclarFontesAcademicas(
      fonteDePerfil({ curso: 'Física', semestreAtual: 4, semestreReferencia: new Date('2026-03-01T12:00:00') }),
      fonteDeLegado({ curso: 'Informática', turma: 'Turma 2023', matricula: 'M-1' }),
      fonteDeLegado({ telefone: '(43) 98888-7777', matricula: 'M-2' }),
    );

    expect(mesclado.curso).toBe('Física'); // perfil novo vence
    expect(mesclado.anoIngresso).toBe(2023); // só o legado tinha
    expect(mesclado.semestre).toBe(4);
    expect(mesclado.matricula).toBe('M-1'); // primeira fonte preenchida vence
    expect(mesclado.telefone).toBe('(43) 98888-7777');
  });

  it('sem nenhuma fonte, devolve tudo nulo (nunca undefined)', () => {
    expect(mesclarFontesAcademicas(null, undefined)).toEqual({
      curso: null,
      anoIngresso: null,
      semestre: null,
      semestreReferencia: null,
      matricula: null,
      telefone: null,
      curriculoLattes: null,
    });
  });
});

describe('regras do estudante sobre a própria inscrição', () => {
  it('permite desistir enquanto a inscrição está em andamento', () => {
    for (const status of ['recebida', 'em_analise', 'selecionado', 'lista_espera']) {
      expect(podeDesistir(status)).toBe(true);
    }
  });

  it('não permite desistir de inscrição já encerrada', () => {
    // "não selecionado" e "desistente" são pontos finais: trocar por desistente
    // só perderia informação.
    expect(podeDesistir('desistente')).toBe(false);
    expect(podeDesistir('nao_selecionado')).toBe(false);
  });

  it('só deixa responder convocação quando foi convocado e não respondeu', () => {
    expect(podeResponderConvocacao('selecionado', null)).toBe(true);
    expect(podeResponderConvocacao('selecionado', 'aceito')).toBe(false);
    expect(podeResponderConvocacao('selecionado', 'recusado')).toBe(false);
    expect(podeResponderConvocacao('recebida', null)).toBe(false);
    expect(podeResponderConvocacao('lista_espera', null)).toBe(false);
    expect(podeResponderConvocacao('desistente', null)).toBe(false);
  });

  it('reconhece e rotula a resposta', () => {
    expect(ehRespostaConvocacao('aceito')).toBe(true);
    expect(ehRespostaConvocacao('recusado')).toBe(true);
    expect(ehRespostaConvocacao('talvez')).toBe(false);
    expect(rotuloRespostaAluno('aceito')).toBe('Convocação aceita');
    expect(rotuloRespostaAluno(null)).toBeNull();
  });
});
