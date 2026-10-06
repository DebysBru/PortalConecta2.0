/**
 * Extração dos editais do Campus Ivaiporã publicados no site do IFPR.
 *
 * POR QUE NÃO PELO SUAP: a API do SUAP **não tem endpoint de edital** (as 93 rotas
 * do `openapi.json` foram conferidas: só existem `/api/extensao/projetos/` e
 * `/api/pesquisa/projetos/`). Os editais do campus vivem no site institucional,
 * em páginas que listam os PDFs — e é de lá que este módulo lê.
 *
 * COMO LÊ: usa a API REST do WordPress do IFPR (mesma fonte do site, sem HTML
 * solto de layout), buscando as páginas que mencionam "edital" e extraindo os
 * links de cada uma. O site do IFPR está atrás do WAF da AWS (a VPS recebe
 * `202` + `x-amzn-waf-action: challenge`), mas a API REST devolve
 * `Access-Control-Allow-Origin` para o domínio do portal — por isso o módulo é
 * **isomórfico** (sem `fs`, sem `Buffer`) e funciona tanto no servidor quanto no
 * navegador do admin, que passa pelo desafio como usuário normal.
 *
 * O que a extração dá e o que NÃO dá: título, link do PDF, tipo (edital,
 * resultado, retificação, portaria), ano e área vêm do site. **Datas de inscrição
 * não vêm** — elas estão dentro do PDF. Quem for importar para o portal precisa
 * decidir o que usar como data.
 */

export type TipoDocumento = 'EDITAL' | 'RESULTADO' | 'RETIFICACAO' | 'PORTARIA' | 'PRORROGACAO' | 'OUTRO';

export type AreaEdital =
  | 'ASSISTENCIA_ESTUDANTIL'
  | 'BOLSAS'
  | 'SERVIDORES'
  | 'FIC'
  | 'ENSINO_SUPERIOR'
  | 'TECNICO'
  | 'POS_GRADUACAO'
  | 'CELIF'
  | 'PESQUISA'
  | 'EXTENSAO'
  | 'INSTITUCIONAL'
  | 'OUTRO';

export interface EditalExtraido {
  titulo: string;
  url: string;
  arquivo: string;
  tipo: TipoDocumento;
  area: AreaEdital;
  ano: number | null;
  pagina: { titulo: string; url: string };
}

export interface ResultadoExtracao {
  itens: EditalExtraido[];
  paginasVarridas: number;
  paginasComItens: number;
  avisos: string[];
}

const API_PADRAO = 'https://ifpr.edu.br/ivaipora/wp-json/wp/v2';
const BASE_PADRAO = 'https://ifpr.edu.br/ivaipora';

// ─── Classificação ────────────────────────────────────────────────────────────

const ROTULOS_GENERICOS = /^(📄\s*)?(acessar|clique|baixar|download|ver|veja|abrir|leia|consulte|saiba mais)\b|^edital$|^documento$|^pdf$/i;

/**
 * O rótulo precisa de contexto?
 *
 * No site do IFPR convivem rótulos ótimos ("Edital nº 03/2026 – Inscrição para
 * monitoria voluntária") e rótulos que não identificam nada ("✅ Resultado da
 * Seleção", "📝 Ficha de Inscrição"). Nesses casos o documento entra com o
 * contexto da página/cabeçalho na frente — foi o que apareceu na extração real,
 * com 1.585 documentos: sem isso, dezenas ficavam com o mesmo título inútil.
 */
function precisaDeContexto(rotulo: string): boolean {
  if (!rotulo) return true;
  if (ROTULOS_GENERICOS.test(rotulo)) return true;
  // sem nenhum número (nº do edital, ano, SEI) e curtinho: não identifica nada
  const semNumero = !/\d/.test(rotulo);
  return semNumero && rotulo.length < 40;
}

/** Decide o tipo pelo texto do rótulo/arquivo. Ordem importa (retificação antes de edital). */
export function classificarTipo(texto: string): TipoDocumento {
  const t = texto.toLowerCase();
  if (/retifica|errata/.test(t)) return 'RETIFICACAO';
  if (/prorrog/.test(t)) return 'PRORROGACAO';
  if (/resultado|homologa|gabarito|classificad|aprovad|convoc|lista (de )?(inscrit|aprovad)|nota final/.test(t)) return 'RESULTADO';
  if (/portaria|instru[cç][aã]o normativa|resolu[cç][aã]o/.test(t)) return 'PORTARIA';
  if (/edital|chamada|processo seletivo|sele[cç][aã]o/.test(t)) return 'EDITAL';
  return 'OUTRO';
}

/** Deduz a área pelo caminho da página de origem. */
export function classificarArea(urlPagina: string): AreaEdital {
  const u = urlPagina.toLowerCase();
  if (/assistencia-estudantil|sepae/.test(u)) return 'ASSISTENCIA_ESTUDANTIL';
  if (/copex|bolsas/.test(u)) return 'BOLSAS';
  if (/segepe|servidores|pss|contratac/.test(u)) return 'SERVIDORES';
  if (/\/fics?\//.test(u)) return 'FIC';
  if (/ensino-superior|graduac/.test(u)) return 'ENSINO_SUPERIOR';
  if (/cursos-tecnicos|tecnicos|integrad|subsequente/.test(u)) return 'TECNICO';
  if (/pos-graduacao|especializa|mestrado/.test(u)) return 'POS_GRADUACAO';
  if (/celif|linguas/.test(u)) return 'CELIF';
  if (/pesquisa|pibic|iniciacao-cientifica/.test(u)) return 'PESQUISA';
  if (/extensao|extens/.test(u)) return 'EXTENSAO';
  if (/documentos-institucionais|institucional/.test(u)) return 'INSTITUCIONAL';
  return 'OUTRO';
}

/** Tira tags/entidades do HTML de um trecho. */
export function limparTexto(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nome do arquivo, legível, para quando o rótulo do link não diz nada. */
function nomeDoArquivo(url: string): string {
  const semQuery = url.split('?')[0].split('#')[0];
  const ultimo = decodeURIComponent(semQuery.split('/').filter(Boolean).pop() ?? '');
  return ultimo
    .replace(/\.pdf$/i, '')
    .replace(/[_+]+/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ano do documento: primeiro nos 20xx do texto, depois no caminho/mês da URL. */
export function extrairAno(texto: string, url: string): number | null {
  const doTexto = texto.match(/\b(20\d{2})\b/);
  if (doTexto) return Number(doTexto[1]);
  const daUrl = url.match(/\/(20\d{2})\//);
  return daUrl ? Number(daUrl[1]) : null;
}

// ─── Extração do HTML de uma página ───────────────────────────────────────────

/**
 * Extrai os documentos de edital do HTML de uma página.
 *
 * Duas formas reais no site do IFPR (ambas cobertas por fixtures em tests/fixtures):
 *  - página-hub de documentos: `<h2>2023</h2>` + parágrafos com `<a>Edital 68 …</a>`
 *    (rótulo já descritivo);
 *  - cards de programa: `<a class="botao botao-edital">📄 Acessar Edital</a>`
 *    (rótulo genérico — aí o título vem do título da página/arquivo).
 */
export function extrairEditaisDePagina(
  html: string,
  pagina: { titulo: string; url: string },
  base = BASE_PADRAO,
): EditalExtraido[] {
  if (!html) return [];

  // Cabeçalhos que antecedem cada link, para dar contexto quando o rótulo é genérico.
  const cabecalhos: Array<{ posicao: number; texto: string; ano: number | null }> = [];
  for (const m of html.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const texto = limparTexto(m[2]);
    if (texto) cabecalhos.push({ posicao: m.index ?? 0, texto, ano: extrairAno(texto, '') });
  }

  const itens: EditalExtraido[] = [];
  const vistos = new Set<string>();

  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const hrefBruto = m[1];
    if (/^(mailto:|tel:|#)/i.test(hrefBruto)) continue;

    let url: string;
    try {
      url = new URL(hrefBruto.replace(/&amp;/g, '&'), pagina.url || base).toString();
    } catch {
      continue;
    }
    if (!/^https?:/i.test(url)) continue;
    // só interessa documento do próprio IFPR
    if (!/ifpr\.edu\.br/i.test(url)) continue;

    const rotulo = limparTexto(m[2]);
    const arquivo = nomeDoArquivo(url);
    const ehDocumento = /\.pdf($|\?)|\/uploads\//i.test(url);
    const textoParaTipo = `${rotulo} ${arquivo} ${url}`;
    const tipo = classificarTipo(textoParaTipo);
    const pareceDocumento = ehDocumento || tipo !== 'OUTRO';
    if (!pareceDocumento) continue;

    // Título: rótulo descritivo; se não identificar nada, contexto + rótulo (ou o arquivo).
    const posicao = m.index ?? 0;
    const cabecalhoProximo = [...cabecalhos].reverse().find((c) => c.posicao < posicao && posicao - c.posicao < 6000);
    const contexto = cabecalhoProximo?.texto && !/^(20\d{2}|edital)$/i.test(cabecalhoProximo.texto)
      ? cabecalhoProximo.texto
      : pagina.titulo;

    let titulo: string;
    if (!precisaDeContexto(rotulo)) {
      titulo = rotulo;
    } else {
      // Rótulo que não diz nada ("📄 Acessar Edital"): o nome do arquivo costuma
      // dizer mais (ex.: "SEI 4349102 Edital interno").
      const base = ROTULOS_GENERICOS.test(rotulo) ? (arquivo || pagina.titulo) : (rotulo || arquivo || pagina.titulo);
      const jaTemContexto = contexto && !base.toLowerCase().includes(contexto.toLowerCase().slice(0, 24));
      titulo = jaTemContexto ? `${contexto} — ${base}` : base;
    }

    const chave = `${tipo}:${url}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const ano = extrairAno(`${titulo} ${arquivo}`, url) ?? cabecalhoProximo?.ano ?? extrairAno(pagina.titulo, pagina.url);

    itens.push({
      titulo: titulo.slice(0, 200),
      url,
      arquivo,
      tipo,
      area: classificarArea(pagina.url),
      ano,
      pagina: { titulo: pagina.titulo, url: pagina.url },
    });
  }

  // Títulos repetidos na MESMA página (três botões "Acessar Edital" do mesmo
  // programa) ficam indistinguíveis: acrescenta o arquivo para dar como escolher.
  const porTitulo = new Map<string, number>();
  for (const item of itens) porTitulo.set(item.titulo, (porTitulo.get(item.titulo) ?? 0) + 1);
  for (const item of itens) {
    if ((porTitulo.get(item.titulo) ?? 0) > 1 && item.arquivo && !item.titulo.includes(item.arquivo)) {
      item.titulo = `${item.titulo} — ${item.arquivo}`.slice(0, 200);
    }
  }

  return itens;
}

// ─── Varredura do site ────────────────────────────────────────────────────────

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(nome: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface OpcoesVarredura {
  fetchImpl: FetchLike;
  api?: string;
  base?: string;
  /** Quantas páginas buscar por requisição (a API aceita até 100). */
  porPagina?: number;
  /** Trava de segurança de requisições. */
  maxPaginas?: number;
  /** Termos buscados na API (cada um é uma varredura). */
  termos?: string[];
}

/**
 * Varre o site do campus e devolve os documentos de edital encontrados.
 *
 * A busca é feita pela API com `search=edital`: o WordPress procura no título e no
 * conteúdo, então as páginas "hub" (por curso, por bolsa, por ano) entram sozinhas.
 */
export async function extrairEditaisIfprIvaipora(opcoes: OpcoesVarredura): Promise<ResultadoExtracao> {
  const {
    fetchImpl,
    api = API_PADRAO,
    base = BASE_PADRAO,
    porPagina = 100,
    maxPaginas = 12,
    termos = ['edital'],
  } = opcoes;

  const avisos: string[] = [];
  const itens: EditalExtraido[] = [];
  const vistos = new Set<string>();
  let paginasVarridas = 0;
  let paginasComItens = 0;
  const urlsProcessadas = new Set<string>();

  for (const termo of termos) {
    let pagina = 1;
    let totalPaginas = 1;

    while (pagina <= totalPaginas && pagina <= maxPaginas) {
      const url = `${api}/pages?search=${encodeURIComponent(termo)}&per_page=${porPagina}&page=${pagina}&_fields=id,link,title,content`;
      const resposta = await fetchImpl(url, { headers: { Accept: 'application/json' } });

      const tipoConteudo = resposta.headers.get('content-type') ?? '';
      if (!resposta.ok || !tipoConteudo.includes('json')) {
        const corpo = await resposta.text();
        const desafio = /awswaf|challenge|captcha|Human Verification/i.test(corpo) || resposta.status === 202;
        avisos.push(
          desafio
            ? 'O site do IFPR pediu verificação (WAF da AWS) para esta origem. Solução: abra ifpr.edu.br numa aba do navegador, resolva a verificação e tente de novo.'
            : `A API do site do IFPR respondeu ${resposta.status} para "${termo}" (página ${pagina}).`,
        );
        break;
      }

      const corpo = (await resposta.json()) as Array<{ link: string; title?: { rendered?: string }; content?: { rendered?: string } }>;
      if (!Array.isArray(corpo)) {
        avisos.push(`Resposta inesperada da API do IFPR em "${termo}" (página ${pagina}).`);
        break;
      }
      if (pagina === 1) {
        totalPaginas = Number(resposta.headers.get('x-wp-totalpages') ?? '1') || 1;
      }

      for (const post of corpo) {
        if (!post?.link || urlsProcessadas.has(post.link)) continue;
        urlsProcessadas.add(post.link);
        paginasVarridas++;

        const paginaInfo = { titulo: limparTexto(post.title?.rendered ?? '') || post.link, url: post.link };
        const encontrados = extrairEditaisDePagina(post.content?.rendered ?? '', paginaInfo, base);
        if (encontrados.length) paginasComItens++;
        for (const item of encontrados) {
          if (vistos.has(item.url)) continue;
          vistos.add(item.url);
          itens.push(item);
        }
      }

      if (corpo.length < porPagina) break;
      pagina++;
    }
  }

  if (paginasVarridas === 0 && avisos.length === 0) {
    avisos.push('Nenhuma página do site do IFPR foi lida — confira a conexão.');
  }

  itens.sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
  return { itens, paginasVarridas, paginasComItens, avisos };
}

// ─── Saídas ───────────────────────────────────────────────────────────────────

export function resumirEditais(itens: EditalExtraido[]) {
  const porAno: Record<string, number> = {};
  const porTipo: Record<string, number> = {};
  const porArea: Record<string, number> = {};
  for (const item of itens) {
    const ano = item.ano ? String(item.ano) : '(sem ano)';
    porAno[ano] = (porAno[ano] ?? 0) + 1;
    porTipo[item.tipo] = (porTipo[item.tipo] ?? 0) + 1;
    porArea[item.area] = (porArea[item.area] ?? 0) + 1;
  }
  return { porAno, porTipo, porArea };
}

/** CSV com ponto e vírgula (abre direto no Excel em pt-BR). */
export function editaisParaCsv(itens: EditalExtraido[]): string {
  const cabecalho = ['ano', 'tipo', 'area', 'titulo', 'url', 'arquivo', 'pagina_titulo', 'pagina_url'];
  const escapar = (valor: unknown) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
  const linhas = itens.map((i) => [i.ano ?? '', i.tipo, i.area, i.titulo, i.url, i.arquivo, i.pagina.titulo, i.pagina.url].map(escapar).join(';'));
  return [cabecalho.join(';'), ...linhas].join('\n');
}

/** Relatório em markdown, para leitura rápida. */
export function editaisParaMarkdown(itens: EditalExtraido[], resumo = resumirEditais(itens)): string {
  const linhas: string[] = [
    '# Editais do Campus Ivaiporã (extraídos do site do IFPR)',
    '',
    `Total de documentos: **${itens.length}**`,
    '',
    `- Por tipo: ${Object.entries(resumo.porTipo).map(([k, v]) => `${k}: **${v}**`).join(' · ')}`,
    `- Por ano: ${Object.entries(resumo.porAno).sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => `${k}: ${v}`).join(' · ')}`,
    `- Por área: ${Object.entries(resumo.porArea).map(([k, v]) => `${k}: ${v}`).join(' · ')}`,
    '',
    '| Ano | Tipo | Área | Título | Link |',
    '|---:|---|---|---|---|',
  ];
  for (const item of itens) {
    linhas.push(`| ${item.ano ?? '—'} | ${item.tipo} | ${item.area} | ${item.titulo.replace(/\|/g, '/')} | [abrir](${item.url}) |`);
  }
  return linhas.join('\n');
}
