import { describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ exigirAdmin: vi.fn() }));
vi.mock('@/lib/admin-auth', () => auth);
import { POST as translate } from '@/app/api/ai/ifizinha/route';
import { POST as extract } from '@/app/api/admin/editais/extract-pdf/route';
describe('rotas administrativas de IA', () => {
  it.each([401, 403])('simplificação recusa %s antes de ler o corpo', async status => {
    auth.exigirAdmin.mockResolvedValue({ ok: false, error: 'Sem acesso', status });
    const json = vi.fn();
    expect((await translate({ json } as never)).status).toBe(status);
    expect(json).not.toHaveBeenCalled();
  });
  it.each([401, 403])('extração recusa %s antes de ler o arquivo', async status => {
    auth.exigirAdmin.mockResolvedValue({ ok: false, error: 'Sem acesso', status });
    const formData = vi.fn();
    expect((await extract({ formData } as never)).status).toBe(status);
    expect(formData).not.toHaveBeenCalled();
  });
});
