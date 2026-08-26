import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function isAdmin(email: string | null): Promise<boolean> {
  if (!email) return false;
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  return user?.role === 'ADMIN';
}

// GET: Buscar documento com chunks
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const adminEmail = request.nextUrl.searchParams.get('adminEmail');

  if (!(await isAdmin(adminEmail))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }
  if (!id) {
    return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  }

  const doc = await prisma.documentoKb.findUnique({
    where: { id },
    include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
  });

  if (!doc) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: doc });
}

// PUT: Atualizar documento (título, ativo)
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, titulo, ativo, adminEmail } = body;

  if (!(await isAdmin(adminEmail))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }
  if (!id) {
    return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  }

  const doc = await prisma.documentoKb.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
  }

  const updated = await prisma.documentoKb.update({
    where: { id },
    data: {
      ...(titulo !== undefined && { titulo }),
      ...(ativo !== undefined && { ativo }),
    },
  });

  if (ativo !== undefined) {
    await prisma.chunkKb.updateMany({ where: { documentoId: id }, data: { ativo } });
  }

  return NextResponse.json({ ok: true, data: updated });
}

// DELETE: Excluir documento e chunks
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const adminEmail = request.nextUrl.searchParams.get('adminEmail');

  if (!(await isAdmin(adminEmail))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }
  if (!id) {
    return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  }

  const doc = await prisma.documentoKb.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
  }

  // Chunks são deletados em cascade
  await prisma.documentoKb.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
