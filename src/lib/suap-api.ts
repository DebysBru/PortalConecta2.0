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

interface JwtCache {
  access: string;
  refresh: string;
  accessExpiresAt: number; // timestamp ms
}

let _jwtCache: JwtCache | null = null;

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
    const res = await fetch(`${SUAP_BASE}/api/oauth2/token/`, {
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
  let res = await fetch(`${SUAP_BASE}/api/token/pair`, {
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
    res = await fetch(`${SUAP_BASE}/api/token/pair`, {
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

/**
 * Obtém access token JWT para a API do SUAP.
 *
 * Ordem de tentativa:
 *  1. .suap-token.json na pasta do projeto (salvo pela UI)
 *  2. SUAP_API_TOKEN no .env (token manual)
 *  3. SUAP_USERNAME + SUAP_PASSWORD via /api/token/pair
 */
async function getSuapToken(): Promise<string> {
  // ── 1. Token manual (funciona fora da rede IFPR) ────────────────────────────
  const manualToken = process.env.SUAP_API_TOKEN;
  if (manualToken && manualToken !== 'cole-seu-token-pessoal-aqui') {
    return manualToken; // Sem cache — token pode ter sido atualizado no .env
  }

  // ── 2. Username + Password (requer rede IFPR ou VPN) ────────────────────────
  const username = process.env.SUAP_USERNAME;
  const password = process.env.SUAP_PASSWORD;

  if (!username || !password || password === 'sua-senha-suap-aqui') {
    throw new Error(
      'SUAP: configure SUAP_API_TOKEN no .env.local com o token copiado do SUAP. ' +
      'Como obter: acesse https://suap.ifpr.edu.br/api/docs/ → clique "Authorize" → ' +
      'use /api/token/pair com seu login → copie o campo "access". ' +
      'Obs: fora da rede IFPR, as credenciais username/password não funcionam (bloqueio de IP).'
    );
  }

  // Usa access token cacheado se ainda válido (5 min de buffer)
  if (_jwtCache && _jwtCache.accessExpiresAt > Date.now() + 5 * 60_000) {
    return _jwtCache.access;
  }

  // Login completo com username + password
  const res = await fetch(`${SUAP_BASE}/api/token/pair`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': BROWSER_UA,
    },
    body: JSON.stringify({ username, password }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    let detail = body;
    try {
      const json = JSON.parse(body) as Record<string, unknown>;
      detail = String(json.detail ?? json.message ?? json.error ?? body);
    } catch { /* mantém texto */ }

    if (res.status === 401) {
      throw new Error(
        `SUAP: usuário ou senha incorretos (401). ` +
        `Verifique SUAP_USERNAME e SUAP_PASSWORD no .env.local. Detalhe: ${detail}`
      );
    }
    throw new Error(`SUAP auth falhou (${res.status}): ${detail}`);
  }

  const data = await res.json() as { access: string; refresh: string };
  _jwtCache = {
    access: data.access,
    refresh: data.refresh,
    accessExpiresAt: Date.now() + 23 * 60 * 60_000,
  };

  return _jwtCache.access;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

export async function suapGet<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${SUAP_BASE}${path}`;

  // 1. Tentar token salvo via UI
  const savedToken = await getSavedToken();
  if (savedToken) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${savedToken}`,
          Accept: 'application/json',
          'User-Agent': BROWSER_UA,
        },
        cache: 'no-store',
      });

      if (res.ok) {
        return res.json() as T;
      }

      // Se 401, token expirado
      if (res.status === 401) {
        console.log('[SUAP] Token salvo expirado, tentando login automático...');
      }
    } catch {
      // Erro de rede — tenta próximo método
    }
  }

  // 2. Tentar OAuth2 client_credentials (SUAP_CLIENT_ID + SUAP_CLIENT_SECRET)
  const clientCredentialsToken = await getClientCredentialsToken();
  if (clientCredentialsToken) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${clientCredentialsToken}`,
          Accept: 'application/json',
          'User-Agent': BROWSER_UA,
        },
        cache: 'no-store',
      });

      if (res.ok) {
        return res.json() as T;
      }

      if (res.status === 401) {
        // Token pode ter sido revogado no SUAP antes de expirar — descarta o
        // cache para forçar uma nova troca na próxima chamada.
        _clientCredentialsCache = null;
        console.log('[SUAP] Token OAuth2 client_credentials inválido/expirado, tentando próximo método...');
      }
    } catch {
      // Erro de rede — tenta próximo método
    }
  }

  // 3. Tentar token manual do .env
  const manualToken = process.env.SUAP_API_TOKEN;
  if (manualToken && manualToken !== 'cole-seu-token-pessoal-aqui') {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${manualToken}`,
          Accept: 'application/json',
          'User-Agent': BROWSER_UA,
        },
        cache: 'no-store',
      });

      if (res.ok) {
        return res.json() as T;
      }

      if (res.status === 401) {
        console.log('[SUAP] Token manual expirado, tentando login automático...');
      }
    } catch {
      // Erro de rede
    }
  }

  // 4. Login automático via username/password
  const token = await getSuapTokenFresh();

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': BROWSER_UA,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SUAP API (${res.status}): ${url}${body ? ` — ${body.slice(0, 300)}` : ''}`);
  }

  return res.json() as T;
}

/** Busca todas as páginas de um endpoint paginado — paralelo após descobrir o total */
export async function suapGetAll<T>(path: string, pageSize = 100): Promise<T[]> {
  // Separa path de querystring existente
  const [basePath, qs] = path.split('?');
  const params = new URLSearchParams(qs ?? '');
  params.set('page_size', String(pageSize));
  params.set('page', '1');

  // Primeira página — descobre o total
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const first = await suapGet<any>(`${basePath}?${params}`);

  if (Array.isArray(first)) return first as T[];

  const firstPage = first as SuapPaginatedResponse<T>;
  const results: T[] = [...(firstPage.results ?? [])];

  if (!firstPage.count || results.length >= firstPage.count) return results;

  // Calcula páginas restantes e busca todas em paralelo
  const totalPages = Math.ceil(firstPage.count / pageSize);
  const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  const remaining = await Promise.all(
    pageNums.map(async (page) => {
      const p = new URLSearchParams(qs ?? '');
      p.set('page_size', String(pageSize));
      p.set('page', String(page));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await suapGet<any>(`${basePath}?${p}`);
      return Array.isArray(r) ? (r as T[]) : ((r as SuapPaginatedResponse<T>).results ?? []);
    })
  );

  for (const page of remaining) results.push(...page);
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
