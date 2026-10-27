import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * O status dos editais do SUAP acompanha as datas sem ninguém precisar reimportar.
 * A carga semanal só mexe nos editais novos, então sem isto um edital importado como
 * "Aberto" ficaria aberto para sempre.
 */

const prismaMock = vi.hoisted(() => ({
  edital: { findMany: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, db: prismaMock }));

import { atualizarStatusEditaisSuap, garantirStatusEditaisAtualizado, reiniciarLimitadorDeStatus } from '@/lib/editais-status';
import { cache } from '@/lib/cache';

const sincronizado = new Date('2026-10-20T10:00:00Z');
const edital = (id: string, status: string, datas: { i?: string; f?: string; r?: string }, extra: object = {}) => ({
  id,
  status,
  dataInicio: datas.i ? new Date(datas.i) : null,
  dataEncerramento: datas.f ? new Date(datas.f) : null,
  dataResultado: datas.r ? new Date(datas.r) : null,
  suapSyncedAt: sincronizado,
  updatedAt: new Date(sincronizado.getTime() + 5_000), // diferença de segundos = sem edição humana
  ...extra,
});

const agora = new Date('2026-11-10T12:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  reiniciarLimitadorDeStatus();
  prismaMock.edital.findMany.mockResolvedValue([]);
  prismaMock.edital.update.mockResolvedValue({});
});

describe('atualização automática do status', () => {
  it('só olha editais do SUAP, não apagados e ainda não encerrados', async () => {
    await atualizarStatusEditaisSuap({ agora });
    const where = prismaMock.edital.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ origemRef: { startsWith: 'suap-edital:' }, deleted_at: null, status: { not: 'ENCERRADO' } });
  });

  it('edital aberto cujas inscrições acabaram passa para "em análise" e depois "resultado publicado"', async () => {
    prismaMock.edital.findMany.mockResolvedValue([
      edital('a', 'ABERTO', { i: '2026-10-26T03:00:00Z', f: '2026-11-04T03:00:00Z', r: '2026-11-20T03:00:00Z' }),
      edital('b', 'ABERTO', { i: '2026-10-26T03:00:00Z', f: '2026-11-04T03:00:00Z', r: '2026-11-05T03:00:00Z' }),
    ]);
    const r = await atualizarStatusEditaisSuap({ agora });

    expect(r).toMatchObject({ verificados: 2, atualizados: 2 });
    const usados = Object.fromEntries(prismaMock.edital.update.mock.calls.map(([a]) => [a.where.id, a.data.status]));
    expect(usados).toEqual({ a: 'EM_ANALISE', b: 'RESULTADO_PUBLICADO' });
  });

  it('"em breve" vira "aberto" quando as inscrições começam', async () => {
    prismaMock.edital.findMany.mockResolvedValue([edital('c', 'EM_BREVE', { i: '2026-11-01T03:00:00Z', f: '2026-11-30T03:00:00Z' })]);
    await atualizarStatusEditaisSuap({ agora });
    expect(prismaMock.edital.update.mock.calls[0][0].data.status).toBe('ABERTO');
  });

  it('resultado antigo (mais de 30 dias) vira encerrado', async () => {
    prismaMock.edital.findMany.mockResolvedValue([
      edital('d', 'RESULTADO_PUBLICADO', { i: '2026-08-01T03:00:00Z', f: '2026-08-10T03:00:00Z', r: '2026-09-01T03:00:00Z' }),
    ]);
    await atualizarStatusEditaisSuap({ agora });
    expect(prismaMock.edital.update.mock.calls[0][0].data.status).toBe('ENCERRADO');
  });

  it('não escreve nada quando o status já está certo', async () => {
    prismaMock.edital.findMany.mockResolvedValue([edital('e', 'ABERTO', { i: '2026-11-01T03:00:00Z', f: '2030-12-31T03:00:00Z' })]);
    const r = await atualizarStatusEditaisSuap({ agora });
    expect(r?.atualizados).toBe(0);
    expect(prismaMock.edital.update).not.toHaveBeenCalled();
  });

  it('respeita edital editado à mão no portal: o status dele é decisão do admin', async () => {
    prismaMock.edital.findMany.mockResolvedValue([
      edital('f', 'ABERTO', { i: '2026-10-26T03:00:00Z', f: '2026-11-04T03:00:00Z' }, { updatedAt: new Date('2026-11-08T10:00:00Z') }),
    ]);
    const r = await atualizarStatusEditaisSuap({ agora });
    expect(r).toMatchObject({ atualizados: 0, preservados: 1 });
    expect(prismaMock.edital.update).not.toHaveBeenCalled();
  });

  it('grava suapSyncedAt junto, para a atualização não parecer edição manual no próximo sync', async () => {
    prismaMock.edital.findMany.mockResolvedValue([edital('g', 'ABERTO', { i: '2026-10-26T03:00:00Z', f: '2026-11-04T03:00:00Z' })]);
    await atualizarStatusEditaisSuap({ agora });
    const data = prismaMock.edital.update.mock.calls[0][0].data;
    expect(data.suapSyncedAt).toBeInstanceOf(Date);
  });

  it('invalida os caches da lista pública e do chat quando algo mudou', async () => {
    cache.set('editais:published', ['x'], 60_000);
    cache.set('chat:abc', 'y', 60_000);
    prismaMock.edital.findMany.mockResolvedValue([edital('h', 'ABERTO', { i: '2026-10-26T03:00:00Z', f: '2026-11-04T03:00:00Z' })]);
    await atualizarStatusEditaisSuap({ agora });
    expect(cache.get('editais:published')).toBeNull();
    expect(cache.get('chat:abc')).toBeNull();
  });
});

describe('limitador e segurança das páginas', () => {
  it('roda no máximo uma vez a cada 10 minutos (a não ser que se force)', async () => {
    await atualizarStatusEditaisSuap({ agora });
    expect(await atualizarStatusEditaisSuap({ agora: new Date(agora.getTime() + 5 * 60_000) })).toBeNull();
    expect(prismaMock.edital.findMany).toHaveBeenCalledTimes(1);

    await atualizarStatusEditaisSuap({ agora: new Date(agora.getTime() + 11 * 60_000) });
    expect(prismaMock.edital.findMany).toHaveBeenCalledTimes(2);

    await atualizarStatusEditaisSuap({ agora, forcar: true });
    expect(prismaMock.edital.findMany).toHaveBeenCalledTimes(3);
  });

  it('chamadas simultâneas dividem a mesma execução', async () => {
    const [a, b] = await Promise.all([atualizarStatusEditaisSuap({ agora }), atualizarStatusEditaisSuap({ agora })]);
    expect(a).toBe(b);
    expect(prismaMock.edital.findMany).toHaveBeenCalledTimes(1);
  });

  it('falha de banco não derruba a página pública', async () => {
    prismaMock.edital.findMany.mockRejectedValue(new Error('banco fora'));
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(garantirStatusEditaisAtualizado()).resolves.toBeUndefined();
    erro.mockRestore();
  });

  it('home, lista e detalhe dos editais chamam a atualização antes de ler os editais', () => {
    const paginas: [string, string][] = [
      ['src/app/page.tsx', 'export default async function HomePage()'],
      ['src/app/editais/page.tsx', 'export default async function EditaisPage()'],
      ['src/app/editais/[slug]/page.tsx', 'export default async function EditalDetalhePage('],
    ];
    for (const [arquivo, assinatura] of paginas) {
      const fonte = readFileSync(join(process.cwd(), arquivo), 'utf8');
      const corpo = fonte.slice(fonte.indexOf(assinatura));
      const chamada = corpo.indexOf('await garantirStatusEditaisAtualizado()');
      expect(chamada, arquivo).toBeGreaterThan(-1);
      // e antes de qualquer leitura de edital no banco
      const leitura = corpo.search(/\b(prisma|db)\.edital\b|buscarEditalPublicoPorSlug\(|getDashboardStatsAction\(/);
      expect(chamada, arquivo).toBeLessThan(leitura);
    }
  });
});
