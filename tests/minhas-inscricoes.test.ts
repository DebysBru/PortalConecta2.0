import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Ações do estudante sobre a própria inscrição: desistir e responder a uma
 * convocação.
 *
 * O que precisa ficar blindado (mesma família dos achados S3/S18/S20 do
 * RELATORIO_TESTES.md):
 *  1. POSSE — ninguém age sobre inscrição de outra pessoa, nem "adivinhando" um
 *     id no cliente;
 *  2. TRANSIÇÃO — o servidor não confia que só o botão certo era clicável;
 *  3. RASTRO — quem desiste/recusa libera vaga, então fica auditoria e a
 *     coordenação é avisada.
 */

const prismaMock = vi.hoisted(() => ({
  inscricao: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  projeto: {
    findUnique: vi.fn(),
  },
  notificacao: {
    create: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, db: prismaMock }));

const sessaoMock = vi.hoisted(() => ({
  resolverUsuarioDaSessao: vi.fn(),
}));

vi.mock('@/lib/usuario-sessao', () => ({
  resolverUsuarioDaSessao: sessaoMock.resolverUsuarioDaSessao,
}));

import { desistirDaInscricao, responderConvocacao } from '@/actions/minhas-inscricoes';

const SESSAO = { ok: true as const, userId: 'user-1', email: 'aluno@ifpr.edu.br' };

function inscricaoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'insc-1',
    protocolo: 'PRJ-2026-000001',
    status: 'recebida',
    resposta_aluno: null,
    user_id: 'user-1',
    email: 'aluno@ifpr.edu.br',
    nome_completo: 'Maria da Silva',
    projeto_id: 'projeto-1',
    projeto: { nome: 'Robótica no Ensino Médio' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessaoMock.resolverUsuarioDaSessao.mockResolvedValue(SESSAO);
  prismaMock.inscricao.findUnique.mockResolvedValue(inscricaoBase());
  prismaMock.inscricao.update.mockResolvedValue({});
  prismaMock.auditLog.create.mockResolvedValue({});
  prismaMock.notificacao.create.mockResolvedValue({});
  // Coordenador + admin do projeto: os dois precisam receber o aviso.
  prismaMock.projeto.findUnique.mockResolvedValue({
    admins: [{ id: 'admin-1' }],
    coordenadores: [{ user_id: 'coord-1' }],
  });
});

describe('posse da inscrição', () => {
  it('recusa quando o id não existe', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(null);

    const resultado = await desistirDaInscricao('token', 'insc-de-outro');

    expect(resultado.ok).toBe(false);
    expect(prismaMock.inscricao.update).not.toHaveBeenCalled();
  });

  it('recusa inscrição de OUTRA pessoa mesmo com o id correto', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(
      inscricaoBase({ user_id: 'user-2', email: 'outra@ifpr.edu.br' }),
    );

    const resultado = await responderConvocacao('token', 'insc-1', 'aceito');

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/sua conta/i);
    expect(prismaMock.inscricao.update).not.toHaveBeenCalled();
    expect(prismaMock.notificacao.create).not.toHaveBeenCalled();
  });

  it('aceita inscrição antiga, feita sem login, pelo e-mail da sessão', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(
      inscricaoBase({ user_id: null, status: 'selecionado' }),
    );

    const resultado = await responderConvocacao('token', 'insc-1', 'aceito');

    expect(resultado.ok).toBe(true);
    expect(prismaMock.inscricao.update).toHaveBeenCalled();
  });

  it('compara o e-mail sem diferenciar maiúsculas', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(
      inscricaoBase({ user_id: null, email: 'ALUNO@IFPR.EDU.BR' }),
    );

    const resultado = await desistirDaInscricao('token', 'insc-1');

    expect(resultado.ok).toBe(true);
  });

  it('sem sessão válida, nem chega ao banco', async () => {
    sessaoMock.resolverUsuarioDaSessao.mockResolvedValue({
      ok: false,
      error: 'Sua sessão expirou. Entre novamente para continuar.',
    });

    const resultado = await desistirDaInscricao('token-expirado', 'insc-1');

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/sessão/i);
    expect(prismaMock.inscricao.findUnique).not.toHaveBeenCalled();
  });
});

describe('desistir da inscrição', () => {
  it('marca como desistente, carimba a data e avisa a coordenação', async () => {
    const resultado = await desistirDaInscricao('token', 'insc-1', 'Consegui outra bolsa');

    expect(resultado).toEqual({ ok: true, status: 'desistente', respostaAluno: null });

    const { data } = prismaMock.inscricao.update.mock.calls[0][0];
    expect(data.status).toBe('desistente');
    expect(data.desistiu_em).toBeInstanceOf(Date);
    // O motivo precisa chegar ao coordenador: é o campo que ele lê no painel.
    expect(data.observacao_interna).toContain('Consegui outra bolsa');

    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    const auditoria = prismaMock.auditLog.create.mock.calls[0][0].data;
    expect(auditoria.acao).toBe('desistencia_inscricao');
    expect(auditoria.entidade_id).toBe('insc-1');
    expect(auditoria.detalhes.status_anterior).toBe('recebida');

    // Um aviso para o coordenador e um para o admin do projeto.
    expect(prismaMock.notificacao.create).toHaveBeenCalledTimes(2);
    const destinatarios = prismaMock.notificacao.create.mock.calls.map((c) => c[0].data.user_id);
    expect(destinatarios.sort()).toEqual(['admin-1', 'coord-1']);
  });

  it('não sobrescreve a observação interna quando não há motivo', async () => {
    await desistirDaInscricao('token', 'insc-1');

    const { data } = prismaMock.inscricao.update.mock.calls[0][0];
    expect(data).not.toHaveProperty('observacao_interna');
  });

  it('recusa desistir duas vezes', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(inscricaoBase({ status: 'desistente' }));

    const resultado = await desistirDaInscricao('token', 'insc-1');

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/já desistiu/i);
    expect(prismaMock.inscricao.update).not.toHaveBeenCalled();
  });

  it('recusa desistir de inscrição encerrada como "não selecionado"', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(
      inscricaoBase({ status: 'nao_selecionado' }),
    );

    const resultado = await desistirDaInscricao('token', 'insc-1');

    expect(resultado.ok).toBe(false);
    expect(prismaMock.inscricao.update).not.toHaveBeenCalled();
  });

  it('preserva a resposta dada quando o aluno desiste depois de aceitar', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(
      inscricaoBase({ status: 'selecionado', resposta_aluno: 'aceito' }),
    );

    const resultado = await desistirDaInscricao('token', 'insc-1');

    expect(resultado).toEqual({ ok: true, status: 'desistente', respostaAluno: 'aceito' });
  });

  it('falha de auditoria não desfaz a desistência', async () => {
    prismaMock.auditLog.create.mockRejectedValue(new Error('banco fora'));

    const resultado = await desistirDaInscricao('token', 'insc-1');

    expect(resultado.ok).toBe(true);
    expect(prismaMock.inscricao.update).toHaveBeenCalled();
  });
});

describe('responder convocação', () => {
  beforeEach(() => {
    prismaMock.inscricao.findUnique.mockResolvedValue(
      inscricaoBase({ status: 'selecionado', resposta_aluno: null }),
    );
  });

  it('aceitar mantém o status "selecionado" e registra a resposta', async () => {
    const resultado = await responderConvocacao('token', 'insc-1', 'aceito');

    expect(resultado).toEqual({ ok: true, status: 'selecionado', respostaAluno: 'aceito' });

    const { data } = prismaMock.inscricao.update.mock.calls[0][0];
    expect(data.resposta_aluno).toBe('aceito');
    expect(data.respondido_em).toBeInstanceOf(Date);
    // A vaga continua sendo da pessoa: o status não pode mudar aqui.
    expect(data.status).toBeUndefined();
    expect(prismaMock.notificacao.create).toHaveBeenCalled();
    expect(prismaMock.notificacao.create.mock.calls[0][0].data.titulo).toMatch(/aceita/i);
  });

  it('recusar derruba o status para desistente (a vaga volta a contar como livre)', async () => {
    const resultado = await responderConvocacao('token', 'insc-1', 'recusado');

    expect(resultado).toEqual({ ok: true, status: 'desistente', respostaAluno: 'recusado' });

    const { data } = prismaMock.inscricao.update.mock.calls[0][0];
    expect(data.status).toBe('desistente');
    expect(data.resposta_aluno).toBe('recusado');
    expect(data.desistiu_em).toBeInstanceOf(Date);
    expect(prismaMock.notificacao.create.mock.calls[0][0].data.titulo).toMatch(/recusada/i);
  });

  it('recusa resposta quando a inscrição não está aguardando convocação', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(inscricaoBase({ status: 'recebida' }));

    const resultado = await responderConvocacao('token', 'insc-1', 'aceito');

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/não está aguardando/i);
    expect(prismaMock.inscricao.update).not.toHaveBeenCalled();
  });

  it('recusa responder duas vezes e diz o que já foi respondido', async () => {
    prismaMock.inscricao.findUnique.mockResolvedValue(
      inscricaoBase({ status: 'selecionado', resposta_aluno: 'aceito' }),
    );

    const resultado = await responderConvocacao('token', 'insc-1', 'recusado');

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/já respondeu/i);
    expect(prismaMock.inscricao.update).not.toHaveBeenCalled();
  });

  it('recusa resposta que não existe', async () => {
    const resultado = await responderConvocacao(
      'token',
      'insc-1',
      'talvez' as unknown as 'aceito',
    );

    expect(resultado.ok).toBe(false);
    expect(prismaMock.inscricao.findUnique).not.toHaveBeenCalled();
  });
});
