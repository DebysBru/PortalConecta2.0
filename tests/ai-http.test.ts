import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAiJson } from '@/lib/ai-http';
afterEach(() => vi.unstubAllGlobals());
describe('chamadas externas de IA', () => {
  it('não repete erro de autenticação', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 401 })); vi.stubGlobal('fetch', fetch);
    await expect(fetchAiJson('https://exemplo.test', {})).rejects.toThrow('401');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('o prazo também limita a leitura do JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => ({ ok: true, json: () => new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })) })));
    await expect(fetchAiJson('https://exemplo.test', {}, { timeoutMs: 30, attempts: 1 })).rejects.toThrow();
  });
  it('não espera Retry-After além do prazo total', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 429, headers: { 'Retry-After': '90' } })); vi.stubGlobal('fetch', fetch);
    await expect(fetchAiJson('https://exemplo.test', {}, { timeoutMs: 30 })).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
