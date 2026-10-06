import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { gerarICS } from '@/lib/evento-helpers';
import { getVerifiedServerSession } from '@/lib/session';
import { idsAcompanhados } from '@/actions/agenda';

/**
 * Exportação da agenda em .ics (Google Agenda, Apple Calendário, Outlook...).
 *
 * Aceita os mesmos filtros da tela, para o arquivo sair igual ao que a pessoa
 * está vendo:
 *
 *   ?tipo=PRAZO_EDITAL      tipo do evento
 *   ?categoria=Feriado...   categoria do calendário importado
 *   ?publico=Alunos         público-alvo
 *   ?interesse=alunos       só o que interessa a alunos (ou a professores)
 *   ?periodo=proximos|mes|ano
 *   ?seguindo=1             só o que o estudante logado acompanha (ou tudo, se
 *                           ele marcou "acompanhar o calendário inteiro")
 *
 * Sem login, `seguindo=1` é ignorado (não há seleção para respeitar) e o arquivo
 * sai com todos os eventos do filtro.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo');
  const categoria = searchParams.get('categoria');
  const publico = searchParams.get('publico');
  const interesse = searchParams.get('interesse');
  const periodo = searchParams.get('periodo');
  const seguindo = searchParams.get('seguindo') === '1';

  const where: Record<string, unknown> = {};

  if (tipo && tipo !== 'todos') where.tipo = tipo;
  if (categoria && categoria !== 'todas') where.categoria = categoria;
  if (publico && publico !== 'todos') where.publicoAlvo = publico;
  if (interesse === 'alunos') where.interessaAlunos = { not: false };
  if (interesse === 'professores') where.interessaProfessores = { not: false };

  if (periodo === 'mes' || periodo === 'ano') {
    const agora = new Date();
    const inicio = new Date(Date.UTC(agora.getUTCFullYear(), periodo === 'mes' ? agora.getUTCMonth() : 0, 1, 3));
    const fim = new Date(Date.UTC(agora.getUTCFullYear(), periodo === 'mes' ? agora.getUTCMonth() + 1 : 12, 1, 3));
    where.data = { gte: inicio, lt: fim };
  }

  if (seguindo) {
    const sessao = await getVerifiedServerSession();
    if (sessao) {
      const usuario = await prisma.user.findUnique({ where: { email: sessao.email }, select: { id: true } });
      if (usuario) {
        const ids = await idsAcompanhados(usuario.id);
        // ids === null significa "acompanho o calendário inteiro"
        if (ids !== null) {
          if (ids.length === 0) {
            // Nada marcado: devolve um calendário vazio em vez da agenda inteira
            // (o estudante pediu explicitamente só o que acompanha).
            return new NextResponse(gerarICS([]), {
              headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'attachment; filename="agenda-portal-conecta.ics"',
              },
            });
          }
          where.id = { in: ids };
        }
      }
    }
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
