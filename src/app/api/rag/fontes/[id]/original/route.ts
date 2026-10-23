import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lerOriginalRag } from '@/lib/rag-storage';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const doc = await prisma.documentoKb.findFirst({ where: { id: params.id, ativo: true } });
  const key = (doc?.metadata as Record<string, unknown> | undefined)?.originalKey;
  if (typeof key !== 'string') return new NextResponse(null, { status: 404 });
  try {
    const buffer = await lerOriginalRag(key);
    return new NextResponse(new Uint8Array(buffer), { headers: {
      'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="documento.${key.split('.').pop()}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch { return new NextResponse(null, { status: 404 }); }
}
