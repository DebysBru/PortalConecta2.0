import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

const TOKEN_FILE = join(process.cwd(), '.suap-token.json');

// GET: Obter token atual
export async function GET() {
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
    const { token } = await request.json();

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
export async function DELETE() {
  try {
    const { unlink } = await import('fs/promises');
    await unlink(TOKEN_FILE);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
