/**
 * Datas do portal — tudo no fuso do Brasil.
 *
 * POR QUE ESTE ARQUIVO EXISTE (bug real, visto em produção em 05/10/2026):
 *
 * 1. A VPS roda em `America/Chicago`. Um prazo digitado no formulário
 *    (`<input type="date">` manda a string "2026-10-10") virava
 *    `new Date('2026-10-10')` = **meia-noite UTC**. Formatado no fuso do
 *    servidor, isso aparece como **09/10/2026** — um dia antes do que a
 *    coordenação digitou. Pior: o prazo *encerrava* às 21h de Brasília do dia 9,
 *    ou seja, o estudante perdia o último dia para se inscrever.
 *
 * 2. Timestamps (`createdAt`) formatados no servidor saíam com 2h de diferença do
 *    horário de Brasília, e a conta de "semestre atual" (que decide quando o
 *    portal avança o semestre do aluno sozinho) também usava o fuso da máquina.
 *
 * COMO FICA:
 *  - Data "só dia" (prazo, data de evento) é gravada ao **meio-dia UTC**. Nesse
 *    horário, qualquer fuso entre UTC-12 e UTC+11 mostra o MESMO dia na tela —
 *    então o valor não muda de dia no servidor (EUA), no navegador do aluno
 *    (Brasil) nem em nenhum lugar do mundo. Meio-dia *de Brasília* não bastava:
 *    às 15:00 UTC, Tóquio (UTC+9) já está no dia seguinte.
 *  - Prazo é **inclusivo**: vale até 23:59:59.999 do dia escolhido no Brasil
 *    (`fimDoDiaBrasil`). Antes, "encerra em 10/10" parava de aceitar na virada.
 *  - Toda formatação no servidor usa `timeZone: 'America/Sao_Paulo'` explícito,
 *    em vez de depender do fuso da máquina.
 *  - O serviço roda com `TZ=America/Sao_Paulo` (systemd) e os testes também
 *    (`vitest.config.ts`), então `new Date()` e `getMonth()` falam brasileiro.
 */

export const FUSO_BRASIL = 'America/Sao_Paulo';

/** Partes do calendário no fuso do Brasil para um instante qualquer. */
export function partesNoBrasil(instante: Date): {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
} {
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO_BRASIL,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const partes: Record<string, string> = {};
  for (const parte of formatador.formatToParts(instante)) {
    partes[parte.type] = parte.value;
  }

  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    // `hour` vem "24" à meia-noite em alguns runtimes.
    hora: Number(partes.hour) % 24,
    minuto: Number(partes.minute),
    segundo: Number(partes.second),
  };
}

/**
 * Quanto o relógio do Brasil está atrás do UTC, em milissegundos (-3h hoje).
 *
 * Calculado em tempo de execução para continuar certo se o horário de verão
 * voltar a existir. Os milissegundos são descartados dos DOIS lados: o fuso é
 * sempre um múltiplo de segundo, e comparar o relógio de parede (que vem sem
 * fração) com um instante com fração daria um erro de até 1 segundo — o
 * suficiente para o "fim do dia" cair no segundo seguinte.
 */
export function deslocamentoBrasilMs(instante: Date): number {
  const p = partesNoBrasil(instante);
  const comoSeFosseUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  const instanteSemFracao = Math.floor(instante.getTime() / 1000) * 1000;
  return comoSeFosseUtc - instanteSemFracao;
}

/**
 * Instante correspondente a uma data/hora do relógio BRASILEIRO.
 * `instanteNoBrasil(2026, 10, 10, 12)` = meio-dia de 10/10/2026 em Brasília.
 */
export function instanteNoBrasil(
  ano: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0,
  segundo = 0,
  ms = 0,
): Date {
  const paredeDeRelogio = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo, ms);
  // Duas passadas: a primeira acha o deslocamento aproximado, a segunda acerta
  // caso o instante caia do outro lado de uma mudança de horário de verão.
  const primeira = new Date(paredeDeRelogio - deslocamentoBrasilMs(new Date(paredeDeRelogio)));
  return new Date(paredeDeRelogio - deslocamentoBrasilMs(primeira));
}

/**
 * Converte o valor vindo de um formulário em `Date`.
 *
 * - "2026-10-10" (input `type="date"`) → **meio-dia UTC** (09:00 em Brasília), o
 *   horário que mantém o mesmo dia em qualquer fuso entre UTC-12 e UTC+11 (ver o
 *   comentário do topo: é o que impede a data de "andar" um dia);
 * - "2026-10-10T14:30" (input `datetime-local`, sem fuso) → 14:30 no Brasil,
 *   porque é a hora de parede de quem digitou;
 * - ISO completo com fuso ("...Z", "-03:00") → instante exato, sem reinterpretar;
 * - vazio, fora do calendário (13º mês, 31/02) ou inválido → `null`.
 */
export function parseDataDoFormulario(valor: unknown): Date | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor !== 'string') return null;

  const texto = valor.trim();
  if (texto === '') return null;

  const somenteDia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (somenteDia) {
    const ano = Number(somenteDia[1]);
    const mes = Number(somenteDia[2]);
    const dia = Number(somenteDia[3]);

    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    // "31/02" não existe: o Date "rolaria" para 03/03 e o prazo sairia errado.
    const conferencia = new Date(Date.UTC(ano, mes - 1, dia));
    if (conferencia.getUTCMonth() !== mes - 1 || conferencia.getUTCDate() !== dia) return null;

    return new Date(Date.UTC(ano, mes - 1, dia, 12));
  }

  // `datetime-local` manda "2026-10-10T14:30" (às vezes com segundos) e SEM fuso:
  // o valor é a hora de parede de quem digitou, ou seja, horário de Brasília.
  const semFuso = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(texto);
  if (semFuso) {
    const [, ano, mes, dia, hora, minuto, segundo] = semFuso;
    return instanteNoBrasil(Number(ano), Number(mes), Number(dia), Number(hora), Number(minuto), Number(segundo ?? 0));
  }

  const comFuso = new Date(texto);
  return Number.isNaN(comFuso.getTime()) ? null : comFuso;
}

/** 00:00:00.000 do dia (no Brasil) a que o instante pertence. */
export function inicioDoDiaBrasil(valor: Date | string): Date {
  const instante = typeof valor === 'string' ? new Date(valor) : valor;
  const { ano, mes, dia } = partesNoBrasil(instante);
  return instanteNoBrasil(ano, mes, dia, 0, 0, 0, 0);
}

/**
 * 23:59:59.999 do dia (no Brasil) a que o instante pertence.
 * É o que torna prazo INCLUSIVO: "encerra em 10/10" aceita até o fim do dia 10.
 */
export function fimDoDiaBrasil(valor: Date | string): Date {
  const instante = typeof valor === 'string' ? new Date(valor) : valor;
  const { ano, mes, dia } = partesNoBrasil(instante);
  return instanteNoBrasil(ano, mes, dia, 23, 59, 59, 999);
}

/** Data no formato brasileiro (ex.: "10 de outubro de 2026"), sempre no fuso do Brasil. */
export function formatarDataBrasil(
  valor: Date | string,
  opcoes: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' },
): string {
  const instante = typeof valor === 'string' ? new Date(valor) : valor;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_BRASIL, ...opcoes }).format(instante);
}

/** Data e hora brasileiras (ex.: "10/10/2026 14:30"). */
export function formatarDataHoraBrasil(valor: Date | string): string {
  return formatarDataBrasil(valor, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Mês (1..12) no Brasil — para regras de semestre/calendário. */
export function mesNoBrasil(valor: Date = new Date()): number {
  return partesNoBrasil(valor).mes;
}

/** Ano no Brasil. */
export function anoNoBrasil(valor: Date = new Date()): number {
  return partesNoBrasil(valor).ano;
}

/** Dia no formato "AAAA-MM-DD" no Brasil (chave de comparação de calendário). */
export function chaveDoDiaBrasil(valor: Date = new Date()): string {
  const { ano, mes, dia } = partesNoBrasil(valor);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
