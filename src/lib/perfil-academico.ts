/**
 * Catálogo acadêmico do campus e cálculo do semestre do estudante.
 *
 * POR QUE ESTE ARQUIVO É PURO (sem Prisma, sem React, sem `'use client'`):
 * as mesmas regras precisam valer em três lugares diferentes — o formulário de
 * inscrição (client), o "Meu Perfil" (client) e a Server Action que grava o
 * perfil (server). Antes disso a lista de cursos existia SÓ dentro de
 * `src/app/inscricao/[slug]/page.tsx`; o perfil pedia "Curso" como texto livre e
 * os dois lados divergiam (o mesmo aluno aparecia como "Informática" numa tela e
 * "Informática Integrado" na outra). Aqui é o único lugar onde a lista vive, e
 * por ser puro tudo pode ser testado em Node puro (tests/perfil-academico.test.ts).
 *
 * SEMESTRE AUTOMÁTICO: o estudante informa em que semestre está UMA vez; a
 * partir daí o portal avança sozinho a cada semestre (ver `semestreAtual`). O
 * valor gravado é sempre acompanhado da data de referência (`semestreReferencia`
 * em PerfilAluno), que é o que permite o cálculo não depender de cron nenhum.
 */

// ── Catálogo de cursos ───────────────────────────────────────────────────────

export type GrupoCursos = { group: string; options: string[] };

export const CURSOS_SUPERIORES = [
  'Sistemas de Informação',
  'Física',
  'Engenharia Agronômica',
];

export const CURSOS_TECNICOS = [
  'Informática Integrado',
  'Eletrotécnica Integrado',
  'Agropecuária Integrado',
  'Agroecologia Integrado',
  'Eletrotécnica Subsequente',
];

export const CURSOS_FIC = [
  'Formação Inicial e Continuada (FIC)',
];

export const CURSOS_POS = [
  'Pós-graduação',
];

/** Grupos exatamente como aparecem no `<select>` (via `<optgroup>`). */
export const GRUPOS_CURSOS: GrupoCursos[] = [
  { group: 'Cursos Superiores', options: CURSOS_SUPERIORES },
  { group: 'Cursos Técnicos', options: CURSOS_TECNICOS },
  { group: 'Cursos FIC', options: CURSOS_FIC },
  { group: 'Pós-graduação', options: CURSOS_POS },
];

/** Lista achatada — usada para validar o que veio do formulário no servidor. */
export const TODOS_OS_CURSOS: string[] = GRUPOS_CURSOS.flatMap((g) => g.options);

export function ehCursoConhecido(curso: string): boolean {
  return TODOS_OS_CURSOS.includes(curso);
}

// ── Semestre do curso (1º a 10º) ─────────────────────────────────────────────

export const SEMESTRE_MIN = 1;
export const SEMESTRE_MAX = 10;

/** `[1, 2, ..., 10]` — as opções do campo "Semestre". */
export const SEMESTRES: number[] = Array.from(
  { length: SEMESTRE_MAX - SEMESTRE_MIN + 1 },
  (_, i) => i + SEMESTRE_MIN,
);

export function rotuloSemestre(semestre: number): string {
  return `${semestre}º semestre`;
}

export function ehSemestreValido(valor: unknown): valor is number {
  return (
    typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= SEMESTRE_MIN &&
    valor <= SEMESTRE_MAX
  );
}

// ── Ano de ingresso ──────────────────────────────────────────────────────────

/** Piso do catálogo: cursos do campus não têm ingresso antes disso. */
export const PRIMEIRO_ANO_INGRESSO = 2000;

/**
 * Anos oferecidos no `<select>` de "Ano de Ingresso", do mais recente para o
 * mais antigo (o caso comum é o aluno que acabou de entrar).
 */
export function anosDeIngresso(
  hoje: Date = new Date(),
  primeiroAno: number = PRIMEIRO_ANO_INGRESSO,
): number[] {
  const atual = hoje.getFullYear();
  const anos: number[] = [];
  for (let ano = atual; ano >= primeiroAno; ano--) anos.push(ano);
  return anos;
}

export function ehAnoIngressoValido(
  valor: unknown,
  hoje: Date = new Date(),
  primeiroAno: number = PRIMEIRO_ANO_INGRESSO,
): valor is number {
  return (
    typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= primeiroAno &&
    valor <= hoje.getFullYear()
  );
}

/** "Turma 2024" — o rótulo de turma derivado do ano de ingresso. */
export function turmaDeIngresso(anoIngresso: number | null | undefined): string | null {
  return anoIngresso ? `Turma ${anoIngresso}` : null;
}

// ── Calendário letivo ────────────────────────────────────────────────────────

/**
 * Índice absoluto do semestre letivo de uma data: cada ano tem dois semestres.
 * 1º semestre = janeiro a junho; 2º semestre = julho a dezembro.
 *
 * Serve para calcular DIFERENÇAS (quantos semestres se passaram), não para
 * exibir. `indiceSemestre(2026-03-10) - indiceSemestre(2024-08-01) = 3`.
 */
export function indiceSemestre(data: Date): number {
  return data.getFullYear() * 2 + (data.getMonth() <= 5 ? 0 : 1);
}

/** Semestre letivo dentro do ano: 1 (jan–jun) ou 2 (jul–dez). */
export function semestreDoAno(data: Date): 1 | 2 {
  return data.getMonth() <= 5 ? 1 : 2;
}

/** Período letivo legível, no formato usado na inscrição: "2026.1". */
export function periodoLetivo(data: Date = new Date()): string {
  return `${data.getFullYear()}.${semestreDoAno(data)}`;
}

/** Mesmo período, em texto corrido: "2º semestre de 2026". */
export function periodoLetivoLegivel(data: Date = new Date()): string {
  return `${semestreDoAno(data)}º semestre de ${data.getFullYear()}`;
}

function paraData(valor: Date | string | null | undefined): Date | null {
  if (!valor) return null;
  const data = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * Semestre ATUAL do estudante a partir do último valor informado por ele.
 *
 * O estudante diz "estou no 5º semestre" e isso é gravado junto com a data em
 * que foi dito (`referencia`). Depois disso o portal nunca mais pergunta: cada
 * semestre letivo que passa soma 1. Sem cron, sem job, sem tabela de calendário
 * — o cálculo é feito na leitura.
 *
 * Regras que os testes travam:
 *  - sem valor informado → `null` (não inventa semestre);
 *  - referência no mesmo semestre (ou no futuro) → devolve o valor informado;
 *  - referência mais de 10 semestres atrás → satura em 10 (não estoura o
 *    catálogo, e um dado antigo não vira "15º semestre");
 *  - valor fora de 1..10 é normalizado em vez de quebrar a tela.
 */
export function semestreAtual(
  semestreInformado: number | null | undefined,
  referencia: Date | string | null | undefined,
  hoje: Date = new Date(),
): number | null {
  if (typeof semestreInformado !== 'number' || !Number.isFinite(semestreInformado)) {
    return null;
  }

  const base = Math.min(Math.max(Math.trunc(semestreInformado), SEMESTRE_MIN), SEMESTRE_MAX);
  const ref = paraData(referencia);
  if (!ref) return base;

  const delta = indiceSemestre(hoje) - indiceSemestre(ref);
  if (delta <= 0) return base;

  return Math.min(base + delta, SEMESTRE_MAX);
}

// ── Ponte com `Inscricao.semestre` (string, histórico) ──────────────────────

/**
 * Formato que o formulário de inscrição grava em `Inscricao.semestre`:
 * `"<ano de ingresso>.<semestre do curso>"` — `"2024.5"` = entrou em 2024 e está
 * no 5º semestre. Mantido (em vez de virar duas colunas na inscrição) porque
 * relatórios, CSV e as telas de professor/admin já exibem esse texto.
 *
 * ATENÇÃO: inscrições anteriores a esta mudança podem ter sido gravadas como
 * `"2026/1"` (ano letivo / semestre do ano) — formato DIFERENTE, que
 * `parseSemestreInscricao` recusa de propósito. Ver o comentário lá.
 */
export function formatarSemestreInscricao(
  anoIngresso: number | null | undefined,
  semestre: number | null | undefined,
): string {
  if (!anoIngresso || !semestre) return '';
  return `${anoIngresso}.${semestre}`;
}

/**
 * Caminho de volta: lê um `"2024.5"` para pré-preencher perfil/inscrição de quem
 * já tem histórico. Devolve `null` quando não dá para interpretar — nunca chuta.
 *
 * ACEITA **SÓ** O FORMATO QUE O PRÓPRIO PORTAL ESCREVE (`AAAA.S`, com ponto),
 * que é `formatarSemestreInscricao`. Isto é deliberado: o banco real tem
 * inscrições antigas gravadas como `"2026/1"`, que significa **ano letivo /
 * semestre do ano** — outra coisa. Ler `"2026/1"` como "entrou em 2026, está no
 * 1º semestre" marcaria um aluno do 3º ano como calouro. Sem certeza, o campo
 * fica em branco e o estudante escolhe na lista.
 */
export function parseSemestreInscricao(
  valor: string | null | undefined,
): { anoIngresso: number; semestre: number } | null {
  if (!valor) return null;
  const match = /^\s*(\d{4})\s*\.\s*(\d{1,2})\s*$/.exec(valor);
  if (!match) return null;

  const anoIngresso = Number(match[1]);
  const semestre = Number(match[2]);
  if (anoIngresso < PRIMEIRO_ANO_INGRESSO || anoIngresso > 2100) return null;
  if (!ehSemestreValido(semestre)) return null;

  return { anoIngresso, semestre };
}

// ── Fontes dos dados acadêmicos ──────────────────────────────────────────────

/**
 * Um retrato acadêmico do estudante, venha de onde vier. Existe porque o mesmo
 * dado pode estar em três lugares com idades diferentes:
 *
 *  1. `PerfilAluno` (colunas novas: ano_ingresso / semestre_atual) — o que o
 *     estudante confirmou por último;
 *  2. `PerfilAluno` (colunas legadas turma/semestre, texto livre) — o que ele
 *     digitou antes desta mudança;
 *  3. a última `Inscricao` — o que ele preencheu no formulário público.
 *
 * `mesclarFontesAcademicas` resolve a precedência (1 → 2 → 3) campo a campo, em
 * vez de tudo-ou-nada: é comum ter curso no perfil e matrícula só na inscrição.
 */
export type FonteAcademica = {
  curso: string | null;
  anoIngresso: number | null;
  semestre: number | null;
  semestreReferencia: Date | null;
  matricula: string | null;
  telefone: string | null;
  curriculoLattes: string | null;
};

export const FONTE_ACADEMICA_VAZIA: FonteAcademica = {
  curso: null,
  anoIngresso: null,
  semestre: null,
  semestreReferencia: null,
  matricula: null,
  telefone: null,
  curriculoLattes: null,
};

function texto(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

/** "Turma 2024", "turma 2024" ou só "2024" → 2024. */
export function anoDeTurma(turma: string | null | undefined): number | null {
  const match = /(\d{4})/.exec(turma ?? '');
  if (!match) return null;
  const ano = Number(match[1]);
  return ano >= PRIMEIRO_ANO_INGRESSO && ano <= 2100 ? ano : null;
}

/** Colunas NOVAS de `PerfilAluno`. */
export function fonteDePerfil(perfil: {
  curso?: string | null;
  anoIngresso?: number | null;
  semestreAtual?: number | null;
  semestreReferencia?: Date | string | null;
  matricula?: string | null;
  telefone?: string | null;
  curriculoLattes?: string | null;
} | null | undefined): FonteAcademica {
  if (!perfil) return { ...FONTE_ACADEMICA_VAZIA };
  return {
    curso: texto(perfil.curso),
    anoIngresso: typeof perfil.anoIngresso === 'number' ? perfil.anoIngresso : null,
    semestre: ehSemestreValido(perfil.semestreAtual) ? perfil.semestreAtual : null,
    semestreReferencia: paraData(perfil.semestreReferencia),
    matricula: texto(perfil.matricula),
    telefone: texto(perfil.telefone),
    curriculoLattes: texto(perfil.curriculoLattes),
  };
}

/**
 * Colunas LEGADAS de `PerfilAluno` e/ou de uma `Inscricao` — as duas guardam
 * turma/semestre como texto (`"Turma 2024"`, `"2024.5"`), então a leitura é a
 * mesma. A referência do semestre fica nula de propósito: sem saber QUANDO o
 * texto foi escrito, o semestre é tratado como "o que foi informado", sem
 * avanço automático (inventar avanço aqui seria chutar).
 */
export function fonteDeLegado(registro: {
  curso?: string | null;
  turma?: string | null;
  semestre?: string | null;
  matricula?: string | null;
  telefone?: string | null;
  curriculoLattes?: string | null;
} | null | undefined): FonteAcademica {
  if (!registro) return { ...FONTE_ACADEMICA_VAZIA };

  const doSemestre = parseSemestreInscricao(registro.semestre);
  const daTurma = anoDeTurma(registro.turma);

  return {
    curso: texto(registro.curso),
    // A turma é a origem mais confiável do ano de ingresso ("Turma 2024" é
    // gerado pelo próprio portal); o ano do "2024.5" só entra se não houver turma.
    anoIngresso: daTurma ?? doSemestre?.anoIngresso ?? null,
    semestre: doSemestre?.semestre ?? null,
    semestreReferencia: null,
    matricula: texto(registro.matricula),
    telefone: texto(registro.telefone),
    curriculoLattes: texto(registro.curriculoLattes),
  };
}

/** Primeiro valor preenchido de cada campo, na ordem das fontes (a 1ª vence). */
export function mesclarFontesAcademicas(
  ...fontes: Array<Partial<FonteAcademica> | null | undefined>
): FonteAcademica {
  const resultado: FonteAcademica = { ...FONTE_ACADEMICA_VAZIA };

  for (const fonte of fontes) {
    if (!fonte) continue;
    if (resultado.curso === null) resultado.curso = texto(fonte.curso ?? null);
    if (resultado.anoIngresso === null && typeof fonte.anoIngresso === 'number') {
      resultado.anoIngresso = fonte.anoIngresso;
    }
    if (resultado.semestre === null && ehSemestreValido(fonte.semestre)) {
      resultado.semestre = fonte.semestre;
    }
    if (resultado.semestreReferencia === null) {
      resultado.semestreReferencia = paraData(fonte.semestreReferencia ?? null);
    }
    if (resultado.matricula === null) resultado.matricula = texto(fonte.matricula ?? null);
    if (resultado.telefone === null) resultado.telefone = texto(fonte.telefone ?? null);
    if (resultado.curriculoLattes === null) {
      resultado.curriculoLattes = texto(fonte.curriculoLattes ?? null);
    }
  }

  return resultado;
}

