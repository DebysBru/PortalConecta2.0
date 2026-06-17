import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { gerarICS } from '@/lib/evento-helpers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo'); // filtro por tipo opcional

  const where: Record<string, unknown> = {};

  if (tipo && tipo !== 'todos') {
    where.tipo = tipo;
  }

  const eventos = await prisma.evento.findMany({
    where,
    orderBy: { data: 'asc' },
    select: {
      titulo: true,
      descricao: true,
      data: true,
      dataFim: true,
      local: true,
    },
  });

  const ics = gerarICS(eventos);

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="agenda-portal-conecta.ics"',
    },
  });
}
