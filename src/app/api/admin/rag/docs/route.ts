import { alterarVisibilidadeRag } from '@/lib/rag-publicacao';
import { cache } from '@/lib/cache';
import { removerOriginalRag } from '@/lib/rag-storage';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAdmin } from '@/lib/admin-auth';

/**
 * Gestão de documentos do RAG (consulta, edição e exclusão).
 *
 * Autorização por ID token do Firebase no header `Authorization: Bearer <token>`
 * (ver src/lib/admin-auth.ts). Antes, o e-mail do admin vinha por query string ou
 * corpo JSON — bastava conhecer o e-mail administrativo para se passar por admin.
 */

export async function GET(request: NextRequest) {
  const auth = await exigirAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Informe qual documento você quer consultar.' }, { status: 400 });
  }

  const doc = await prisma.documentoKb.findUnique({
    where: { id },
    include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
  });

  if (!doc) {
    return NextResponse.json({ error: 'Não encontramos este documento. Ele pode ter sido removido.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: doc });
}

export async function PUT(request: NextRequest) {
  const auth = await exigirAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { id?: string; titulo?: string; ativo?: boolean; substituirId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Não conseguimos entender os dados enviados. Recarregue a página e tente novamente.' }, { status: 400 });
  }

  const { id, titulo, ativo } = body;
  if (typeof id !== 'string' || !id || (titulo !== undefined && (typeof titulo !== 'string' || !titulo.trim() || titulo.length > 500)) || (ativo !== undefined && typeof ativo !== 'boolean')) {
    return NextResponse.json({ error: 'Informe qual documento você quer alterar.' }, { status: 400 });
  }

  const doc = await prisma.documentoKb.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: 'Não encontramos este documento. Ele pode ter sido removido.' }, { status: 404 });
  }

  const updated = await prisma.documentoKb.update({
    where: { id },
    data: {
      ...(titulo !== undefined && { titulo }),

    },
  });

  if (ativo !== undefined) {
    try { await alterarVisibilidadeRag(id, ativo, typeof body.substituirId === 'string' ? body.substituirId : undefined); } catch { return NextResponse.json({ error: 'Não foi possível ativar esta versão. Confira a versão atual e a indexação.' }, { status: 409 }); }
  }

  cache.invalidate('chat:');
  return NextResponse.json({ ok: true, data: { ...updated, ativo: ativo ?? updated.ativo } });
}

export async function DELETE(request: NextRequest) {
  const auth = await exigirAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Informe qual documento você quer excluir.' }, { status: 400 });
  }

  const doc = await prisma.documentoKb.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: 'Não encontramos este documento. Ele pode ter sido removido.' }, { status: 404 });
  }

  // Chunks são deletados em cascade
  await prisma.documentoKb.delete({ where: { id } });
  const key = (doc.metadata as Record<string, unknown>).originalKey;
  if (typeof key === 'string') await removerOriginalRag(key);
  cache.invalidate('chat:');

  return NextResponse.json({ ok: true });
}
