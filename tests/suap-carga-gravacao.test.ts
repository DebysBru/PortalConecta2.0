import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Gravação da carga semanal — o requisito que importa: "não carregar o que já
 * existe, só buscar os novos".
 *
 * `somenteNovos` é o padrão da carga: o que o portal já tem não pode ser
 * atualizado, reindexado nem sobrescrito, mesmo que o arquivo da captura traga o
 * item de novo (arquivo antigo, script sem a lista de conhecidos...).
 */

const prismaMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  edital: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  projeto: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  syncLog: { create: vi.fn() },
}));

const suapApiMock = vi.hoisted(() => ({
  fetchProjetosFromSuap: vi.fn(),
  fetchEditaisFromSuap: vi.fn(),
  mapStatusProjeto: vi.fn(() => 'EM_EXECUCAO'),
  mapCategoriaEdital: vi.fn(),
}));

const sinteticoMock = vi.hoisted(() => ({ sincronizarProjetoSintetico: vi.fn() }));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, db: prismaMock }));
vi.mock('@/lib/suap-api', () => suapApiMock);
vi.mock('@/lib/projeto-sintetico', () => sinteticoMock);

import { aplicarEditaisDoSuap, aplicarProjetosDoSuap } from '@/lib/suap-sync';
import { analisarEditaisCapturados, type EditalCapturado } from '@/lib/suap-editais';
import { MARCA_CARGA_NAVEGADOR } from '@/lib/suap-carga';

const base = (titulo: string, ano: number): EditalCapturado => ({
  fonte: 'projetos',
  titulo,
  descricao: 'Descrição',
  inscricoes: `01/03/${ano} 00:00:00 a 30/03/${ano} 00:00:00`,
  preSelecao: '', selecao: '', recurso: '', resultado: '',
  campi: 'IVAIPODG',
  temArquivo: true,
});

const [velho, novo] = analisarEditaisCapturados([base('Edital antigo', 2025), base('Edital novo', 2026)]).editais;
const agora = new Date('2026-10-27T12:00:00Z');

const emDia = { id: 'ed-1', slug: 'edital-antigo', titulo: 'Edital antigo', origemRef: velho.chave, suapSyncedAt: new Date('2026-10-20T10:00:00Z'), updatedAt: new Date('2026-10-20T10:00:10Z') };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findFirst.mockResolvedValue({ id: 'admin-1' });
  prismaMock.edital.findMany.mockResolvedValue([emDia]);
  prismaMock.edital.findFirst.mockResolvedValue(null); // slug livre
  prismaMock.edital.create.mockResolvedValue({ id: 'ed-novo' });
  prismaMock.edital.update.mockResolvedValue({ id: 'ed-1' });
  prismaMock.syncLog.create.mockResolvedValue({});
  sinteticoMock.sincronizarProjetoSintetico.mockResolvedValue(undefined);
  prismaMock.projeto.findFirst.mockResolvedValue(null);
  prismaMock.projeto.create.mockResolvedValue({ id: 'p-novo' });
  prismaMock.projeto.update.mockResolvedValue({ id: 'p-1' });
});

describe('editais — só os novos', () => {
  it('cria o que não existe e NÃO toca no que já existe', async () => {
    const r = await aplicarEditaisDoSuap([velho, novo], { somenteNovos: true, agora, origem: MARCA_CARGA_NAVEGADOR });

    expect(prismaMock.edital.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.edital.update).not.toHaveBeenCalled();
    expect(r).toMatchObject({ total: 2, criados: 1, atualizados: 0, ignorados: 1, erros: 0 });

    const dados = prismaMock.edital.create.mock.calls[0][0].data;
    expect(dados).toMatchObject({
      origemRef: novo.chave, source: 'SUAP', review_status: 'PUBLICADO', authorId: 'admin-1', categoria: 'EXTENSAO', ano: 2026,
    });
    expect(dados.dataInicio.toISOString()).toBe('2026-03-01T03:00:00.000Z');
  });

  it('registra a carga no histórico com a marca que o guia usa para mostrar a data', async () => {
    await aplicarEditaisDoSuap([velho], { somenteNovos: true, agora, origem: MARCA_CARGA_NAVEGADOR });

    const log = prismaMock.syncLog.create.mock.calls[0][0].data;
    expect(log.tipo).toBe('editais');
    expect(log.status).toBe('success');
    expect(log.mensagem).toContain(MARCA_CARGA_NAVEGADOR);
    expect(log.sincronizados).toBe(0);
  });

  it('semana sem novidades também registra a data (lista vazia)', async () => {
    const r = await aplicarEditaisDoSuap([], { somenteNovos: true, agora, origem: MARCA_CARGA_NAVEGADOR });
    expect(r.total).toBe(0);
    expect(prismaMock.syncLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it('sem "só os novos", atualiza o existente que não foi editado à mão', async () => {
    const r = await aplicarEditaisDoSuap([velho], { somenteNovos: false, agora });
    expect(prismaMock.edital.update).toHaveBeenCalledTimes(1);
    expect(r.atualizados).toBe(1);
  });

  it('sem "só os novos", preserva o que foi editado à mão — a menos que force', async () => {
    prismaMock.edital.findMany.mockResolvedValue([{ ...emDia, updatedAt: new Date('2026-10-25T10:00:00Z') }]);

    const preservado = await aplicarEditaisDoSuap([velho], { somenteNovos: false, agora });
    expect(preservado.preservados).toBe(1);
    expect(prismaMock.edital.update).not.toHaveBeenCalled();

    const forcado = await aplicarEditaisDoSuap([velho], { somenteNovos: false, forcar: true, agora });
    expect(forcado.atualizados).toBe(1);
  });

  it('um edital que falha não derruba os outros e marca a carga como parcial', async () => {
    prismaMock.edital.create.mockRejectedValueOnce(new Error('falhou'));
    const outro = analisarEditaisCapturados([base('Outro', 2026)]).editais[0];
    const r = await aplicarEditaisDoSuap([novo, outro], { somenteNovos: true, agora });
    expect(r.erros).toBe(1);
    expect(r.criados).toBe(1);
    expect(prismaMock.syncLog.create.mock.calls[0][0].data.status).toBe('partial');
  });

  it('o simulado (dryRun) não grava nada', async () => {
    await aplicarEditaisDoSuap([novo], { dryRun: true, agora });
    expect(prismaMock.edital.create).not.toHaveBeenCalled();
    expect(prismaMock.syncLog.create).not.toHaveBeenCalled();
  });
});

describe('projetos — só os novos', () => {
  const projeto = (id: number, fonte: 'extensao' | 'pesquisa') => ({ id, titulo: `Projeto ${id}`, situacao: 'em execução', campus_sigla: 'IVAIPODG', content_type: 'projeto', _fonte: fonte });

  it('não atualiza projeto existente e cria o novo', async () => {
    prismaMock.projeto.findUnique.mockImplementation(async ({ where }: { where: { suapId: number } }) =>
      where.suapId === -1 ? { id: 'p-1', slug: 'x', nome: 'Projeto 1', suapSyncedAt: new Date(), updatedAt: new Date() } : null);

    const r = await aplicarProjetosDoSuap([projeto(1, 'extensao'), projeto(2, 'extensao')], { somenteNovos: true, origem: MARCA_CARGA_NAVEGADOR });

    expect(prismaMock.projeto.update).not.toHaveBeenCalled();
    expect(prismaMock.projeto.create).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ criados: 1, atualizados: 0, ignorados: 1, erros: 0 });
  });

  it('com a origem informada, a carga fica no histórico mesmo sem projeto novo', async () => {
    await aplicarProjetosDoSuap([], { somenteNovos: true, origem: MARCA_CARGA_NAVEGADOR });
    const log = prismaMock.syncLog.create.mock.calls[0][0].data;
    expect(log.tipo).toBe('projetos');
    expect(log.mensagem).toContain(MARCA_CARGA_NAVEGADOR);
  });
});

describe('actions da carga semanal', () => {
  const fonte = readFileSync(join(process.cwd(), 'src', 'actions', 'suap-carga.ts'), 'utf8');

  it('as duas actions exigem o Administrador Geral antes de qualquer coisa', () => {
    for (const nome of ['previsualizarCargaSuap', 'confirmarCargaSuap']) {
      const corpo = fonte.slice(fonte.indexOf(`export async function ${nome}`));
      expect(corpo.indexOf('await exigirAdminGeral()'), nome).toBeGreaterThan(-1);
      expect(corpo.indexOf('await exigirAdminGeral()'), nome).toBeLessThan(corpo.indexOf('entender('));
    }
  });

  it('o padrão é só os novos: atualizar o que existe precisa ser pedido', () => {
    expect(fonte).toContain('const somenteNovos = !opcoes.atualizarExistentes;');
  });
});
