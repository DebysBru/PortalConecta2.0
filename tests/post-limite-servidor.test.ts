import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regra do servidor para mídia de post: o limite de 20 MB é do POST e é conferido
 * ANTES de gravar, com o tamanho real dos arquivos (o cliente não decide nada).
 *
 * O que precisa ficar travado:
 *  - post acima do limite não é gravado (nem no create, nem no update);
 *  - os anexos gravados são os NORMALIZADOS pelo servidor, não os do cliente;
 *  - anexo que saiu da lista sai do disco (o botão "remover" promete isso);
 *  - o HTML continua sendo sanitizado (imagem sobrevive, script não).
 */

const prismaMock = vi.hoisted(() => ({
  post: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
}));

const permissoesMock = vi.hoisted(() => ({
  temAcessoAoProjeto: vi.fn(),
  isAdministradorGeral: vi.fn(),
  projetosAcessiveis: vi.fn(),
  whereUsuarioTemAcessoAoProjeto: vi.fn(),
}));

const storageMock = vi.hoisted(() => ({
  pesoDasMidiasDoPost: vi.fn(),
  removerArquivo: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, db: prismaMock }));
vi.mock('@/lib/permissions', () => permissoesMock);
vi.mock('@/lib/email', () => ({ enviarAtualizacaoStatus: vi.fn() }));
vi.mock('@/lib/notificacoes', () => ({
  notificarMudancaStatusInscricao: vi.fn(),
  rotuloStatusInscricao: (s: string) => s,
}));

// Mock PARCIAL: só o que toca o disco é substituído; o resto do módulo (magic
// bytes, limites) continua real.
vi.mock('@/lib/file-storage', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/file-storage')>();
  return {
    ...real,
    pesoDasMidiasDoPost: storageMock.pesoDasMidiasDoPost,
    removerArquivo: storageMock.removerArquivo,
  };
});

import { createPost, updatePost } from '@/actions/professor';

const MB = 1024 * 1024;
const PROFESSOR = 'professor.teste@ifpr.edu.br';

function anexoNormalizado(path = 'outros/2026/10/pacote.zip') {
  return {
    path,
    url: `/files/${path}`,
    nome: 'pacote.zip',
    bytes: 3 * MB,
    mime: 'application/zip',
  };
}

function dadosDoPost(overrides: Record<string, unknown> = {}) {
  return {
    titulo: 'Seleção de bolsistas',
    conteudo: '<p>Resultado</p><img src="/files/imagens/2026/10/a.png">',
    resumo: '',
    status: 'PUBLICADO' as const,
    anexos: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  permissoesMock.temAcessoAoProjeto.mockResolvedValue(true);
  prismaMock.user.findUnique.mockResolvedValue({ id: 'user-prof-1' });
  prismaMock.post.create.mockResolvedValue({});
  prismaMock.post.update.mockResolvedValue({});
  prismaMock.post.findUnique.mockResolvedValue({ projetoId: 'projeto-1', anexos: [] });
  storageMock.pesoDasMidiasDoPost.mockResolvedValue({
    totalBytes: 3 * MB,
    imagens: ['imagens/2026/10/a.png'],
    anexos: [anexoNormalizado()],
    ausentes: [],
  });
  storageMock.removerArquivo.mockResolvedValue(true);
});

describe('createPost — limite de 20 MB por post', () => {
  it('recusa e NÃO grava quando o post passa do limite', async () => {
    storageMock.pesoDasMidiasDoPost.mockResolvedValue({
      totalBytes: 21 * MB,
      imagens: ['imagens/2026/10/a.png'],
      anexos: [],
      ausentes: [],
    });

    const resultado = await createPost('projeto-1', dadosDoPost(), PROFESSOR);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain('21.0 MB');
      expect(resultado.error).toContain('20 MB');
    }
    expect(prismaMock.post.create).not.toHaveBeenCalled();
  });

  it('grava abaixo do limite com o HTML sanitizado e os anexos do servidor', async () => {
    const resultado = await createPost(
      'projeto-1',
      dadosDoPost({
        // Script precisa sair; a imagem do nosso storage precisa ficar.
        conteudo: '<p>Oi</p><script>alert(1)</script><img src="/files/imagens/2026/10/a.png">',
        anexos: [{ url: '/files/outros/2026/10/pacote.zip', bytes: 1 }],
      }),
      PROFESSOR,
    );

    expect(resultado.ok).toBe(true);
    const { data } = prismaMock.post.create.mock.calls[0][0];
    expect(data.conteudo).not.toContain('<script');
    expect(data.conteudo).toContain('/files/imagens/2026/10/a.png');
    // Anexos salvos são os normalizados (o `bytes: 1` do cliente é ignorado).
    expect(data.anexos).toEqual([anexoNormalizado()]);
    expect(data.autorizado).toBeUndefined();
    expect(data.authorId).toBe('user-prof-1');
    expect(data.projetoId).toBe('projeto-1');
  });

  it('sem acesso ao projeto não grava nada', async () => {
    permissoesMock.temAcessoAoProjeto.mockResolvedValue(false);

    const resultado = await createPost('projeto-1', dadosDoPost(), 'estranho@ifpr.edu.br');

    expect(resultado.ok).toBe(false);
    expect(prismaMock.post.create).not.toHaveBeenCalled();
    expect(storageMock.pesoDasMidiasDoPost).not.toHaveBeenCalled();
  });
});

describe('updatePost — limite e limpeza dos anexos removidos', () => {
  it('recusa e não atualiza quando passa do limite', async () => {
    storageMock.pesoDasMidiasDoPost.mockResolvedValue({
      totalBytes: 25 * MB,
      imagens: [],
      anexos: [],
      ausentes: [],
    });

    const resultado = await updatePost('post-1', dadosDoPost(), PROFESSOR);

    expect(resultado.ok).toBe(false);
    expect(prismaMock.post.update).not.toHaveBeenCalled();
  });

  it('apaga do disco o anexo que saiu da lista (e mantém o que ficou)', async () => {
    const mantido = anexoNormalizado('outros/2026/10/mantido.zip');
    const removido = anexoNormalizado('outros/2026/10/removido.zip');
    prismaMock.post.findUnique.mockResolvedValue({
      projetoId: 'projeto-1',
      anexos: [mantido, removido],
    });
    storageMock.pesoDasMidiasDoPost.mockResolvedValue({
      totalBytes: 3 * MB,
      imagens: [],
      anexos: [mantido],
      ausentes: [],
    });

    const resultado = await updatePost('post-1', dadosDoPost(), PROFESSOR);

    expect(resultado.ok).toBe(true);
    expect(storageMock.removerArquivo).toHaveBeenCalledTimes(1);
    expect(storageMock.removerArquivo).toHaveBeenCalledWith('outros/2026/10/removido.zip');
    expect(prismaMock.post.update.mock.calls[0][0].data.anexos).toEqual([mantido]);
  });

  it('falha ao apagar arquivo não desfaz a atualização do post', async () => {
    prismaMock.post.findUnique.mockResolvedValue({
      projetoId: 'projeto-1',
      anexos: [anexoNormalizado('outros/2026/10/sai.zip')],
    });
    storageMock.pesoDasMidiasDoPost.mockResolvedValue({
      totalBytes: 0,
      imagens: [],
      anexos: [],
      ausentes: [],
    });
    storageMock.removerArquivo.mockRejectedValue(new Error('disco fora'));

    const resultado = await updatePost('post-1', dadosDoPost({ anexos: [] }), PROFESSOR);

    expect(resultado.ok).toBe(true);
    expect(prismaMock.post.update).toHaveBeenCalled();
  });
});
