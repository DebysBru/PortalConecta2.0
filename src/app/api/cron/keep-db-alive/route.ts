/**
 * GET /api/cron/keep-db-alive
 *
 * Disparado 1x/dia pelo Vercel Cron (ver vercel.json). Faz uma query leve
 * no Postgres para o Supabase não pausar o projeto por inatividade (planos
 * gratuitos pausam após 7 dias sem tráfego no banco).
 *
 * Protegido pelo header que a Vercel injeta automaticamente em cron jobs:
 * Authorization: Bearer <CRON_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Erro no keep-db-alive:', error);
    return NextResponse.json({ ok: false, error: 'Falha ao consultar o banco' }, { status: 500 });
  }
}
