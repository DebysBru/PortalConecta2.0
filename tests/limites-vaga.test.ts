import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Limites de entrada da VAGA — o caso citado pela coordenação: "valor da bolsa
 * não vai passar de 9999,99".
 *
 * Antes, `valorBolsa` aceitava qualquer coisa (negativo, 1e308, 10 casas
 * decimais), `quantidade` aceitava 0 e `cargaHorariaSemanal` aceitava 500 horas
 * por semana. Tudo isso ia direto para o card público da vaga.
 */

const prismaMock = vi.hoisted(() => ({
  vaga: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  inscricao: { groupBy: vi.fn() },
  projeto: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
}));

const permissoesMock = vi.hoisted(() => ({
  temAcessoAoProjeto: vi.fn(),
  isAdministradorGeral: vi.fn(),
  projetosAcessiveis: vi.fn(),
  whereUsuarioTemAcessoAoProjeto: vi.fn(),
}));

const sessaoMock = vi.hoisted(() => ({ getVerifiedServerSession: vi.fn() }));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, db: prismaMock }));
vi.mock('@/lib/permissions', () => permissoesMock);
vi.mock('@/lib/session', () => sessaoMock);
vi.mock('@/lib/email', () => ({ enviarAtualizacaoStatus: vi.fn() }));
vi.mock('@/lib/notificacoes', () => ({
  notificarMudancaStatusInscricao: vi.fn(),
  rotuloStatusInscricao: (s: string) => s,
}));

import { createVaga, updateVaga } from '@/actions/professor';

const COORDENADOR = 'coordenador@ifpr.edu.br';

function vagaBase(overrides: Record<string, unknown> = {}) {
  return {
    projetoId: 'projeto-1',
    titulo: 'Bolsista de Robótica',
    tipo: 'BOLSISTA' as const,
    quantidade: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  permissoesMock.temAcessoAoProjeto.mockResolvedValue(true);
  sessaoMock.getVerifiedServerSession.mockResolvedValue({ uid: 'u1', email: COORDENADOR });
  prismaMock.vaga.findUnique.mockResolvedValue({ projetoId: 'projeto-1' });
  prismaMock.vaga.create.mockResolvedValue({ id: 'vaga-1' });
  prismaMock.vaga.update.mockResolvedValue({});
});

describe('valor da bolsa', () => {
  it('aceita até 9.999,99', async () => {
    const resultado = await createVaga('projeto-1', vagaBase({ valorBolsa: 9999.99 }), COORDENADOR);

    expect(resultado.ok).toBe(true);
    expect(prismaMock.vaga.create.mock.calls[0][0].data.valorBolsa).toBe(9999.99);
  });

  it('recusa acima de 9.999,99 com mensagem clara', async () => {
    const resultado = await createVaga('projeto-1', vagaBase({ valorBolsa: 10000 }), COORDENADOR);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain('Valor da bolsa');
      expect(resultado.error).toContain('9999,99');
    }
    expect(prismaMock.vaga.create).not.toHaveBeenCalled();
  });

  it('recusa valor negativo, absurdo e com casas decimais demais', async () => {
    for (const valor of [-100, 1e308, 1500.999]) {
      const resultado = await createVaga('projeto-1', vagaBase({ valorBolsa: valor }), COORDENADOR);
      expect(resultado.ok).toBe(false);
    }
    expect(prismaMock.vaga.create).not.toHaveBeenCalled();
  });

  it('vazio vira null (vaga sem bolsa, ex.: voluntário)', async () => {
    const resultado = await createVaga('projeto-1', vagaBase({ tipo: 'VOLUNTARIO', valorBolsa: undefined }), COORDENADOR);

    expect(resultado.ok).toBe(true);
    expect(prismaMock.vaga.create.mock.calls[0][0].data.valorBolsa).toBeNull();
  });
});

describe('quantidade, carga horária e vigência', () => {
  it('quantidade precisa ser pelo menos 1', async () => {
    for (const quantidade of [0, -5]) {
      const resultado = await createVaga('projeto-1', vagaBase({ quantidade }), COORDENADOR);
      expect(resultado.ok).toBe(false);
    }
    expect(prismaMock.vaga.create).not.toHaveBeenCalled();
  });

  it('quantidade não passa de 999 e não aceita fração', async () => {
    expect((await createVaga('projeto-1', vagaBase({ quantidade: 1000 }), COORDENADOR)).ok).toBe(false);
    expect((await createVaga('projeto-1', vagaBase({ quantidade: 2.5 }), COORDENADOR)).ok).toBe(false);
  });

  it('carga horária semanal fica entre 1 e 168 horas', async () => {
    expect((await createVaga('projeto-1', vagaBase({ cargaHorariaSemanal: 20 }), COORDENADOR)).ok).toBe(true);
    expect((await createVaga('projeto-1', vagaBase({ cargaHorariaSemanal: 0 }), COORDENADOR)).ok).toBe(false);
    expect((await createVaga('projeto-1', vagaBase({ cargaHorariaSemanal: 500 }), COORDENADOR)).ok).toBe(false);
  });

  it('vigência não passa de 120 meses', async () => {
    expect((await createVaga('projeto-1', vagaBase({ vigenciaMeses: 12 }), COORDENADOR)).ok).toBe(true);
    expect((await createVaga('projeto-1', vagaBase({ vigenciaMeses: 121 }), COORDENADOR)).ok).toBe(false);
  });
});

describe('textos da vaga', () => {
  it('título tem teto de 120 caracteres', async () => {
    const resultado = await createVaga('projeto-1', vagaBase({ titulo: 'a'.repeat(5000) }), COORDENADOR);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain('5000 caracteres');
  });

  it('descrição e requisitos têm teto de 4.000 caracteres', async () => {
    for (const campo of ['descricao', 'requisitos'] as const) {
      const resultado = await createVaga(
        'projeto-1',
        vagaBase({ [campo]: 'x'.repeat(5000) }),
        COORDENADOR,
      );
      expect(resultado.ok).toBe(false);
    }
  });
});

describe('update da vaga', () => {
  it('também valida o valor da bolsa', async () => {
    const resultado = await updateVaga('vaga-1', { valorBolsa: 50000 }, COORDENADOR);

    expect(resultado.ok).toBe(false);
    expect(prismaMock.vaga.update).not.toHaveBeenCalled();
  });

  it('update parcial sem valor não mexe no campo', async () => {
    const resultado = await updateVaga('vaga-1', { titulo: 'Novo título' }, COORDENADOR);

    expect(resultado.ok).toBe(true);
    const dados = prismaMock.vaga.update.mock.calls[0][0].data;
    expect(dados.titulo).toBe('Novo título');
    expect(dados.valorBolsa).toBeUndefined();
  });

  it('situação da vaga fora das opções é recusada', async () => {
    const resultado = await updateVaga(
      'vaga-1',
      { status: 'INVENTADO' } as unknown as { status: 'ABERTA' },
      COORDENADOR,
    );

    expect(resultado.ok).toBe(false);
  });
});

describe('autorização continua valendo (sessão verificada)', () => {
  it('sem acesso ao projeto, nada é gravado', async () => {
    permissoesMock.temAcessoAoProjeto.mockResolvedValue(false);

    const resultado = await createVaga('projeto-1', vagaBase(), 'estranho@ifpr.edu.br');

    expect(resultado.ok).toBe(false);
    expect(prismaMock.vaga.create).not.toHaveBeenCalled();
  });
});
