import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const tx = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  rateLimitHit: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  job: { count: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx), job: { deleteMany: vi.fn(async () => ({})) } } }));
import { reservarAtendimento } from '@/lib/ai-guard';
const now = new Date('2026-10-23T12:00:00Z');
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  tx.rateLimitHit.findMany.mockResolvedValue([]); tx.rateLimitHit.count.mockResolvedValue(0);
  tx.job.count.mockResolvedValue(0); tx.job.create.mockResolvedValue({ id: 'lease' });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
describe('cota pública da IFizinha', () => {
  it('permite a 20ª pergunta e preserva a janela móvel no banco', async () => {
    tx.rateLimitHit.findMany.mockResolvedValue(Array.from({ length: 19 }, (_, i) => ({ criadoEm: new Date(+now - 5000 - i * 6000) })));
    await reservarAtendimento(new Request('http://localhost'));
    expect(tx.rateLimitHit.create).toHaveBeenCalledOnce();
    expect(tx.rateLimitHit.findMany.mock.calls[0][0].where.criadoEm.gt).toEqual(new Date(+now - 3600_000));
  });
  it('recusa a 21ª e calcula quando a mais antiga sai da janela', async () => {
    tx.rateLimitHit.findMany.mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ criadoEm: new Date(+now - 6000 - i * 60_000) })));
    await expect(reservarAtendimento(new Request('http://localhost'))).rejects.toMatchObject({ status: 429, retryAfterSeconds: 2454, message: expect.stringContaining('20 perguntas por hora') });
    expect(tx.rateLimitHit.create).not.toHaveBeenCalled(); expect(tx.job.create).not.toHaveBeenCalled();
  });
  it('bloqueia aos 4.999 ms e libera aos 5.000 ms', async () => {
    tx.rateLimitHit.findMany.mockResolvedValue([{ criadoEm: new Date(+now - 4999) }]);
    await expect(reservarAtendimento(new Request('http://localhost'))).rejects.toMatchObject({ retryAfterSeconds: 1 });
    expect(tx.rateLimitHit.create).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await reservarAtendimento(new Request('http://localhost'));
    expect(tx.rateLimitHit.create).toHaveBeenCalledOnce();
  });
  it('não aplica a cota pública aos fluxos administrativos', async () => {
    await reservarAtendimento(new Request('http://localhost'), 'traducao', 'admin@example.org');
    expect(tx.rateLimitHit.findMany).not.toHaveBeenCalled();
  });
  it('não confia em IP fornecido pelo cliente sem proxy configurado', async () => {
    vi.stubEnv('AI_TRUST_PROXY', '');
    await reservarAtendimento(new Request('http://localhost', { headers: { 'x-real-ip': 'forjado' } }));
    const first = tx.rateLimitHit.findMany.mock.calls[0][0].where.chave;
    await reservarAtendimento(new Request('http://localhost'));
    expect(tx.rateLimitHit.findMany.mock.calls[1][0].where.chave).toBe(first);
  });
  it('contas diferentes no mesmo IP têm cotas diferentes; a mesma conta mantém sua cota em outra rede', async () => {
    vi.stubEnv('AI_TRUST_PROXY', '1');
    const request = new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.1' } });
    await reservarAtendimento(request, 'chat', 'conta:aluno-1');
    await reservarAtendimento(request, 'chat', 'conta:aluno-2');
    await reservarAtendimento(new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.2' } }), 'chat', 'conta:aluno-1');
    const keys = tx.rateLimitHit.findMany.mock.calls.map(call => call[0].where.chave);
    expect(keys[0]).not.toBe(keys[1]); expect(keys[0]).toBe(keys[2]);
  });
});
