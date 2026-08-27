/**
 * SUAP API Client — IFPR
 * Autenticação: JWT via POST /api/token/pair (username + password)
 * Documentação: https://suap.ifpr.edu.br/api/docs/
 */

const SUAP_BASE = process.env.SUAP_BASE_URL ?? 'https://suap.ifpr.edu.br';

// ─── Tipos da API SUAP (campos reais confirmados na documentação) ──────────────

export interface SuapPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Projeto retornado por GET /api/pesquisa/projetos/ ou /api/extensao/projetos/ */
export interface SuapProjeto {
  id: number;
  content_type: string;
  titulo: string;
  resumo?: string;
  dt_inicio?: string;          // "YYYY-MM-DD"
  dt_final?: string;           // "YYYY-MM-DD"
  situacao?: string;           // "Em Execução", "Concluído", etc.
  edital?: number;             // ID do edital vinculado
  campus_sigla?: string;
  campus_nome?: string;
  campus_nome_formatado?: string;
  nome_coordenador?: string;
  email_coordenador?: string;
  // Campo interno — não vem da API, adicionado pelo portal
  _fonte?: 'pesquisa' | 'extensao';
  [key: string]: unknown;
}

/** Edital retornado pela API SUAP */
export interface SuapEdital {
  id: number;
  titulo?: string;
  descricao?: string;
  numero?: string;
  tipo?: string;
  campus?: string | { id: number; nome: string };
  status?: string;
  data_inicio_inscricao?: string;
  data_fim_inscricao?: string;
  data_divulgacao_resultado?: string;
  arquivo?: string;
  link?: string;
  [key: string]: unknown;
}

// ─── Cache de tokens JWT ──────────────────────────────────────────────────────

// O SUAP bloqueia User-Agents que não são de browser — usamos um realista
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Nenhuma chamada de rede deste arquivo deve poder travar indefinidamente —
// era exatamente isso que deixava uma sincronização "pendurada" por minutos:
// sem timeout, uma resposta lenta/pendurada do SUAP (ou de rede) prendia a
// requisição até o limite da função serverless, sem erro nenhum pro usuário.
const REQUEST_TIMEOUT_MS = 15_000;

async function fetchComTimeout(url: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── OAuth2 client_credentials (Aplicação OAUTH2 cadastrada no SUAP) ──────────

interface ClientCredentialsCache {
  access: string;
  expiresAt: number; // timestamp ms
}

let _clientCredentialsCache: ClientCredentialsCache | null = null;

/**
 * Troca SUAP_CLIENT_ID/SUAP_CLIENT_SECRET (Aplicação OAUTH2 cadastrada em
 * suap.ifpr.edu.br/api/oauth2/applications/, grant type "Client credentials")
 * por um access token — sem depender de usuário/senha nem de token manual
 * pastado a cada 24h. Retorna `null` se as credenciais não estiverem
 * configuradas ou se a troca falhar (quem chama cai para o próximo método).
 */
async function getClientCredentialsToken(): Promise<string | null> {
  const clientId = process.env.SUAP_CLIENT_ID;
  const clientSecret = process.env.SUAP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (_clientCredentialsCache && _clientCredentialsCache.expiresAt > Date.now() + 60_000) {
    return _clientCredentialsCache.access;
  }

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetchComTimeout(`${SUAP_BASE}/api/oauth2/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
        'User-Agent': BROWSER_UA,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[SUAP] OAuth2 client_credentials falhou (${res.status}): ${body.slice(0, 300)}`);
      return null;
    }

    const data = await res.json() as { access_token: string; expires_in?: number };
    _clientCredentialsCache = {
      access: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    console.log('[SUAP] Token via OAuth2 client_credentials obtido com sucesso');
    return _clientCredentialsCache.access;
  } catch (err) {
    console.warn('[SUAP] Erro de rede ao trocar client_credentials por token:', err);
    return null;
  }
}

/**
 * Obtém token via username/password (força login fresco, sem cache)
 */
async function getSuapTokenFresh(): Promise<string> {
  const username = process.env.SUAP_USERNAME;
  const password = process.env.SUAP_PASSWORD;

  if (!username || !password || password === 'sua-senha-suap-aqui') {
    throw new Error(
      'SUAP: configure um token na página de sincronização ou defina SUAP_USERNAME e SUAP_PASSWORD no .env'
    );
  }

  console.log(`[SUAP] Tentando login com username: ${username}`);

  // Tentar com campo "username"
  let res = await fetchComTimeout(`${SUAP_BASE}/api/token/pair`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': BROWSER_UA,
    },
    body: JSON.stringify({ username, password }),
    cache: 'no-store',
  });

  let bodyText = await res.text();
  console.log(`[SUAP] Tentativa 1 (username) - Status: ${res.status}`);

  // Se 401, tentar com campo "login"
  if (!res.ok && res.status === 401) {
    console.log(`[SUAP] Tentando com campo "login"...`);
    res = await fetchComTimeout(`${SUAP_BASE}/api/token/pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': BROWSER_UA,
      },
      body: JSON.stringify({ login: username, password }),
      cache: 'no-store',
    });
    bodyText = await res.text();
    console.log(`[SUAP] Tentativa 2 (login) - Status: ${res.status}`);
  }

  if (!res.ok) {
    let detail = bodyText;
    try {
      const json = JSON.parse(bodyText) as Record<string, unknown>;
      detail = String(json.detail ?? json.message ?? json.error ?? bodyText);
    } catch { /* mantém texto */ }

    throw new Error(
      `SUAP: credenciais inválidas (${res.status}). ` +
      `Username: "${username}". ` +
      `Detalhe: ${detail}\n` +
      `Solução: Acesse a página de sincronização SUAP e cole um token válido.`
    );
  }

  const data = await res.json() as { access: string; refresh: string };
  console.log('[SUAP] Login automático bem-sucedido!');
  return data.access;
}

/**
 * Lê token salvo na pasta do projeto
 */
async function getSavedToken(): Promise<string | null> {
  try {
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');
    const tokenFile = join(process.cwd(), '.suap-token.json');
    const data = await readFile(tokenFile, 'utf-8');
    const { token } = JSON.parse(data);
    return token;
  } catch {
    return null;
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

/**
 * Token que já funcionou de verdade (uma resposta 2xx real) nesta execução —
 * reaproveitado por todas as chamadas seguintes de `suapGet`/`suapGetAll`
 * até expirar ou levar um 401.
 *
 * Antes, CADA chamada a `suapGet` (ou seja, cada página de uma sincronização
 * paginada) refazia a cascata inteira de autenticação do zero — incluindo,
 * no pior caso, um login completo por usuário/senha (2 requisições
 * sequenciais). Com `suapGetAll` disparando várias páginas em paralelo, uma
 * sincronização de projetos podia multiplicar isso em dezenas de logins
 * simultâneos contra o SUAP — exatamente o que deixava o sync "pendurado"
 * por minutos sem terminar nem dar erro.
 */
interface WorkingTokenCache { value: string; source: string; expiresAt: number; }
let _workingToken: WorkingTokenCache | null = null;

async function fetchComToken(url: string, token: string): Promise<Response | null> {
  try {
    return await fetchComTimeout(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': BROWSER_UA },
      cache: 'no-store',
    });
  } catch {
    return null; // timeout ou erro de rede
  }
}

async function getManualTokenValue(): Promise<string | null> {
  const manualToken = process.env.SUAP_API_TOKEN;
  return manualToken && manualToken !== 'cole-seu-token-pessoal-aqui' ? manualToken : null;
}

async function getUsernamePasswordToken(): Promise<string | null> {
  const username = process.env.SUAP_USERNAME;
  const password = process.env.SUAP_PASSWORD;
  if (!username || !password || password === 'sua-senha-suap-aqui') return null;
  return getSuapTokenFresh();
}

const TOKEN_PROVIDERS: Array<{ name: string; getToken: () => Promise<string | null> }> = [
  { name: 'token-salvo', getToken: getSavedToken },
  { name: 'oauth2-client-credentials', getToken: getClientCredentialsToken },
  { name: 'token-manual', getToken: getManualTokenValue },
  { name: 'username-senha', getToken: getUsernamePasswordToken },
];

export async function suapGet<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${SUAP_BASE}${path}`;

  // Reaproveita o token que já funcionou nesta execução, se ainda válido.
  if (_workingToken && _workingToken.expiresAt > Date.now()) {
    const res = await fetchComToken(url, _workingToken.value);
    if (res?.ok) return res.json() as T;
    // 401 (expirou/revogado) ou timeout/erro de rede — invalida e re-resolve abaixo.
    _workingToken = null;
  }

  const erros: string[] = [];
  for (const provider of TOKEN_PROVIDERS) {
    let token: string | null;
    try {
      token = await provider.getToken();
    } catch (err) {
      erros.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (!token) continue;

    const res = await fetchComToken(url, token);
    if (!res) { erros.push(`${provider.name}: timeout/erro de rede`); continue; }

    if (res.ok) {
      // 20 min é conservador o bastante pra cobrir uma sincronização inteira
      // sem re-resolver a cada chamada, mas curto o bastante pra não
      // carregar um token revogado por muito tempo entre execuções.
      _workingToken = { value: token, source: provider.name, expiresAt: Date.now() + 20 * 60_000 };
      return res.json() as T;
    }

    if (provider.name === 'oauth2-client-credentials' && res.status === 401) {
      _clientCredentialsCache = null; // token pode ter sido revogado antes de expirar
    }
    erros.push(`${provider.name}: HTTP ${res.status}`);
  }

  throw new Error(`SUAP: nenhum método de autenticação funcionou para ${url}. ${erros.join(' | ') || 'nenhum método configurado'}`);
}

/** Quantas páginas buscar ao mesmo tempo — SUAP não costuma lidar bem com rajadas grandes. */
const SUAP_PAGE_CONCURRENCY = 5;

/** Busca todas as páginas de um endpoint paginado — em lotes, após descobrir o total */
export async function suapGetAll<T>(path: string, pageSize = 100): Promise<T[]> {
  // Separa path de querystring existente
  const [basePath, qs] = path.split('?');
  const params = new URLSearchParams(qs ?? '');
  params.set('page_size', String(pageSize));
  params.set('page', '1');

  // Primeira página — descobre o total. Também é o que resolve e cacheia o
  // token de autenticação (ver `_workingToken` em suapGet) antes de qualquer
  // página seguinte ser disparada.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const first = await suapGet<any>(`${basePath}?${params}`);

  if (Array.isArray(first)) return first as T[];

  const firstPage = first as SuapPaginatedResponse<T>;
  const results: T[] = [...(firstPage.results ?? [])];

  if (!firstPage.count || results.length >= firstPage.count) return results;

  const totalPages = Math.ceil(firstPage.count / pageSize);
  const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  const buscarPagina = async (page: number): Promise<T[]> => {
    const p = new URLSearchParams(qs ?? '');
    p.set('page_size', String(pageSize));
    p.set('page', String(page));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await suapGet<any>(`${basePath}?${p}`);
    return Array.isArray(r) ? (r as T[]) : ((r as SuapPaginatedResponse<T>).results ?? []);
  };

  // Busca em lotes de SUAP_PAGE_CONCURRENCY em vez de disparar todas as
  // páginas de uma vez — com o token já cacheado isso não é mais sobre
  // autenticação repetida, é só para não sobrecarregar o SUAP com uma
  // rajada de dezenas de requisições simultâneas.
  for (let i = 0; i < pageNums.length; i += SUAP_PAGE_CONCURRENCY) {
    const lote = pageNums.slice(i, i + SUAP_PAGE_CONCURRENCY);
    const paginas = await Promise.all(lote.map(buscarPagina));
    for (const pagina of paginas) results.push(...pagina);
  }

  return results;
}

// ─── Funções específicas ───────────────────────────────────────────────────────

/** Normaliza sigla de campus para comparação — evita perder o filtro por caixa/espaços diferentes. */
function normalizaSigla(s?: string | null): string {
  return (s ?? '').trim().toUpperCase();
}

/**
 * Busca projetos de PESQUISA e EXTENSÃO só do campus configurado em
 * SUAP_CAMPUS_SIGLA (Ivaiporã por padrão). A API do SUAP não filtra por
 * campus — buscamos todas as páginas em paralelo e filtramos pelo campo
 * `campus_sigla` no retorno.
 */
export async function fetchProjetosFromSuap(): Promise<{ projetos: SuapProjeto[]; avisos: string[] }> {
  const campusSigla = normalizaSigla(process.env.SUAP_CAMPUS_SIGLA ?? 'IVAIPODG');
  const avisos: string[] = [];

  console.log(`[SUAP] Buscando projetos de pesquisa e extensão para campus ${campusSigla}...`);

  // Busca os dois endpoints em paralelo
  const [pesquisa, extensao] = await Promise.allSettled([
    suapGetAll<SuapProjeto>('/api/pesquisa/projetos/'),
    suapGetAll<SuapProjeto>('/api/extensao/projetos/'),
  ]);

  const todosPesquisa: SuapProjeto[] =
    pesquisa.status === 'fulfilled' ? pesquisa.value : [];
  const todosExtensao: SuapProjeto[] =
    extensao.status === 'fulfilled' ? extensao.value : [];

  if (pesquisa.status === 'rejected') {
    console.warn('[SUAP] Pesquisa falhou:', pesquisa.reason);
    avisos.push(`⚠️ Falha ao buscar projetos de pesquisa: ${pesquisa.reason instanceof Error ? pesquisa.reason.message : String(pesquisa.reason)}`);
  }
  if (extensao.status === 'rejected') {
    console.warn('[SUAP] Extensão falhou:', extensao.reason);
    avisos.push(`⚠️ Falha ao buscar projetos de extensão: ${extensao.reason instanceof Error ? extensao.reason.message : String(extensao.reason)}`);
  }

  console.log(`[SUAP] Pesquisa: ${todosPesquisa.length} total | Extensão: ${todosExtensao.length} total`);

  // Filtra por campus (comparação normalizada) e taga a fonte
  const dosCampusPesquisa = todosPesquisa
    .filter((p) => normalizaSigla(p.campus_sigla) === campusSigla)
    .map((p) => ({ ...p, _fonte: 'pesquisa' as const }));

  const dosCampusExtensao = todosExtensao
    .filter((p) => normalizaSigla(p.campus_sigla) === campusSigla)
    .map((p) => ({ ...p, _fonte: 'extensao' as const }));

  console.log(`[SUAP] ${campusSigla} → Pesquisa: ${dosCampusPesquisa.length} | Extensão: ${dosCampusExtensao.length}`);

  // Diagnóstico: se o total bruto não é zero mas o filtro zerou tudo, a
  // sigla configurada em SUAP_CAMPUS_SIGLA provavelmente está errada —
  // lista as siglas reais encontradas para o admin corrigir sem precisar
  // adivinhar (em vez de só reportar silenciosamente "0 projetos").
  const totalBruto = todosPesquisa.length + todosExtensao.length;
  const totalFiltrado = dosCampusPesquisa.length + dosCampusExtensao.length;
  if (totalBruto > 0 && totalFiltrado === 0) {
    const siglasEncontradas = Array.from(
      new Set([...todosPesquisa, ...todosExtensao].map((p) => normalizaSigla(p.campus_sigla)).filter(Boolean))
    ).sort();
    avisos.push(
      `⚠️ Nenhum projeto encontrado para campus "${campusSigla}" (${totalBruto} projetos no total, de outros campi). ` +
      `Siglas encontradas na API: ${siglasEncontradas.join(', ') || '(nenhuma)'}. ` +
      `Se a sigla certa for diferente, ajuste SUAP_CAMPUS_SIGLA.`
    );
  }

  return { projetos: [...dosCampusPesquisa, ...dosCampusExtensao], avisos };
}

/** Lista editais — tenta vários endpoints pois a doc não lista explicitamente */
export async function fetchEditaisFromSuap(): Promise<SuapEdital[]> {
  const endpoints = [
    `/api/pesquisa/editais/?page_size=100`,
    `/api/extensao/editais/?page_size=100`,
    `/api/v2/pesquisa/editais/?page_size=100`,
  ];

  for (const endpoint of endpoints) {
    try {
      const editais = await suapGetAll<SuapEdital>(endpoint);
      console.log(`[SUAP] editais via ${endpoint}: ${editais.length}`);
      return editais;
    } catch {
      continue;
    }
  }

  return []; // Editais são opcionais — não quebra o sync se não encontrar
}

/** Descobre endpoints disponíveis */
export async function fetchSuapEndpoints(): Promise<Record<string, string>> {
  try {
    return await suapGet<Record<string, string>>('/api/');
  } catch {
    return {};
  }
}

/** Testa a conexão buscando 1 projeto real */
export async function testSuapConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await suapGet<SuapPaginatedResponse<SuapProjeto>>(
      '/api/pesquisa/projetos/?page_size=1'
    );
    const total = res.count ?? 0;
    const campus = res.results?.[0]?.campus_nome ?? '';
    return {
      ok: true,
      message: `Conectado! ${total} projeto(s) encontrado(s)${campus ? ` — ex: ${campus}` : ''}.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    // Melhorar mensagem para 403/401
    if (msg.includes('403') || msg.includes('bloqueado')) {
      return {
        ok: false,
        message: 'IP bloqueado pelo SUAP. Use um token manual: acesse suap.ifpr.edu.br/api/docs/ → Authorize → POST /api/token/pair → copie "access" → cole no .env como SUAP_API_TOKEN',
      };
    }
    return { ok: false, message: msg };
  }
}

// ─── Helpers de normalização ──────────────────────────────────────────────────

export function extractNome(value: unknown): string {
  if (!value) return 'Não informado';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    return String(obj.nome ?? obj.name ?? obj.label ?? '');
  }
  return String(value);
}

export function extractEmail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string' && value.includes('@')) return value;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    return (obj.email ?? obj.email_suap ?? null) as string | null;
  }
  return null;
}

/** Mapeia situacao do SUAP → enum StatusProjeto do portal */
export function mapStatusProjeto(situacao?: string): string {
  if (!situacao) return 'EM_EXECUCAO';
  const s = situacao.toLowerCase();
  if (s.includes('execu')) return 'EM_EXECUCAO';
  if (s.includes('conclu') || s.includes('finaliz')) return 'ENCERRADO';
  if (s.includes('inativ') || s.includes('cancel')) return 'ENCERRADO';
  if (s.includes('submeti') || s.includes('enviado')) return 'ATIVO';
  return 'EM_EXECUCAO';
}

/** Mapeia tipo de edital → categoria do portal */
export function mapCategoriaEdital(tipo?: string): string {
  if (!tipo) return 'EXTENSAO';
  const t = tipo.toLowerCase();
  if (t.includes('bolsa')) return 'BOLSAS';
  if (t.includes('aux') || t.includes('assist') || t.includes('perman')) return 'AUXILIOS';
  if (t.includes('pesquisa') || t.includes('inicia') || t.includes('pibic')) return 'PESQUISA';
  if (t.includes('estag')) return 'ESTAGIOS';
  if (t.includes('ensino') || t.includes('pib')) return 'ENSINO';
  if (t.includes('evento')) return 'EVENTOS';
  if (t.includes('result')) return 'RESULTADOS';
  return 'EXTENSAO';
}
