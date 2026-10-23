import { expect, it, vi } from 'vitest';
vi.mock('@/lib/auth-helpers', () => ({ verifySessionToken: vi.fn(async () => ({ ok: true, uid: 'aluno', email: 'aluno@example.org' })) }));
vi.mock('@/lib/ai-guard', () => {
  class AiLimitError extends Error { retryAfterSeconds = 5; }
  return { AiLimitError, reservarAtendimento: vi.fn(async () => { throw new AiLimitError('Aguarde 5 segundos'); }) };
});
vi.mock('@/lib/chat-context', () => ({ buscarContextoChat: vi.fn() }));
vi.mock('@/lib/llm', () => ({ generateCompletion: vi.fn() }));
import { POST } from '@/app/api/chat/route';
import { buscarContextoChat } from '@/lib/chat-context';
import { generateCompletion } from '@/lib/llm';
it('retorna 429 e tempo de espera sem recuperar contexto nem chamar o modelo', async () => {
  const response = await POST(new Request('http://localhost/api/chat', { method: 'POST', headers: { authorization: 'Bearer token' }, body: JSON.stringify({ message: 'Quais cursos existem?' }) }));
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('5');
  expect(await response.json()).toEqual({ error: 'Aguarde 5 segundos', retryAfterSeconds: 5 });
  expect(buscarContextoChat).not.toHaveBeenCalled();
  expect(generateCompletion).not.toHaveBeenCalled();
});
it('recusa visitante antes da busca e do modelo', async () => {
  const response = await POST(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ message: 'E o prazo?' }) }));
  expect(response.status).toBe(401);
  expect(buscarContextoChat).not.toHaveBeenCalled(); expect(generateCompletion).not.toHaveBeenCalled();
});
