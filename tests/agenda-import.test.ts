import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  analisarArquivo,
  gerarModeloCSV,
  mapearTipo,
  parseBooleanoCalendario,
  parseDataCalendario,
} from '@/lib/agenda-import';

/**
 * Importação do calendário acadêmico.
 *
 * O caso mais importante é o arquivo real do campus: o CSV gerado por
 * `tools/gerar-calendario-2026.py` a partir da planilha classificada precisa
 * importar **sem nenhum erro** — é o arquivo que o painel oferece para download.
 */

const MODELO = join(process.cwd(), 'public', 'modelos', 'calendario-academico-modelo.csv');
const CALENDARIO_2026 = join(process.cwd(), 'public', 'modelos', 'calendario-ifpr-ivaipora-2026.csv');
const CALENDARIO_2026_JSON = join(process.cwd(), 'public', 'modelos', 'calendario-ifpr-ivaipora-2026.json');

describe('datas do calendário', () => {
  it('aceita DD/MM/AAAA (formato que o Excel mostra)', () => {
    const data = parseDataCalendario('05/03/2026')!;
    expect(data.toISOString().slice(0, 10)).toBe('2026-03-05');
  });

  it('aceita AAAA-MM-DD e ISO', () => {
    expect(parseDataCalendario('2026-03-05')!.toISOString().slice(0, 10)).toBe('2026-03-05');
    expect(parseDataCalendario('2026-03-05T00:00:00.000Z')!.toISOString().slice(0, 10)).toBe('2026-03-05');
  });

  it('grava ao meio-dia de Brasília, para não escorregar de dia na exibição', () => {
    const data = parseDataCalendario('01/01/2026')!;
    // 15:00 UTC = 12:00 em America/Sao_Paulo
    expect(data.toISOString()).toBe('2026-01-01T15:00:00.000Z');
    expect(data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })).toBe('01/01/2026');
  });

  it('aceita o serial numérico do Excel', () => {
    expect(parseDataCalendario(46023)!.toISOString().slice(0, 10)).toBe('2026-01-01');
  });

  it('devolve null para vazio e para texto que não é data', () => {
    expect(parseDataCalendario('')).toBeNull();
    expect(parseDataCalendario(null)).toBeNull();
    expect(parseDataCalendario('qualquer coisa')).toBeNull();
  });
});

describe('sim/não do calendário', () => {
  it('entende as variações que aparecem na planilha', () => {
    expect(parseBooleanoCalendario('Sim')).toBe(true);
    expect(parseBooleanoCalendario('NÃO')).toBe(false);
    expect(parseBooleanoCalendario('true')).toBe(true);
    expect(parseBooleanoCalendario('0')).toBe(false);
    expect(parseBooleanoCalendario('x')).toBe(true);
  });

  it('trata vazio como "não informado" (null), e não como "não"', () => {
    expect(parseBooleanoCalendario('')).toBeNull();
    expect(parseBooleanoCalendario(undefined)).toBeNull();
  });
});

describe('tipo do evento', () => {
  it('deduz pela subcategoria', () => {
    expect(mapearTipo('Feriado / recesso / férias', 'Feriado')).toBe('FERIADO');
    expect(mapearTipo('Feriado / recesso / férias', 'Férias escolares/docentes')).toBe('RECESSO');
    expect(mapearTipo('Prazo / edital / burocracia', 'Matrícula / rematrícula')).toBe('INSCRICAO');
    expect(mapearTipo('Gestão pedagógica / docente', 'Conselho de classe')).toBe('CONSELHO_CLASSE');
    expect(mapearTipo('Atividade acadêmica', 'Calendário letivo')).toBe('LETIVO_INICIO_FIM');
  });

  it('cai para a categoria quando a subcategoria é desconhecida', () => {
    expect(mapearTipo('Prazo / edital / burocracia', 'Subcategoria nova')).toBe('PRAZO_EDITAL');
  });

  it('usa EVENTO_CAMPUS quando não reconhece nada', () => {
    expect(mapearTipo('Categoria nova', 'Subcategoria nova')).toBe('EVENTO_CAMPUS');
    expect(mapearTipo(null, null)).toBe('EVENTO_CAMPUS');
  });
});

describe('análise de CSV', () => {
  const csv = [
    'ref;titulo;data;dataFim;categoria;subcategoria;publico;interessaAlunos',
    'e1;Matrícula 2026;22/01/2026;26/01/2026;Prazo / edital / burocracia;Matrícula / rematrícula;Alunos;Sim',
    'e2;Feriado municipal;06/08/2026;;Feriado / recesso / férias;Feriado;Alunos e professores;Sim',
  ].join('\n');

  it('lê as linhas e resume por categoria e mês', () => {
    const r = analisarArquivo(csv);
    expect(r.formato).toBe('csv');
    expect(r.separador).toBe(';');
    expect(r.erros).toHaveLength(0);
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas[0].tipo).toBe('INSCRICAO');
    expect(r.linhas[0].dataFim).not.toBeNull();
    expect(r.resumo.porCategoria['Feriado / recesso / férias']).toBe(1);
    expect(r.resumo.porMes['2026-01']).toBe(1);
    expect(r.resumo.primeiraData).toBe('2026-01-22');
    expect(r.resumo.ultimaData).toBe('2026-08-06');
  });

  it('detecta o separador vírgula e entende cabeçalho com acento e em português', () => {
    const r = analisarArquivo(
      'Título,Data,Público principal,Interessa alunos?\nFeira de ciências,10/11/2026,Comunidade acadêmica,Não',
    );
    expect(r.separador).toBe(',');
    expect(r.linhas[0].titulo).toBe('Feira de ciências');
    expect(r.linhas[0].publicoAlvo).toBe('Comunidade acadêmica');
    expect(r.linhas[0].interessaAlunos).toBe(false);
  });

  it('ignora linhas comentadas com #', () => {
    const r = analisarArquivo('# comentário\nref;titulo;data\ne1;Evento;01/01/2026');
    expect(r.linhas).toHaveLength(1);
    expect(r.erros).toHaveLength(0);
  });

  it('reclama quando falta titulo ou data no cabeçalho', () => {
    const r = analisarArquivo('ref;titulo\n1;Só título');
    expect(r.erros.some((e) => e.motivo.includes('titulo'))).toBe(true);
  });

  it('aponta a linha com data inválida e continua com o resto', () => {
    const r = analisarArquivo(
      'ref;titulo;data\ne1;Bom;01/01/2026\ne2;Ruim;31/02/2026\ne3;Outro;02/01/2026',
    );
    expect(r.linhas).toHaveLength(2);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0].linha).toBe(3);
  });

  it('recusa data final anterior à inicial', () => {
    const r = analisarArquivo('ref;titulo;data;dataFim\ne1;Invertido;10/03/2026;01/03/2026');
    expect(r.linhas).toHaveLength(0);
    expect(r.erros[0].motivo).toContain('anterior');
  });

  it('recusa ref repetida no mesmo arquivo', () => {
    const r = analisarArquivo('ref;titulo;data\ne1;A;01/01/2026\ne1;B;02/01/2026');
    expect(r.linhas).toHaveLength(1);
    expect(r.erros[0].motivo).toContain('ref repetida');
  });

  it('gera ref automática quando a coluna não vem', () => {
    const r = analisarArquivo('titulo;data\nReunião de pais;15/03/2026');
    expect(r.linhas[0].ref).toMatch(/^auto-reuniaodepais-2026-03-15$/);
  });

  it('usa dataFim apenas quando o fim é diferente do início', () => {
    const r = analisarArquivo('ref;titulo;data;dataFim\ne1;Um dia;01/01/2026;01/01/2026');
    expect(r.linhas[0].dataFim).toBeNull();
  });
});

describe('análise de JSON', () => {
  it('aceita lista de objetos com as chaves do modelo', () => {
    const r = analisarArquivo(JSON.stringify([
      { ref: 'j1', titulo: 'Evento JSON', data: '2026-05-05', tipo: 'PALESTRA', interessaAlunos: true },
    ]));
    expect(r.formato).toBe('json');
    expect(r.linhas[0].tipo).toBe('PALESTRA');
    expect(r.linhas[0].interessaAlunos).toBe(true);
  });

  it('aceita objeto com a chave eventos', () => {
    const r = analisarArquivo(JSON.stringify({ eventos: [{ titulo: 'A', data: '01/02/2026' }] }));
    expect(r.linhas).toHaveLength(1);
  });

  it('aceita chaves em português', () => {
    const r = analisarArquivo(JSON.stringify([{ Título: 'Com acento', Data: '01/02/2026', 'Público principal': 'Alunos' }]));
    expect(r.linhas[0].titulo).toBe('Com acento');
    expect(r.linhas[0].publicoAlvo).toBe('Alunos');
  });

  it('avisa quando o JSON não é lista', () => {
    const r = analisarArquivo('{"foo": 1}');
    expect(r.linhas).toHaveLength(0);
    expect(r.erros[0].motivo).toContain('lista de eventos');
  });

  it('avisa quando o JSON está quebrado', () => {
    const r = analisarArquivo('[{"titulo": "x",}]');
    expect(r.erros[0].motivo).toContain('JSON inválido');
  });
});

describe('modelo para download', () => {
  it('tem cabeçalho com as colunas obrigatórias e linhas de exemplo', () => {
    const csv = gerarModeloCSV();
    const [cabecalho, ...linhas] = csv.trim().split('\n');
    expect(cabecalho).toContain('titulo');
    expect(cabecalho).toContain('data');
    expect(cabecalho).toContain('ref');
    expect(linhas.length).toBeGreaterThanOrEqual(2);

    const analisado = analisarArquivo(csv);
    expect(analisado.erros).toHaveLength(0);
    expect(analisado.linhas).toHaveLength(2);
  });
});

describe('arquivos reais do campus', () => {
  it('o modelo publicado no portal importa sem erro', () => {
    const r = analisarArquivo(readFileSync(MODELO, 'utf8'));
    expect(r.erros).toHaveLength(0);
    expect(r.linhas.length).toBeGreaterThanOrEqual(2);
  });

  it('o Calendário 2026 importa inteiro, sem linha com problema', () => {
    const r = analisarArquivo(readFileSync(CALENDARIO_2026, 'utf8'));
    expect(r.erros).toHaveLength(0);
    expect(r.totalLinhas).toBe(r.linhas.length);
    // 107 eventos consolidados da planilha; 3 deles têm datas não contíguas e
    // viram mais de uma linha (datas específicas)
    expect(r.linhas.length).toBeGreaterThanOrEqual(107);

    // as refs são únicas (é o que garante a idempotência da reimportação)
    const refs = new Set(r.linhas.map((l) => l.ref));
    expect(refs.size).toBe(r.linhas.length);

    // cobrem o ano inteiro
    expect(r.resumo.primeiraData).toBe('2026-01-01');
    expect(r.resumo.ultimaData).toBe('2026-12-31');
  });

  it('a versão JSON traz exatamente os mesmos eventos do CSV', () => {
    const csv = analisarArquivo(readFileSync(CALENDARIO_2026, 'utf8'));
    const json = analisarArquivo(readFileSync(CALENDARIO_2026_JSON, 'utf8'));
    expect(json.erros).toHaveLength(0);
    expect(json.linhas.map((l) => l.ref)).toEqual(csv.linhas.map((l) => l.ref));
  });

  it('todo evento do calendário tem tipo válido e categoria preenchida', () => {
    const r = analisarArquivo(readFileSync(CALENDARIO_2026, 'utf8'));
    for (const linha of r.linhas) {
      expect(linha.tipo).toBeTruthy();
      expect(linha.categoria).toBeTruthy();
      expect(linha.titulo.length).toBeGreaterThan(3);
    }
  });
});
