import { describe, it, expect } from 'vitest';
import {
  FUSO_BRASIL,
  chaveDoDiaBrasil,
  deslocamentoBrasilMs,
  fimDoDiaBrasil,
  formatarDataBrasil,
  formatarDataHoraBrasil,
  inicioDoDiaBrasil,
  instanteNoBrasil,
  mesNoBrasil,
  parseDataDoFormulario,
  partesNoBrasil,
} from '@/lib/datas';

/**
 * Datas no fuso do Brasil.
 *
 * Bug que originou este arquivo (visto em produção): a VPS roda em
 * America/Chicago, e `<input type="date">` manda "2026-10-10". `new Date(...)`
 * disso é MEIA-NOITE UTC, que formatada no fuso do servidor aparece como
 * 09/10/2026 — um dia antes do digitado — e fazia o prazo encerrar no meio da
 * tarde do dia anterior.
 *
 * Os testes abaixo conferem três coisas:
 *  1. a data digitada é gravada ao meio-dia do Brasil (não muda de dia em NENHUM
 *     fuso: servidor nos EUA, navegador no Brasil, UTC);
 *  2. prazo é inclusivo (vale até o último segundo do dia escolhido);
 *  3. formatação é sempre no fuso do Brasil, independente da máquina.
 */

describe('gravação de data vinda do formulário', () => {
  it('"AAAA-MM-DD" vira MEIO-DIA UTC (09:00 em Brasília), não meia-noite', () => {
    const data = parseDataDoFormulario('2026-10-10');

    expect(data).not.toBeNull();
    expect(data!.toISOString()).toBe('2026-10-10T12:00:00.000Z');
    expect(partesNoBrasil(data!)).toMatchObject({ ano: 2026, mes: 10, dia: 10, hora: 9 });
  });

  it('o dia NÃO muda em nenhum fuso (o bug era justamente esse)', () => {
    const data = parseDataDoFormulario('2026-10-10')!;

    // O mesmo instante visto de três fusos diferentes: sempre 10/10.
    for (const fuso of ['America/Sao_Paulo', 'America/Chicago', 'UTC', 'Asia/Tokyo']) {
      const dia = new Intl.DateTimeFormat('pt-BR', {
        timeZone: fuso,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(data);
      expect(dia, `fuso ${fuso}`).toBe('10/10/2026');
    }
  });

  it('aceita datetime-local como horário de Brasília', () => {
    const data = parseDataDoFormulario('2026-10-10T14:30')!;
    expect(data.toISOString()).toBe('2026-10-10T17:30:00.000Z');
  });

  it('respeita ISO já com fuso (não reinterpreta)', () => {
    expect(parseDataDoFormulario('2026-10-10T14:30:00-03:00')!.toISOString()).toBe('2026-10-10T17:30:00.000Z');
    expect(parseDataDoFormulario('2026-10-10T17:30:00Z')!.toISOString()).toBe('2026-10-10T17:30:00.000Z');
  });

  it('vazio ou inválido devolve null (o chamador decide)', () => {
    for (const vazio of [null, undefined, '', '   ']) {
      expect(parseDataDoFormulario(vazio)).toBeNull();
    }
    expect(parseDataDoFormulario('ontem')).toBeNull();
    expect(parseDataDoFormulario('2026-13-45')).toBeNull();
    expect(parseDataDoFormulario(42)).toBeNull();
  });

  it('mantém o dia em datas de virada de mês/ano', () => {
    expect(partesNoBrasil(parseDataDoFormulario('2026-01-01')!)).toMatchObject({ ano: 2026, mes: 1, dia: 1 });
    expect(partesNoBrasil(parseDataDoFormulario('2026-12-31')!)).toMatchObject({ ano: 2026, mes: 12, dia: 31 });
    expect(partesNoBrasil(parseDataDoFormulario('2028-02-29')!)).toMatchObject({ ano: 2028, mes: 2, dia: 29 });
  });
});

describe('prazo é inclusivo (fim do dia no Brasil)', () => {
  it('fim do dia é 23:59:59.999 em Brasília', () => {
    const prazo = parseDataDoFormulario('2026-10-10')!;
    const fim = fimDoDiaBrasil(prazo);

    expect(partesNoBrasil(fim)).toMatchObject({ ano: 2026, mes: 10, dia: 10, hora: 23, minuto: 59, segundo: 59 });
    // 23:59:59.999 em Brasília = 02:59:59.999 UTC do dia seguinte.
    expect(fim.toISOString()).toBe('2026-10-11T02:59:59.999Z');
  });

  it('uma inscrição às 22h do ÚLTIMO dia ainda está dentro do prazo', () => {
    const prazo = parseDataDoFormulario('2026-10-10')!;
    const ultimaHoraDoPrazo = instanteNoBrasil(2026, 10, 10, 22, 0, 0);

    expect(ultimaHoraDoPrazo.getTime()).toBeGreaterThan(prazo.getTime());
    expect(ultimaHoraDoPrazo.getTime()).toBeLessThanOrEqual(fimDoDiaBrasil(prazo).getTime());
  });

  it('um minuto depois do fim já está fora', () => {
    const prazo = parseDataDoFormulario('2026-10-10')!;
    const depois = instanteNoBrasil(2026, 10, 11, 0, 0, 0, 1);

    expect(depois.getTime()).toBeGreaterThan(fimDoDiaBrasil(prazo).getTime());
  });

  it('início do dia é 00:00 em Brasília (não abre na véspera)', () => {
    const abertura = parseDataDoFormulario('2026-10-10')!;
    const inicio = inicioDoDiaBrasil(abertura);

    expect(inicio.toISOString()).toBe('2026-10-10T03:00:00.000Z');
    expect(partesNoBrasil(inicio)).toMatchObject({ dia: 10, hora: 0, minuto: 0, segundo: 0 });
  });
});

describe('formatação sempre no fuso do Brasil', () => {
  it('formata data no padrão brasileiro', () => {
    const data = parseDataDoFormulario('2026-10-10')!;
    expect(formatarDataBrasil(data)).toBe('10 de outubro de 2026');
    expect(formatarDataBrasil(data, { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe('10/10/2026');
  });

  it('formata data e hora de um timestamp real', () => {
    // 17:30 UTC = 14:30 em Brasília. O `pt-BR` separa data e hora com vírgula.
    expect(formatarDataHoraBrasil('2026-10-10T17:30:00Z')).toBe('10/10/2026, 14:30');
  });

  it('um instante de madrugada em Brasília aparece no dia certo', () => {
    // 00:30 em Brasília do dia 10 = 03:30 UTC.
    expect(formatarDataBrasil('2026-10-10T03:30:00Z', { day: '2-digit', month: '2-digit' })).toBe('10/10');
    // O MESMO instante em UTC ainda é dia 10; em Chicago é dia 9 — e o portal
    // mostra sempre o dia do Brasil.
    expect(formatarDataBrasil('2026-10-10T03:30:00Z', { day: '2-digit', month: '2-digit', year: 'numeric' }))
      .toBe('10/10/2026');
  });

  it('o fuso usado é o do Brasil', () => {
    expect(FUSO_BRASIL).toBe('America/Sao_Paulo');
  });
});

describe('calendário brasileiro (mês, ano, chave do dia)', () => {
  it('mês e ano saem do calendário do Brasil, não do fuso da máquina', () => {
    // 30/06 às 23:00 em Brasília (02:00 UTC de 01/07): no Brasil ainda é JUNHO.
    const virada = new Date('2026-07-01T02:00:00Z');
    expect(mesNoBrasil(virada)).toBe(6);
    expect(chaveDoDiaBrasil(virada)).toBe('2026-06-30');
  });

  it('virada de ano também respeita o Brasil', () => {
    // 31/12 às 22:30 em Brasília = 01/01 01:30 UTC.
    const reveillon = new Date('2027-01-01T01:30:00Z');
    expect(chaveDoDiaBrasil(reveillon)).toBe('2026-12-31');
    expect(mesNoBrasil(reveillon)).toBe(12);
  });

  it('o deslocamento do Brasil é de -3 horas', () => {
    // -3h em milissegundos (o horário de verão não existe no Brasil desde 2019,
    // mas o cálculo é feito em tempo de execução para continuar certo se voltar).
    expect(deslocamentoBrasilMs(new Date('2026-10-10T15:00:00Z'))).toBe(-3 * 60 * 60 * 1000);
  });

  it('chave do dia tem o formato de comparação AAAA-MM-DD', () => {
    expect(chaveDoDiaBrasil(instanteNoBrasil(2026, 3, 5, 12))).toBe('2026-03-05');
  });
});
