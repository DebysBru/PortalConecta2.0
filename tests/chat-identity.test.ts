import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/auth-helpers', () => ({ verifySessionToken: vi.fn() }));
import { verifySessionToken } from '@/lib/auth-helpers';
import { identidadeAutenticadaChat } from '@/lib/chat-identity';
beforeEach(() => vi.clearAllMocks());
it('usa somente UID verificado, ignorando identidade enviada no corpo', async () => {
  vi.mocked(verifySessionToken).mockResolvedValue({ ok: true, uid: 'aluno-1', email: 'aluno@example.org' });
  const req = new Request('http://localhost', { method: 'POST', headers: { authorization: 'Bearer token-real' }, body: JSON.stringify({ userId: 'outra-conta' }) });
  expect(await identidadeAutenticadaChat(req)).toBe('conta:aluno-1');
  expect(verifySessionToken).toHaveBeenCalledWith('token-real');
});
it('token inválido não cai silenciosamente na cota de visitante', async () => {
  vi.mocked(verifySessionToken).mockResolvedValue({ ok: false, error: 'inválido' });
  await expect(identidadeAutenticadaChat(new Request('http://localhost', { headers: { authorization: 'Bearer falso' } }))).rejects.toThrow('sessão expirou');
});
it('ausência de token não afirma identidade de conta', async () => {
  await expect(identidadeAutenticadaChat(new Request('http://localhost'))).rejects.toThrow('Entre na sua conta');
  expect(verifySessionToken).not.toHaveBeenCalled();
});
