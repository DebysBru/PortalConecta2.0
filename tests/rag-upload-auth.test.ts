import { beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ exigirAdmin: vi.fn() }));
vi.mock('@/lib/admin-auth', () => auth);
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
import { POST } from '@/app/api/admin/rag/upload/route';
describe('autorização do upload RAG antes do multipart', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([401, 403])('recusa %s antes de ler ou processar o arquivo', async (status) => {
    auth.exigirAdmin.mockResolvedValue({ ok: false, status, error: 'Sem acesso' });
    const formData = vi.fn(() => { throw new Error('não deveria ler o corpo'); });
    const response = await POST({ formData } as never);
    expect(response.status).toBe(status);
    expect(formData).not.toHaveBeenCalled();
  });
  it('admin verificado avança para validar campos', async () => {
    auth.exigirAdmin.mockResolvedValue({ ok: true, email: 'admin@example.org' });
    const response = await POST({ formData: async () => new FormData() } as never);
    expect(response.status).toBe(400);
  });
});
