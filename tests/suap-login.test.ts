import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Autenticação do portal contra a API do SUAP.
 *
 * BUG QUE ESTES TESTES TRAVAM (reproduzido contra o SUAP real em 2026-10-05):
 * `getSuapTokenFresh` lia o corpo da resposta com `res.text()` para poder
 * diagnosticar o erro e, no caminho de SUCESSO, chamava `res.json()` no MESMO
 * corpo já consumido. Toda tentativa de login automático terminava em
 * "Body is unusable: Body has already been read" — ou seja, o portal só
 * conseguia autenticar com o token colado na tela (que expira em 24h) e a
 * mensagem que sobrava para o admin era um "nenhum método de autenticação
 * funcionou" enganoso, apontando para o token salvo.
 *
 * Estes testes usam um `fetch` falso: nenhuma chamada de rede real.
 */

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', () => ({
  // Sem token salvo em disco: força o caminho de login por usuário/senha, que
  // é justamente o que estava quebrado.
  readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));

let api: typeof import('@/lib/suap-api');

function resposta(status: number, corpo: unknown, ok = status >= 200 && status < 300) {
  const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
  return {
    ok,
    status,
    text: async () => texto,
    json: async () => JSON.parse(texto),
  } as unknown as Response;
}

function projetoPage(campus = 'IFPR Campus Ivaiporã') {
  return resposta(200, { count: 1, results: [{ id: 1, titulo: 'Projeto', campus_nome: campus }] });
}

beforeEach(async () => {
  // Módulo novo por teste: `suap-api` guarda em memória o token que já
  // funcionou, e sem isso um teste contaminaria o outro.
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);

  delete process.env.SUAP_CLIENT_ID;
  delete process.env.SUAP_CLIENT_SECRET;
  delete process.env.SUAP_API_TOKEN;
  process.env.SUAP_USERNAME = '1217949';
  process.env.SUAP_PASSWORD = 'senha-de-teste';
  process.env.SUAP_BASE_URL = 'https://suap.ifpr.edu.br';

  api = await import('@/lib/suap-api');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('login automático por usuário e senha', () => {
  it('usa o token do par access/refresh SEM tentar ler o corpo duas vezes', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(200, { username: '1217949', refresh: 'REFRESH', access: 'ACCESS' }))
      .mockResolvedValueOnce(projetoPage());

    const resultado = await api.testSuapConnection();

    expect(resultado.ok).toBe(true);
    expect(resultado.message).toMatch(/Conectado!/);
    // O corpo do /api/token/pair foi lido UMA vez e virou "ACCESS" no header.
    const [, projetosInit] = fetchMock.mock.calls[1];
    expect((projetosInit.headers as Record<string, string>).Authorization).toBe('Bearer ACCESS');
    // Nada de "Body has already been read" no caminho.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('manda o campo "username" primeiro, como a API espera', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(200, { access: 'ACCESS' }))
      .mockResolvedValueOnce(projetoPage());

    await api.testSuapConnection();

    const [pairUrl, pairInit] = fetchMock.mock.calls[0];
    expect(pairUrl).toBe('https://suap.ifpr.edu.br/api/token/pair');
    expect(pairInit.method).toBe('POST');
    expect(JSON.parse(pairInit.body as string)).toEqual({
      username: '1217949',
      password: 'senha-de-teste',
    });
  });

  it('se o SUAP recusar "username" com 401, tenta com "login"', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(401, { detail: 'No active account found' }))
      .mockResolvedValueOnce(resposta(200, { access: 'ACCESS2' }))
      .mockResolvedValueOnce(projetoPage());

    const resultado = await api.testSuapConnection();

    expect(resultado.ok).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      login: '1217949',
      password: 'senha-de-teste',
    });
    expect((fetchMock.mock.calls[2][1].headers as Record<string, string>).Authorization).toBe('Bearer ACCESS2');
  });

  it('credencial recusada nas duas tentativas: erro claro, sem estourar exceção técnica', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(401, { detail: 'No active account found' }))
      .mockResolvedValueOnce(resposta(401, { detail: 'No active account found' }));

    const resultado = await api.testSuapConnection();

    expect(resultado.ok).toBe(false);
    expect(resultado.message).toMatch(/token cadastrado expirou/i);
    // O detalhe técnico NÃO vai para a tela (regra da Decisão 15)...
    expect(resultado.message).not.toContain('No active account');
  });

  it('resposta 200 sem o campo "access" é tratada como falha, não como sucesso', async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { username: '1217949', refresh: 'REFRESH' }));

    const resultado = await api.testSuapConnection();

    expect(resultado.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // não segue para a consulta
  });

  it('resposta 200 que não é JSON não derruba o portal', async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, '<html>portal do suap</html>'));

    const resultado = await api.testSuapConnection();

    expect(resultado.ok).toBe(false);
  });
});

describe('mensagens de diagnóstico da conexão', () => {
  it('405 (recusa da requisição) é reportado como bloqueio, não como endpoint errado', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(200, { access: 'ACCESS' }))
      .mockResolvedValueOnce(resposta(405, 'Method not allowed'));

    const resultado = await api.testSuapConnection();

    expect(resultado.ok).toBe(false);
    // GET nesse mesmo endereço responde 200 no SUAP real: 405 aqui é recusa.
    expect(resultado.message).toMatch(/recusou a conexão deste servidor/i);
  });

  it('404 é reportado como endereço de API inexistente', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(200, { access: 'ACCESS' }))
      .mockResolvedValueOnce(resposta(404, 'not found'));

    const resultado = await api.testSuapConnection();

    expect(resultado.ok).toBe(false);
    expect(resultado.message).toMatch(/endereço de consulta não existe/i);
  });

  it('erro de rede continua caindo na orientação genérica', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(200, { access: 'ACCESS' }))
      .mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'));

    const resultado = await api.testSuapConnection();

    expect(resultado.ok).toBe(false);
    expect(resultado.message).toMatch(/Confira se as credenciais/i);
  });
});

describe('editais: a API do SUAP não expõe esse endpoint', () => {
  it('devolve lista vazia COM aviso, em vez de fingir que consultou', async () => {
    // O login sucede; os três caminhos de editais respondem 404.
    fetchMock
      .mockResolvedValueOnce(resposta(200, { access: 'ACCESS' }))
      .mockResolvedValue(resposta(404, 'not found'));

    const { editais, avisos } = await api.fetchEditaisFromSuap();

    expect(editais).toEqual([]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/não expõe uma API de editais/i);
  });
});
