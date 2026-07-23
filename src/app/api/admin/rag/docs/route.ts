import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Buscar documento com chunks
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  }

  const doc = await prisma.ragDocumento.findUnique({
    where: { id },
    include: {
      chunks: {
        orderBy: { chunk_index: 'asc' },
      },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: doc });
}

// PUT: Atualizar documento (resumo, tags, conteúdo)
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, titulo, resumo, tags, links, conteudo, ativo } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  }

  const doc = await prisma.ragDocumento.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
  }

  const updated = await prisma.ragDocumento.update({
    where: { id },
    data: {
      ...(titulo !== undefined && { titulo }),
      ...(resumo !== undefined && { resumo }),
      ...(tags !== undefined && { tags }),
      ...(links !== undefined && { links }),
      ...(ativo !== undefined && { ativo }),
      ...(conteudo !== undefined && { conteudo }),
    },
  });

  return NextResponse.json({ ok: true, data: updated });
}

// DELETE: Excluir documento e chunks
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  }

  const doc = await prisma.ragDocumento.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
  }

  // Chunks são deletados em cascade
  await prisma.ragDocumento.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
