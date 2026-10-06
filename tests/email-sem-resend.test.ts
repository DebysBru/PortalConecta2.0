import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// O cliente do Resend é mockado: o teste do caminho "configurado" não pode
// depender de rede (e nem de uma chave de verdade).
const enviados = vi.hoisted(() => [] as Array<{ to: string; subject: string; html: string }>);
vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (payload: { to: string; subject: string; html: string }) => {
        enviados.push(payload);
        return { data: { id: 'teste' }, error: null };
      },
    };
  },
}));

import {
  enviarConfirmacaoInscricao,
  enviarAtualizacaoStatus,
  enviarBoasVindas,
  enviarAlertaEdital,
  resendConfigurado,
} from '@/lib/email';

/**
 * Envio de e-mail com o Resend DESLIGADO (sem `RESEND_API_KEY`).
 *
 * Decisão do responsável (05/10/2026): o portal ainda não usa o Resend. O
 * contrato tem de continuar o de sempre — `{ ok: false, error }`, nunca lançar,
 * nunca derrubar a ação de negócio que disparou o aviso (inscrição, mudança de
 * status, alerta de edital) — mas **sem** `console.error`: antes, cada
 * inscrição/mudança de status despejava um stack trace no journal de produção
 * ("Erro ao enviar e-mail de atualização"), ruído que podia esconder um erro de
 * verdade. Os avisos internos do portal (sino / "Minha área") são outro caminho
 * e continuam funcionando.
 */
describe('e-mail sem RESEND_API_KEY', () => {
  const chaveOriginal = process.env.RESEND_API_KEY;
  let erroNoConsole: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    erroNoConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (chaveOriginal === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = chaveOriginal;
    vi.restoreAllMocks();
  });

  it('resendConfigurado() reflete a ausência da chave', () => {
    expect(resendConfigurado()).toBe(false);
    process.env.RESEND_API_KEY = 're_fake';
    expect(resendConfigurado()).toBe(true);
  });

  it('confirmação de inscrição devolve ok:false sem logar', async () => {
    const r = await enviarConfirmacaoInscricao({
      protocolo: 'ABC123',
      nomeCompleto: 'Aluno Teste',
      email: 'aluno@example.com',
      projetoNome: 'Projeto Teste',
      tipoInteresse: 'Voluntário',
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain('ainda não foi ativado');
    expect(erroNoConsole).not.toHaveBeenCalled();
  });

  it('atualização de status devolve ok:false sem logar (o caso do journal)', async () => {
    const r = await enviarAtualizacaoStatus({
      protocolo: 'ABC123',
      nomeCompleto: 'Aluno Teste',
      email: 'aluno@example.com',
      projetoNome: 'Projeto Teste',
      novoStatus: 'selecionado',
      observacao: 'Compareça à reunião.',
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain('ainda não foi ativado');
    expect(erroNoConsole).not.toHaveBeenCalled();
  });

  it('boas-vindas devolve ok:false sem logar', async () => {
    const r = await enviarBoasVindas('aluno@example.com', 'Aluno Teste');

    expect(r.ok).toBe(false);
    expect(erroNoConsole).not.toHaveBeenCalled();
  });

  it('alerta de edital devolve ok:false sem logar (quem conta é o sino do portal)', async () => {
    const r = await enviarAlertaEdital({
      email: 'aluno@example.com',
      nome: 'Aluno Teste',
      editalTitulo: 'Edital de Extensão',
      editalCategoria: 'extensao',
      editalSlug: 'edital-de-extensao',
      dataEncerramento: null,
    });

    expect(r.ok).toBe(false);
    expect(erroNoConsole).not.toHaveBeenCalled();
  });

  it('nenhuma dessas funções lança (o aviso não pode derrubar a ação de negócio)', async () => {
    await expect(
      Promise.all([
        enviarConfirmacaoInscricao({
          protocolo: 'X', nomeCompleto: 'A', email: 'a@b.c', projetoNome: 'P', tipoInteresse: 'T',
        }),
        enviarAtualizacaoStatus({
          protocolo: 'X', nomeCompleto: 'A', email: 'a@b.c', projetoNome: 'P', novoStatus: 'recebida',
        }),
        enviarBoasVindas('a@b.c', 'A'),
        enviarAlertaEdital({
          email: 'a@b.c', nome: 'A', editalTitulo: 'E', editalCategoria: 'c', editalSlug: 'e',
        }),
      ]),
    ).resolves.toHaveLength(4);
  });

  it('com a chave configurada o envio continua funcionando (não quebrei o caminho normal)', async () => {
    process.env.RESEND_API_KEY = 're_chave_de_teste';

    const r = await enviarBoasVindas('aluno@example.com', 'Aluno Teste');

    expect(r.ok).toBe(true);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].to).toBe('aluno@example.com');
    expect(erroNoConsole).not.toHaveBeenCalled();
  });
});
