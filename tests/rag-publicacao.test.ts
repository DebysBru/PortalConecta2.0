import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ tx: { $executeRaw: vi.fn(), documentoKb: { findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() } } }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: (fn: any) => fn(mock.tx) } }));
import { publicarVersaoRag } from '@/lib/rag-publicacao';
beforeEach(() => vi.clearAllMocks());
describe('ativação da versão preparada', () => {
  it('não desativa versão anterior quando a nova não está pronta', async () => {
    mock.tx.documentoKb.findUniqueOrThrow.mockResolvedValue({ id: 'new', status: 'failed' });
    await expect(publicarVersaoRag('new')).rejects.toThrow('não está pronta');
    expect(mock.tx.documentoKb.updateMany).not.toHaveBeenCalled();
  });
  it('não sobrescreve publicação concorrente', async () => {
    mock.tx.documentoKb.findUniqueOrThrow.mockResolvedValue({ id: 'new', status: 'indexed', refId: 'kb:1', metadata: { anteriorId: 'old' } });
    mock.tx.documentoKb.findFirst.mockResolvedValue({ id: 'other', status: 'indexed' });
    await expect(publicarVersaoRag('new')).rejects.toThrow('Outra versão');
    expect(mock.tx.documentoKb.updateMany).not.toHaveBeenCalled();
  });
  it('recusa perda silenciosa de capacidade semântica', async () => {
    mock.tx.documentoKb.findUniqueOrThrow.mockResolvedValue({ id: 'new', status: 'textual', refId: 'kb:1', metadata: { anteriorId: 'old' } });
    mock.tx.documentoKb.findFirst.mockResolvedValue({ id: 'old', status: 'indexed' });
    await expect(publicarVersaoRag('new')).rejects.toThrow('busca semântica');
    expect(mock.tx.documentoKb.updateMany).not.toHaveBeenCalled();
  });
  it('ativa somente depois da preparação e usa lock de identidade', async () => {
    mock.tx.documentoKb.findUniqueOrThrow.mockResolvedValue({ id: 'new', status: 'indexed', refId: 'kb:1', metadata: { anteriorId: 'old' } });
    mock.tx.documentoKb.findFirst.mockResolvedValue({ id: 'old', status: 'indexed' });
    await publicarVersaoRag('new');
    expect(mock.tx.$executeRaw).toHaveBeenCalledOnce();
    expect(mock.tx.documentoKb.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { ativo: false } }));
    expect(mock.tx.documentoKb.update).toHaveBeenLastCalledWith({ where: { id: 'new' }, data: expect.objectContaining({ ativo: true, refId: 'kb:1', metadata: expect.objectContaining({ publicadoEm: expect.any(String) }) }) });
  });
  it('reativa versão já publicada quando não há outra ativa', async () => {
    mock.tx.documentoKb.findUniqueOrThrow.mockResolvedValue({ id: 'new', status: 'indexed', refId: 'kb:1', metadata: { anteriorId: 'old', publicadoEm: '2026-10-22T00:00:00Z' } });
    mock.tx.documentoKb.findFirst.mockResolvedValue(null);
    mock.tx.documentoKb.findUnique.mockResolvedValue({ id: 'old', status: 'indexed', ativo: false });
    await expect(publicarVersaoRag('new')).resolves.not.toThrow();
  });
});
