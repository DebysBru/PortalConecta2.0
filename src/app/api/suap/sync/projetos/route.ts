/**
 * POST /api/suap/sync/projetos
 * Sincroniza projetos de extensão do SUAP com o banco local.
 *
 * Protegido por cabeçalho: Authorization: Bearer <SYNC_SECRET>
 *
 * Body JSON (opcional):
 *   { "dryRun": true }  — apenas testa sem salvar
 */
import { NextRequest, NextResponse } from 'next/server';
import { syncProjetos } from '@/lib/suap-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s timeout (Vercel Pro / hobby limit)

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader === `Bearer ${secret}`) return true;

  // Também aceita via query param (para uso no painel admin)
  const url = new URL(req.url);
  if (url.searchParams.get('secret') === secret) return true;

  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let dryRun = false;
  try {
    const body = await req.json().catch(() => ({}));
    dryRun = body.dryRun === true;
  } catch {
    // ignora body inválido
  }

  const startedAt = Date.now();

  try {
    const result = await syncProjetos({ dryRun });

    return NextResponse.json({
      ok: true,
      dryRun,
      duracao: `${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

// GET — permite teste rápido via browser com secret na URL
export async function GET(req: NextRequest) {
  return POST(req);
}
