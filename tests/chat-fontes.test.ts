import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Contrato de resposta do chat da IFizinha.
 *
 * O que precisa ficar travado (foi o pedido do produto):
 *  - toda resposta com documento institucional volta com `fontes` preenchidas;
 *  - cada fonte tem o LINK da origem (para a pessoa conferir no site oficial);
 *  - a lista sai mesmo quando o modelo "esquece" de citar no texto;
 *  - sem documento relevante, `fontes` vem vazio (nada de link inventado).
 */

const prismaMock = vi.hoisted(() => ({
  documentoKb: { findMany: vi.fn() },
  projeto: { count: vi.fn(), findMany: vi.fn() },
  edital: { count: vi.fn(), findMany: vi.fn() },
}));

const buscaMock = vi.hoisted(() => ({ searchSimilarChunks: vi.fn() }));
vi.mock('@/lib/chat-identity', () => ({ identidadeAutenticadaChat: vi.fn(async () => 'conta:teste'), ChatAuthError: class extends Error {} }));

vi.mock('@/lib/ai-guard', () => ({ reservarAtendimento: vi.fn(async () => vi.fn(async () => undefined)), AiLimitError: class extends Error {} }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, db: prismaMock }));
vi.mock('@/lib/embeddings', () => ({ generateEmbedding: vi.fn(async () => new Array(1536).fill(0.1)) }));
vi.mock('@/lib/busca-vetorial', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/busca-vetorial')>();
  return { ...real, searchSimilarChunks: buscaMock.searchSimilarChunks };
});

const { POST } = await import('@/app/api/chat/route');

const CHUNK = {
  id: 'chunk-1',
  documento_id: 'doc-1',
  chunk_index: 0,
  texto: 'O curso Técnico em Eletrotécnica tem carga horária total de 1.333 horas.',
  secao: 'Carga horária',
  categoria: 'ppc',
  pagina_inicial: null,
  pagina_final: null,
  metadata: { url_fonte: 'https://ifpr.edu.br/ivaipora/ppc-eletrotecnica.pdf' },
  documento_titulo: 'PPC Eletrotécnica',
  documento_tipo: 'site_ifpr',
  similarity: 0.82,
  documento_url: 'https://ifpr.edu.br/ivaipora/ppc-eletrotecnica.pdf',
};

function requisicao(mensagem: string): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: mensagem, history: [] }),
  });
}

function respostaDoLlm(texto: string) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content: texto } }] }),
  } as unknown as Response;
}

describe('POST /api/chat — fontes da resposta', () => {
  beforeEach(() => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'chave-de-teste');
    buscaMock.searchSimilarChunks.mockReset();
    prismaMock.documentoKb.findMany.mockReset();
    prismaMock.projeto.count.mockResolvedValue(0);
    prismaMock.edital.count.mockResolvedValue(0);
    prismaMock.projeto.findMany.mockResolvedValue([]);
    prismaMock.edital.findMany.mockResolvedValue([]);
    vi.unstubAllGlobals();
  });

  it('devolve a fonte com link mesmo quando o modelo não cita no texto', async () => {
    buscaMock.searchSimilarChunks.mockResolvedValue([CHUNK]);
    prismaMock.documentoKb.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        storagePath: null,
        metadata: { categoria: 'ppc', url_fonte: 'https://ifpr.edu.br/ivaipora/ppc-eletrotecnica.pdf' },
      },
    ]);

    const fetchMock = vi.fn(async () => respostaDoLlm('A carga horária é de 1.333 horas.'));
    vi.stubGlobal('fetch', fetchMock);

    const resposta = await POST(requisicao('qual a carga horária de eletrotécnica?'));
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo.reply).toContain('1.333');
    expect(corpo.fontes).toHaveLength(1);
    expect(corpo.fontes[0]).toMatchObject({
      numero: 1,
      titulo: 'PPC Eletrotécnica',
      url: 'https://ifpr.edu.br/ivaipora/ppc-eletrotecnica.pdf',
      categoria: 'Projeto Pedagógico de Curso',
      tipo: 'documento',
    });
    expect(corpo.fontes[0].trecho).toContain('1.333 horas');
  });

  it('numera a fonte no contexto enviado ao modelo', async () => {
    buscaMock.searchSimilarChunks.mockResolvedValue([CHUNK]);
    prismaMock.documentoKb.findMany.mockResolvedValue([
      { id: 'doc-1', storagePath: null, metadata: { url_fonte: 'https://ifpr.edu.br/x.pdf' } },
    ]);

    const fetchMock = vi.fn(async () => respostaDoLlm('Resposta qualquer.'));
    vi.stubGlobal('fetch', fetchMock);

    await POST(requisicao('carga horária de eletrotécnica'));

    const corpoEnviado = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    const prompt = corpoEnviado.messages.map((m: { content: string }) => m.content).join('\n');
    expect(corpoEnviado.messages[0].content).not.toContain('1.333 horas');

    expect(prompt).toContain('[fonte 1] PPC Eletrotécnica');
    expect(prompt).toContain('carga horária');
    expect(prompt).toContain('COMO CITAR AS FONTES');
  });

  it('devolve lista vazia quando não há documento na base', async () => {
    buscaMock.searchSimilarChunks.mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn(async () => respostaDoLlm('Não encontrei essa informação no portal.')));

    const resposta = await POST(requisicao('qual o horário do ônibus?'));
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo.fontes).toEqual([]);
  });

  it('usa o caminho do storage como link quando o documento foi enviado por upload', async () => {
    buscaMock.searchSimilarChunks.mockResolvedValue([
      { ...CHUNK, documento_url: null, metadata: {}, documento_titulo: 'Manual do Aluno' },
    ]);
    prismaMock.documentoKb.findMany.mockResolvedValue([
      { id: 'doc-1', storagePath: 'pdf/manual-do-aluno.pdf', metadata: {} },
    ]);
    vi.stubGlobal('fetch', vi.fn(async () => respostaDoLlm('Conforme o manual.')));

    const corpo = await (await POST(requisicao('o que diz o manual do aluno?'))).json();

    expect(corpo.fontes[0].url).toBe('/files/pdf/manual-do-aluno.pdf');
  });
});
