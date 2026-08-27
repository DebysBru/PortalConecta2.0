import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { isAdministradorGeral } from '@/lib/permissions';

const TOKEN_FILE = join(process.cwd(), '.suap-token.json');

/**
 * Só o Administrador Geral pode ler/gravar/remover o token SUAP — antes esta
 * rota não tinha NENHUMA checagem, então qualquer requisição POST (mesmo sem
 * login) conseguia sobrescrever o token usado por toda a sincronização.
 */
function checkAdmin(email: string | null): boolean {
  return !!email && isAdministradorGeral(email);
}

// GET: Obter token atual
export async function GET(request: NextRequest) {
  const adminEmail = request.nextUrl.searchParams.get('adminEmail');
  if (!checkAdmin(adminEmail)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }
  try {
    const data = await readFile(TOKEN_FILE, 'utf-8');
    const { token, updatedAt } = JSON.parse(data);
    return NextResponse.json({ ok: true, token, updatedAt });
  } catch {
    return NextResponse.json({ ok: false, token: null });
  }
}

// POST: Salvar token
export async function POST(request: NextRequest) {
  try {
    const { token, adminEmail } = await request.json();

    if (!checkAdmin(adminEmail)) {
      return NextResponse.json({ error: 'Acesso negado: apenas o Administrador Geral' }, { status: 403 });
    }

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }

    if (!token.startsWith('eyJ')) {
      return NextResponse.json({ error: 'Token deve começar com "eyJ"' }, { status: 400 });
    }

    await writeFile(TOKEN_FILE, JSON.stringify({
      token,
      updatedAt: new Date().toISOString(),
    }, null, 2));

    return NextResponse.json({ ok: true, message: 'Token salvo com sucesso' });
  } catch (e) {
    console.error('Erro ao salvar token:', e);
    return NextResponse.json({ error: 'Erro ao salvar token' }, { status: 500 });
  }
}

// DELETE: Remover token
export async function DELETE(request: NextRequest) {
  const adminEmail = request.nextUrl.searchParams.get('adminEmail');
  if (!checkAdmin(adminEmail)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }
  try {
    const { unlink } = await import('fs/promises');
    await unlink(TOKEN_FILE);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
