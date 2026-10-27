import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  embeddings: vi.fn(), save: vi.fn(),
  prisma: { job: { create: vi.fn(), update: vi.fn() }, documentoKb: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock('@/lib/prisma', () => ({ prisma: mock.prisma }));
vi.mock('@/lib/embeddings', async original => ({ ...await original<typeof import('@/lib/embeddings')>(), generateBatchEmbeddings: mock.embeddings }));
vi.mock('@/lib/busca-vetorial', () => ({ saveChunksWithEmbeddings: mock.save }));
import { EmbeddingNotConfigured } from '@/lib/embeddings';
import { indexarDocumentoKb } from '@/lib/indexador';
beforeEach(() => {
  vi.clearAllMocks();
  mock.prisma.job.create.mockResolvedValue({ id: 'job' });
  mock.prisma.job.update.mockResolvedValue({}); mock.prisma.documentoKb.update.mockResolvedValue({});
  mock.prisma.documentoKb.findUnique.mockResolvedValue({ id: 'doc', metadata: {}, chunks: [{ id: 'c1', documentoId: 'doc', documentoVersao: 1, chunkIndex: 0, texto: 'Original', secao: 'Seção', metadata: {}, ativo: true }] });
  mock.embeddings.mockResolvedValue([Array(1536).fill(0.1)]); mock.save.mockResolvedValue(1);
});
describe('estado verificável da indexação', () => {
  it('marca indexed somente após salvar todos os vetores', async () => {
    expect(await indexarDocumentoKb('doc')).toBe('indexed');
    expect(mock.embeddings).toHaveBeenCalledWith(['Seção: Original']);
    expect(mock.prisma.documentoKb.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'indexed', metadata: expect.objectContaining({ semantic: true }) }) }));
  });
  it('sem chave disponibiliza somente capacidade textual e não grava vetores', async () => {
    mock.embeddings.mockRejectedValue(new EmbeddingNotConfigured('sem chave'));
    expect(await indexarDocumentoKb('doc')).toBe('textual');
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('persistência parcial nunca vira sucesso', async () => {
    mock.save.mockResolvedValue(0);
    await expect(indexarDocumentoKb('doc')).rejects.toThrow();
    expect(mock.prisma.documentoKb.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }));
  });
  it('propaga indisponibilidade real ao responsável pela publicação', async () => {
    mock.embeddings.mockRejectedValue(new Error('rede indisponível'));
    await expect(indexarDocumentoKb('doc')).rejects.toThrow();
    expect(mock.save).not.toHaveBeenCalled();
  });
});
