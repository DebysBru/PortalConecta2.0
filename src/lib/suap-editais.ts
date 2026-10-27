/**
 * Editais do SUAP capturados pelo navegador (listas web, não a API).
 *
 * Por que existe: a API do SUAP não expõe editais (ver DOCUMENTACAO/EDITAIS_IFPR.md),
 * mas a interface web lista os três tipos que o campus usa:
 *
 *   - /pesquisa/editais/         → pesquisa
 *   - /projetos/editais/         → projetos de extensão
 *   - /projetos_ensino/editais/  → projetos de ensino
 *
 * O script `public/modelos/capturar-suap-semanal.js` lê essas páginas de dentro da
 * sessão logada (o servidor do portal é barrado pelo WAF) e entrega, para cada
 * cartão, **os textos como o SUAP mostra** — este módulo é quem interpreta datas,
 * calcula a identidade e o status. Assim a parte que muda quando o SUAP muda o
 * texto (as datas) fica no servidor, testável, e o script continua burro.
 *
 * Módulo puro (sem Prisma, sem DOM): roda no servidor e nos testes.
 */

export type FonteEdital = 'pesquisa' | 'projetos' | 'ensino';

export const FONTES_EDITAL: Record<
  FonteEdital,
  { caminho: string; rotulo: string; categoria: 'PESQUISA' | 'EXTENSAO' | 'ENSINO'; areaEdital: 'PESQUISA' | 'EXTENSAO' | null }
> = {
  pesquisa: { caminho: '/pesquisa/editais/', rotulo: 'Pesquisa', categoria: 'PESQUISA', areaEdital: 'PESQUISA' },
  projetos: { caminho: '/projetos/editais/', rotulo: 'Projetos de extensão', categoria: 'EXTENSAO', areaEdital: 'EXTENSAO' },
  // Sem equivalente na lista de áreas do site do IFPR: a categoria ENSINO já filtra.
  ensino: { caminho: '/projetos_ensino/editais/', rotulo: 'Projetos de ensino', categoria: 'ENSINO', areaEdital: null },
};

export const ORIGEM_SUAP_EDITAL = 'suap-edital:';

/** Como o script entrega cada cartão (textos crus, já sem espaços duplicados). */
export interface EditalCapturado {
  fonte: FonteEdital;
  titulo: string;
  descricao: string;
  /** "26/10/2026 00:00:00 a 04/11/2026 00:00:00" */
  inscricoes: string;
  /** "30 de Outubro de 2026 às 00:00 - 31 de Outubro de 2026 às 00:00" */
  preSelecao: string;
  selecao: string;
  recurso: string;
  /** "5 de Novembro de 2026 às 00:00" */
  resultado: string;
  /** "IVAIPODG" */
  campi: string;
  temArquivo: boolean;
}

export type EditalComChave = EditalCapturado & { chave: string };

// ─── Identidade ───────────────────────────────────────────────────────────────

/**
 * Os cartões do SUAP **não mostram o ID** do edital, então a identidade é
 * fonte + título normalizado + ano de abertura das inscrições. O ano entra porque
 * o mesmo título costuma se repetir de um ano para o outro.
 *
 * ATENÇÃO: a mesma regra existe no script do navegador (bloco `chave-edital` de
 * `public/modelos/capturar-suap-semanal.js`) — é com ela que o script descarta o
 * que o portal já tem. `tests/suap-captura-script.test.ts` roda os dois lados e
 * trava a igualdade.
 */
export function chaveEdital(fonte: string, titulo: string, inscricoes: string): string {
  const slug = String(titulo || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150)
    .replace(/-+$/g, '');
  const ano = (String(inscricoes || '').match(/\d{2}\/\d{2}\/(\d{4})/) || [])[1] || '0';
  return `${ORIGEM_SUAP_EDITAL}${fonte}:${slug}:${ano}`;
}

// ─── Datas ────────────────────────────────────────────────────────────────────

/** O SUAP mostra horário de Brasília (UTC-3, sem horário de verão desde 2019). */
const DESLOCAMENTO_BRASILIA_H = 3;

function dataBrasilia(ano: number, mes: number, dia: number, hora = 0, minuto = 0, segundo = 0): Date | null {
  const d = new Date(Date.UTC(ano, mes - 1, dia, hora + DESLOCAMENTO_BRASILIA_H, minuto, segundo));
  // Rejeita 31/02 e afins: Date.UTC "rola" o dia para o mês seguinte sem avisar.
  const voltou = new Date(d.getTime() - DESLOCAMENTO_BRASILIA_H * 3600_000);
  if (voltou.getUTCFullYear() !== ano || voltou.getUTCMonth() !== mes - 1 || voltou.getUTCDate() !== dia) return null;
  return d;
}

/** Todas as datas "dd/mm/aaaa [hh:mm[:ss]]" de um texto, na ordem em que aparecem. */
export function datasNumericas(texto: string): Date[] {
  const achadas: Date[] = [];
  const re = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/g;
  for (const m of String(texto || '').matchAll(re)) {
    const d = dataBrasilia(+m[3], +m[2], +m[1], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0);
    if (d) achadas.push(d);
  }
  return achadas;
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/** Todas as datas "30 de Outubro de 2026 [às 15:25]" de um texto. */
export function datasPorExtenso(texto: string): Date[] {
  const achadas: Date[] = [];
  const re = /(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s+de\s+(\d{4})(?:\s+às\s+(\d{1,2}):(\d{2}))?/gi;
  for (const m of String(texto || '').matchAll(re)) {
    const mes = MESES[m[2].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()];
    if (!mes) continue;
    const d = dataBrasilia(+m[3], mes, +m[1], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
    if (d) achadas.push(d);
  }
  return achadas;
}

export function formatarDataBr(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export interface CronogramaEdital {
  inscricaoInicio: Date | null;
  inscricaoFim: Date | null;
  preSelecaoInicio: Date | null;
  preSelecaoFim: Date | null;
  selecaoInicio: Date | null;
  selecaoFim: Date | null;
  recursoInicio: Date | null;
  recursoFim: Date | null;
  resultado: Date | null;
}

/**
 * Um período só vale se terminar depois de começar. O SUAP deixa passar datas
 * incoerentes (visto em 27/10/2026: recurso "3 de Novembro às 00:00 - 1 de
 * Novembro às 15:25"), e usar isso como prazo faria o status ficar errado.
 */
function periodo(texto: string, ler: (t: string) => Date[]): [Date | null, Date | null] {
  const [ini, fim] = ler(texto);
  if (ini && fim && fim.getTime() < ini.getTime()) return [ini, null];
  return [ini ?? null, fim ?? null];
}

export function lerCronograma(e: Pick<EditalCapturado, 'inscricoes' | 'preSelecao' | 'selecao' | 'recurso' | 'resultado'>): CronogramaEdital {
  const [inscricaoInicio, inscricaoFim] = periodo(e.inscricoes, datasNumericas);
  const [preSelecaoInicio, preSelecaoFim] = periodo(e.preSelecao, datasPorExtenso);
  const [selecaoInicio, selecaoFim] = periodo(e.selecao, datasPorExtenso);
  const [recursoInicio, recursoFim] = periodo(e.recurso, datasPorExtenso);
  return {
    inscricaoInicio, inscricaoFim, preSelecaoInicio, preSelecaoFim,
    selecaoInicio, selecaoFim, recursoInicio, recursoFim,
    resultado: datasPorExtenso(e.resultado)[0] ?? null,
  };
}

// ─── Status ───────────────────────────────────────────────────────────────────

export type StatusEditalPortal =
  | 'EM_BREVE' | 'ABERTO' | 'EM_ANALISE' | 'RESULTADO_PARCIAL'
  | 'PRAZO_RECURSO' | 'RESULTADO_PUBLICADO' | 'ENCERRADO';

const DIAS_RESULTADO_EM_DESTAQUE = 30;

/**
 * Status pelas datas reais do cronograma (diferente da importação do site do IFPR,
 * que não tem datas e só estima pelo ano). `agora` entra por parâmetro para o
 * resultado ser previsível e testável.
 *
 * Só usa início e fim das inscrições e a data do resultado — as três que o portal
 * GUARDA no banco (`dataInicio`, `dataEncerramento`, `dataResultado`). É de propósito:
 * assim o status que a importação grava e o que a atualização automática recalcula
 * depois (`src/lib/editais-status.ts`) saem da mesma conta, sem um "desfazer" o
 * outro. O período de recurso do SUAP fica de fora: já apareceu incoerente (termina
 * antes de começar) e o portal não guarda o início dele, então `PRAZO_RECURSO` não
 * é atribuído aqui — o intervalo entre as inscrições e o resultado é `EM_ANALISE`.
 */
export function statusDoEdital(
  c: Pick<CronogramaEdital, 'inscricaoInicio' | 'inscricaoFim' | 'resultado'>,
  agora: Date,
): StatusEditalPortal {
  const t = agora.getTime();
  const ms = (d: Date | null) => (d ? d.getTime() : null);
  const inicio = ms(c.inscricaoInicio);
  const fim = ms(c.inscricaoFim);
  const resultado = ms(c.resultado);

  if (inicio !== null && t < inicio) return 'EM_BREVE';
  if (fim !== null && t <= fim) return 'ABERTO';

  if (fim === null && inicio === null) {
    // Sem datas de inscrição não dá para afirmar nada além do resultado.
    return resultado !== null && t >= resultado ? 'ENCERRADO' : 'ABERTO';
  }
  if (fim === null) return 'ABERTO'; // começou e o SUAP não informa o fim

  if (resultado !== null) {
    if (t < resultado) return 'EM_ANALISE';
    return t - resultado <= DIAS_RESULTADO_EM_DESTAQUE * 86400_000 ? 'RESULTADO_PUBLICADO' : 'ENCERRADO';
  }
  return 'ENCERRADO';
}

/** O mesmo cálculo a partir do que está gravado no banco (usado na atualização automática). */
export function statusPelasDatas(
  d: { dataInicio: Date | null; dataEncerramento: Date | null; dataResultado: Date | null },
  agora: Date,
): StatusEditalPortal {
  return statusDoEdital({ inscricaoInicio: d.dataInicio, inscricaoFim: d.dataEncerramento, resultado: d.dataResultado }, agora);
}

// ─── Análise da captura ───────────────────────────────────────────────────────

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim() : '';
}

function ehFonteEdital(v: unknown): v is FonteEdital {
  return v === 'pesquisa' || v === 'projetos' || v === 'ensino';
}

function normalizaSigla(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

export interface ResultadoCapturaEditais {
  editais: EditalComChave[];
  erros: { indice: number; motivo: string }[];
  avisos: string[];
  resumo: { porFonte: Record<string, number>; outroCampus: number; siglaAlvo: string };
}

export function analisarEditaisCapturados(brutos: unknown[], siglaAlvo = 'IVAIPODG'): ResultadoCapturaEditais {
  const alvo = normalizaSigla(siglaAlvo);
  const erros: { indice: number; motivo: string }[] = [];
  const avisos: string[] = [];
  const editais: EditalComChave[] = [];
  const posicao = new Map<string, number>();
  const porFonte: Record<string, number> = {};
  let outroCampus = 0;
  let semDatas = 0;

  brutos.forEach((bruto, i) => {
    if (!bruto || typeof bruto !== 'object') {
      erros.push({ indice: i + 1, motivo: 'não é um objeto' });
      return;
    }
    const item = bruto as Record<string, unknown>;
    if (!ehFonteEdital(item.fonte)) {
      erros.push({ indice: i + 1, motivo: 'sem a fonte (pesquisa, projetos ou ensino)' });
      return;
    }
    const titulo = texto(item.titulo);
    if (!titulo) {
      erros.push({ indice: i + 1, motivo: 'sem título' });
      return;
    }

    const capturado: EditalCapturado = {
      fonte: item.fonte,
      titulo,
      descricao: typeof item.descricao === 'string' ? item.descricao.replace(/[ \t]+/g, ' ').trim() : '',
      inscricoes: texto(item.inscricoes),
      preSelecao: texto(item.preSelecao),
      selecao: texto(item.selecao),
      recurso: texto(item.recurso),
      resultado: texto(item.resultado),
      campi: texto(item.campi),
      temArquivo: item.temArquivo === true,
    };

    // O script já pede só o campus ao SUAP; isto é a segunda trava. Sem o campo
    // "Para os Campi" no cartão, confiamos no filtro da própria URL.
    if (capturado.campi && !normalizaSigla(capturado.campi).split(/[^A-Z0-9]+/).includes(alvo)) {
      outroCampus++;
      return;
    }

    if (datasNumericas(capturado.inscricoes).length === 0) semDatas++;

    const chave = chaveEdital(capturado.fonte, capturado.titulo, capturado.inscricoes);
    const existente = posicao.get(chave);
    if (existente !== undefined) {
      avisos.push(`Dois editais com o mesmo título e ano em "${FONTES_EDITAL[capturado.fonte].rotulo}": "${titulo}". Foi considerado um só.`);
      editais[existente] = { ...capturado, chave };
      return;
    }
    posicao.set(chave, editais.length);
    editais.push({ ...capturado, chave });
    porFonte[capturado.fonte] = (porFonte[capturado.fonte] ?? 0) + 1;
  });

  if (semDatas > 0) {
    avisos.push(`${semDatas} edital(is) sem data de inscrição legível — o status deles é uma estimativa. Confira o texto do SUAP se o layout mudou.`);
  }
  return { editais, erros, avisos, resumo: { porFonte, outroCampus, siglaAlvo: alvo } };
}

// ─── Mapeamento para o portal ─────────────────────────────────────────────────

export interface EditalSuapMapeado {
  origemRef: string;
  titulo: string;
  numero: string | null;
  ano: number | null;
  categoria: 'PESQUISA' | 'EXTENSAO' | 'ENSINO';
  areaEdital: 'PESQUISA' | 'EXTENSAO' | null;
  status: StatusEditalPortal;
  dataInicio: Date | null;
  dataEncerramento: Date | null;
  dataResultado: Date | null;
  prazoRecurso: Date | null;
  resumo: string;
  resumoSimples: string;
  linkOficial: string;
  fonteOficial: string;
  traducaoIFizinha: Record<string, string>;
}

const BASE_SUAP = 'https://suap.ifpr.edu.br';
const LIMITE_RESUMO = 3000;

function numeroDoTitulo(titulo: string): string | null {
  const m = titulo.match(/n[º°o.]?\s*0*(\d{1,3})\s*\/\s*(20\d{2})/i);
  return m ? `${m[1].padStart(2, '0')}/${m[2]}` : null;
}

/**
 * Converte um cartão do SUAP em registro do portal.
 *
 * Regra de honestidade (a mesma de `editais-ifpr.ts`): o texto da IFizinha só diz o
 * que o cartão diz — título, descrição e cronograma. Quem pode participar, valor de
 * bolsa e requisitos estão no PDF, que **não** é lido aqui; o resumo manda abrir o
 * edital oficial. O link do PDF também não é guardado: o SUAP serve o arquivo por
 * um endereço assinado que expira em minutos e exige login.
 */
export function mapearEditalSuap(e: EditalComChave, agora: Date): EditalSuapMapeado {
  const def = FONTES_EDITAL[e.fonte];
  const c = lerCronograma(e);
  const status = statusDoEdital(c, agora);

  const linhas: string[] = [];
  if (c.inscricaoInicio || c.inscricaoFim) {
    linhas.push(
      `Inscrições${c.inscricaoInicio ? ` de ${formatarDataBr(c.inscricaoInicio)}` : ''}${c.inscricaoFim ? ` até ${formatarDataBr(c.inscricaoFim)}` : ''}.`,
    );
  }
  const etapa = (rotulo: string, ini: Date | null, fim: Date | null) =>
    ini ? `${rotulo}: ${formatarDataBr(ini)}${fim ? ` a ${formatarDataBr(fim)}` : ''}.` : null;
  for (const l of [
    etapa('Pré-seleção', c.preSelecaoInicio, c.preSelecaoFim),
    etapa('Seleção', c.selecaoInicio, c.selecaoFim),
    etapa('Recurso', c.recursoInicio, c.recursoFim),
    c.resultado ? `Divulgação do resultado: ${formatarDataBr(c.resultado)}.` : null,
  ]) if (l) linhas.push(l);

  const cronograma = linhas.length
    ? linhas.join(' ')
    : 'O SUAP não informou as datas deste edital — confira no edital oficial.';

  const tipoFrase = { pesquisa: 'de pesquisa', projetos: 'de projetos de extensão', ensino: 'de projetos de ensino' }[e.fonte];

  const ano = c.inscricaoInicio
    ? Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(c.inscricaoInicio))
    : null;

  const resumoSimples =
    `Este é um edital ${tipoFrase} do campus Ivaiporã. ` +
    `${cronograma} ` +
    'Abra o edital oficial para conferir quem pode participar, o que é oferecido e os documentos pedidos.';

  return {
    origemRef: e.chave,
    titulo: e.titulo,
    numero: numeroDoTitulo(e.titulo),
    ano,
    categoria: def.categoria,
    areaEdital: def.areaEdital,
    status,
    dataInicio: c.inscricaoInicio,
    dataEncerramento: c.inscricaoFim,
    dataResultado: c.resultado,
    prazoRecurso: c.recursoFim,
    resumo: (e.descricao || `Edital ${tipoFrase} publicado no SUAP – Campus Ivaiporã.`).slice(0, LIMITE_RESUMO),
    resumoSimples,
    linkOficial: `${BASE_SUAP}${def.caminho}`,
    fonteOficial: 'SUAP – Campus Ivaiporã',
    traducaoIFizinha: {
      oquee: `Edital ${tipoFrase} do campus Ivaiporã, publicado no SUAP. O texto completo está no edital oficial.`,
      quempode: 'Confira no edital oficial quem pode participar.',
      beneficios: '', // não está no cartão do SUAP — não inventamos
      comoinscrever: 'Siga as instruções do edital oficial. O cronograma abaixo vem do SUAP.',
      prazo: cronograma,
      observacoes:
        'Importado do SUAP pela carga semanal. As datas valem como estavam no SUAP na hora da captura; ' +
        'em caso de divergência, vale o edital oficial.',
    },
  };
}
