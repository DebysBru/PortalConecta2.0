import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Não identificamos qual projeto você quer abrir. Volte à lista de projetos e escolha um.' }, { status: 400 });
  }

  const projeto = await prisma.projeto.findUnique({
    where: { slug },
    select: {
      id: true,
      nome: true,
      status: true,
      inscricao_inicio: true,
      inscricao_fim: true,
      vagasBolsista: true,
      vagasVoluntario: true,
      formulario_extra: true,
      vagas: {
        where: { status: 'ABERTA' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          titulo: true,
          tipo: true,
          descricao: true,
          quantidade: true,
          valorBolsa: true,
          cargaHorariaSemanal: true,
        },
      },
    },
  });

  if (!projeto) {
    return NextResponse.json(
      { error: 'Não encontramos este projeto. Ele pode ter sido removido ou o link está incompleto.' },
      { status: 404 }
    );
  }

  const inscricoesAbertas = projeto.status === 'INSCRICOES_ABERTAS';

  return NextResponse.json({ projeto: { ...projeto, inscricoes_abertas: inscricoesAbertas } });
}
