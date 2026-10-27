import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Seleção por vaga em `updateInscricaoStatus` (ação da coordenação).
 *
 * Contexto do relato: "mudei um aluno de selecionado para desistente e mesmo
 * assim não deixou eu colocar outro aluno como selecionado". O bloqueio estava
 * CERTO — quem ocupava a vaga era OUTRA inscrição da mesma vaga (num estado
 * antigo, com mais selecionados do que posições). O que faltava era a mensagem
 * dizer QUEM ocupa.
 *
 * Estes testes travam as duas metades: o bloqueio continua existindo (não dá
 * para estourar a cota) e a mensagem identifica quem está selecionado.
 */

const prismaMock = vi.hoisted(() => ({
  inscricao: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  vaga: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, db: prismaMock }));

const permissoesMock = vi.hoisted(() => ({
  temAcessoAoProjeto: vi.fn(),
  isAdministradorGeral: vi.fn(),
  projetosAcessiveis: vi.fn(),
  whereUsuarioTemAcessoAoProjeto: vi.fn(),
}));

vi.mock('@/lib/permissions', () => permissoesMock);
vi.mock('@/lib/email', () => ({ enviarAtualizacaoStatus: vi.fn() }));
vi.mock('@/lib/notificacoes', () => ({
  notificarMudancaStatusInscricao: vi.fn(),
  rotuloStatusInscricao: (s: string) => s,
}));

import { updateInscricaoStatus } from '@/actions/professor';
import { enviarAtualizacaoStatus } from '@/lib/email';
import { notificarMudancaStatusInscricao } from '@/lib/notificacoes';

const COORDENADOR = 'coord@ifpr.edu.br';
const VAGA_ID = 'vaga-robotica';

function inscricaoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'insc-nova',
    protocolo: 'PRJ-2026-000009',
    status: 'recebida',
    nome_completo: 'Débora Bruna',
    email: 'debora@estudantes.ifpr.edu.br',
    user_id: 'user-9',
    vaga_id: VAGA_ID,
    projeto: { id: 'projeto-1', nome: 'Robótica', slug: 'demo-robotica-demo' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  permissoesMock.temAcessoAoProjeto.mockResolvedValue(true);
  // Implementações repostas a cada teste: `restoreMocks` do vitest.config zera
  // o que foi definido só na fábrica do `vi.mock`.
  vi.mocked(enviarAtualizacaoStatus).mockResolvedValue({ ok: true });
  vi.mocked(notificarMudancaStatusInscricao).mockResolvedValue(true);
  prismaMock.inscricao.findUnique.mockResolvedValue(inscricaoBase());
  prismaMock.inscricao.findMany.mockResolvedValue([]);
  prismaMock.inscricao.update.mockResolvedValue({});
  prismaMock.vaga.findUnique.mockResolvedValue({
    titulo: 'Bolsista — Monitoria de Robótica',
    quantidade: 1,
  });
});

describe('bloqueio por cota da vaga', () => {
  it('libera quando a vaga está vazia', async () => {
    const resultado = await updateInscricaoStatus('insc-nova', 'selecionado', undefined, COORDENADOR);

    expect(resultado.ok).toBe(true);
    expect(prismaMock.inscricao.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'selecionado' }) }),
    );
  });

  it('bloqueia quando outra inscrição da mesma vaga já está selecionada — e diz quem', async () => {
    prismaMock.inscricao.findMany.mockResolvedValue([
      { nome_completo: 'Felipe Andrade Rocha', protocolo: 'PRJ-2026-900005-DEMO' },
    ]);

    const resultado = await updateInscricaoStatus('insc-nova', 'selecionado', undefined, COORDENADOR);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain('Felipe Andrade Rocha (PRJ-2026-900005-DEMO)');
      expect(resultado.error).toContain('Bolsista — Monitoria de Robótica');
    }
    expect(prismaMock.inscricao.update).not.toHaveBeenCalled();
  });

  it('explica a vaga com MAIS selecionados do que posições (estado antigo)', async () => {
    prismaMock.inscricao.findMany.mockResolvedValue([
      { nome_completo: 'Carla Mendes Oliveira', protocolo: 'PRJ-2026-900002-DEMO' },
      { nome_completo: 'Felipe Andrade Rocha', protocolo: 'PRJ-2026-900005-DEMO' },
    ]);

    const resultado = await updateInscricaoStatus('insc-nova', 'selecionado', undefined, COORDENADOR);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toMatch(/2 selecionados para 1 posição/);
      expect(resultado.error).toContain('Carla Mendes Oliveira');
      expect(resultado.error).toContain('Felipe Andrade Rocha');
    }
  });

  it('recusa um status fora da lista conhecida', async () => {
    const resultado = await updateInscricaoStatus('insc-nova', 'inventado', undefined, COORDENADOR);

    expect(resultado.ok).toBe(false);
    expect(prismaMock.inscricao.update).not.toHaveBeenCalled();
  });

  it('não notifica quando o status não mudou (só a observação foi salva)', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(inscricaoBase({ status: 'selecionado' }));

    const resultado = await updateInscricaoStatus('insc-nova', 'selecionado', 'observação interna', COORDENADOR);

    expect(resultado.ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(notificarMudancaStatusInscricao).not.toHaveBeenCalled();
    expect(enviarAtualizacaoStatus).not.toHaveBeenCalled();
  });

  it('não conta a própria inscrição como ocupante (remarcar o mesmo selecionado)', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(inscricaoBase({ status: 'selecionado' }));
    // O `id: { not: inscricaoId }` do filtro é do banco; aqui simulamos o
    // resultado já sem a própria linha.
    prismaMock.inscricao.findMany.mockResolvedValue([]);

    const resultado = await updateInscricaoStatus('insc-nova', 'selecionado', undefined, COORDENADOR);

    expect(resultado.ok).toBe(true);
    const filtro = prismaMock.inscricao.findMany.mock.calls[0][0].where;
    expect(filtro.id).toEqual({ not: 'insc-nova' });
    expect(filtro.status).toBe('selecionado');
    expect(filtro.vaga_id).toBe(VAGA_ID);
  });

  it('libera quando a vaga tem mais posições do que ocupantes', async () => {
    prismaMock.vaga.findUnique.mockResolvedValue({
      titulo: 'Voluntário(a) — Educação Ambiental',
      quantidade: 3,
    });
    prismaMock.inscricao.findMany.mockResolvedValue([
      { nome_completo: 'Ana', protocolo: 'P1' },
      { nome_completo: 'Bruno', protocolo: 'P2' },
    ]);

    const resultado = await updateInscricaoStatus('insc-nova', 'selecionado', undefined, COORDENADOR);

    expect(resultado.ok).toBe(true);
  });

  it('não checa cota quando a inscrição não tem vaga', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(inscricaoBase({ vaga_id: null }));

    const resultado = await updateInscricaoStatus('insc-nova', 'selecionado', undefined, COORDENADOR);

    expect(resultado.ok).toBe(true);
    expect(prismaMock.vaga.findUnique).not.toHaveBeenCalled();
  });

  it('mudar para "desistente" NUNCA é bloqueado pela cota (é o que libera a vaga)', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(inscricaoBase({ status: 'selecionado' }));

    const resultado = await updateInscricaoStatus('insc-nova', 'desistente', undefined, COORDENADOR);

    expect(resultado.ok).toBe(true);
    expect(prismaMock.inscricao.findMany).not.toHaveBeenCalled();
    expect(prismaMock.inscricao.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'desistente' }) }),
    );
  });
});

describe('permissão continua sendo exigida', () => {
  it('recusa quem não coordena o projeto, sem tocar no banco de inscrição', async () => {
    permissoesMock.temAcessoAoProjeto.mockResolvedValue(false);

    const resultado = await updateInscricaoStatus('insc-nova', 'selecionado', undefined, 'estranho@x.com');

    expect(resultado.ok).toBe(false);
    expect(prismaMock.inscricao.update).not.toHaveBeenCalled();
    expect(prismaMock.vaga.findUnique).not.toHaveBeenCalled();
  });
});
