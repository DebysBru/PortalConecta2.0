/**
 * GET /api/suap/endpoints
 * Lista todos os endpoints disponíveis na API do SUAP
 * Útil para descobrir quais recursos estão acessíveis com as credenciais atuais
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchSuapEndpoints, suapGet } from '@/lib/suap-api';

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

  const url = new URL(req.url);
  const path = url.searchParams.get('path'); // Explorar endpoint específico

  try {
    if (path) {
      // Explorar um endpoint específico
      const data = await suapGet(path);
      return NextResponse.json({ path, data });
    }

    // Listar todos os endpoints raiz
    const endpoints = await fetchSuapEndpoints();
    return NextResponse.json({
      endpoints,
      dica: 'Use ?path=/api/v2/extensao/projetos/ para explorar um endpoint específico',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
