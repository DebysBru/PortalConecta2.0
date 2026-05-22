/**
 * GET /api/suap/status
 * Retorna:
 *  - Status da conexão SUAP
 *  - Últimos logs de sincronização
 *  - Contagem de registros no banco
 */
import { NextRequest, NextResponse } from 'next/server';
import { testSuapConnection, fetchSuapEndpoints } from '@/lib/suap-api';
import { getLastSyncLogs } from '@/lib/suap-sync';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get('secret') === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const [conexao, logs, totalProjetos, totalEditais, projetosComSuapId, editaisComSuapId] =
    await Promise.allSettled([
      testSuapConnection(),
      getLastSyncLogs(20),
      prisma.projeto.count(),
      prisma.edital.count(),
      prisma.projeto.count({ where: { suapId: { not: null } } }),
      prisma.edital.count({ where: { suapId: { not: null } } }),
    ]);

  return NextResponse.json({
    suap: {
      configurado: !!(process.env.SUAP_CLIENT_ID && process.env.SUAP_CLIENT_SECRET),
      baseUrl: process.env.SUAP_BASE_URL ?? 'https://suap.ifpr.edu.br',
      campus: process.env.SUAP_CAMPUS ?? 'Ivaiporã',
      conexao: conexao.status === 'fulfilled' ? conexao.value : { ok: false, message: String(conexao.reason) },
    },
    banco: {
      totalProjetos: totalProjetos.status === 'fulfilled' ? totalProjetos.value : 0,
      totalEditais: totalEditais.status === 'fulfilled' ? totalEditais.value : 0,
      projetosDoSuap: projetosComSuapId.status === 'fulfilled' ? projetosComSuapId.value : 0,
      editaisDoSuap: editaisComSuapId.status === 'fulfilled' ? editaisComSuapId.value : 0,
    },
    logs: logs.status === 'fulfilled' ? logs.value : [],
  });
}

/** GET /api/suap/status?endpoints=1 — lista endpoints disponíveis no SUAP */
export async function HEAD(req: NextRequest) {
  return NextResponse.json({});
}
