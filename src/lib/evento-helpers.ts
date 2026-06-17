import { prisma } from '@/lib/prisma';

/**
 * Converte data (apenas dia) para datetime no horário de São Paulo
 * Para prazos: 23:59:59 BRT
 * Para início: 08:00:00 BRT
 */
function paraHorarioSP(data: Date, tipo: 'prazo' | 'inicio'): Date {
  const ano = data.getFullYear();
  const mes = data.getMonth();
  const dia = data.getDate();

  // São Paulo: UTC-3 (horário de verao UTC-3 o ano todo para simplificar)
  if (tipo === 'prazo') {
    // 23:59:59 BRT = 02:59:59 UTC (dia seguinte)
    return new Date(Date.UTC(ano, mes, dia + 1, 2, 59, 59));
  } else {
    // 08:00:00 BRT = 11:00:00 UTC
    return new Date(Date.UTC(ano, mes, dia, 11, 0, 0));
  }
}

/**
 * Deriva eventos automaticamente a partir de um edital
 * Cria: prazo inscrição, resultado parcial, prazo recurso, resultado final
 */
export async function derivarEventosEdital(editalId: string) {
  const edital = await prisma.edital.findUnique({
    where: { id: editalId },
    select: {
      id: true,
      titulo: true,
      slug: true,
      inscricao_inicio: true,
      inscricao_fim: true,
      dataResultadoParcial: true,
      prazoRecurso: true,
      dataResultadoFinal: true,
      authorId: true,
    },
  });

  if (!edital) return;

  // Remover eventos derivados anteriores deste edital
  await prisma.evento.deleteMany({
    where: { editalSlug: edital.slug },
  });

  const eventosParaCriar: Array<{
    titulo: string;
    descricao: string;
    data: Date;
    tipo: 'PRAZO_EDITAL' | 'INSCRICAO' | 'RESULTADO' | 'RECURSO';
    local?: string;
    editalSlug: string;
    authorId: string;
  }> = [];

  // Início das inscrições (08:00)
  if (edital.inscricao_inicio) {
    eventosParaCriar.push({
      titulo: `Início das inscrições — ${edital.titulo}`,
      descricao: `Abertura das inscrições para o edital "${edital.titulo}".`,
      data: paraHorarioSP(edital.inscricao_inicio, 'inicio'),
      tipo: 'INSCRICAO',
      editalSlug: edital.slug,
      authorId: edital.authorId,
    });
  }

  // Fim das inscrições (23:59)
  if (edital.inscricao_fim) {
    eventosParaCriar.push({
      titulo: `Prazo Final — ${edital.titulo}`,
      descricao: `Último dia para inscrição no edital "${edital.titulo}".`,
      data: paraHorarioSP(edital.inscricao_fim, 'prazo'),
      tipo: 'PRAZO_EDITAL',
      editalSlug: edital.slug,
      authorId: edital.authorId,
    });
  }

  // Resultado parcial (18:00)
  if (edital.dataResultadoParcial) {
    eventosParaCriar.push({
      titulo: `Resultado Parcial — ${edital.titulo}`,
      descricao: `Divulgação do resultado parcial do edital "${edital.titulo}".`,
      data: paraHorarioSP(edital.dataResultadoParcial, 'inicio'),
      tipo: 'RESULTADO',
      editalSlug: edital.slug,
      authorId: edital.authorId,
    });
  }

  // Prazo recurso (23:59)
  if (edital.prazoRecurso) {
    eventosParaCriar.push({
      titulo: `Prazo para Recurso — ${edital.titulo}`,
      descricao: `Último dia para interposição de recurso no edital "${edital.titulo}".`,
      data: paraHorarioSP(edital.prazoRecurso, 'prazo'),
      tipo: 'RECURSO',
      editalSlug: edital.slug,
      authorId: edital.authorId,
    });
  }

  // Resultado final (18:00)
  if (edital.dataResultadoFinal) {
    eventosParaCriar.push({
      titulo: `Resultado Final — ${edital.titulo}`,
      descricao: `Divulgação do resultado final do edital "${edital.titulo}".`,
      data: paraHorarioSP(edital.dataResultadoFinal, 'inicio'),
      tipo: 'RESULTADO',
      editalSlug: edital.slug,
      authorId: edital.authorId,
    });
  }

  if (eventosParaCriar.length > 0) {
    await prisma.evento.createMany({ data: eventosParaCriar });
  }

  return eventosParaCriar.length;
}

/**
 * Deriva eventos automaticamente a partir de um projeto
 * Cria: inscrição (se aberta)
 */
export async function derivarEventosProjeto(projetoId: string) {
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    select: {
      id: true,
      nome: true,
      slug: true,
      inscricoes_abertas: true,
      inscricao_inicio: true,
      inscricao_fim: true,
      coordenadorEmail: true,
    },
  });

  if (!projeto) return;

  // Usar o primeiro admin do projeto como author
  const admin = await prisma.user.findFirst({
    where: {
      OR: [
        ...(projeto.coordenadorEmail ? [{ email: projeto.coordenadorEmail }] : []),
        { projetosAdmin: { some: { id: projetoId } } },
      ],
    },
    select: { id: true },
  });

  if (!admin) return;

  // Remover eventos derivados anteriores deste projeto
  await prisma.evento.deleteMany({
    where: { editalSlug: projeto.slug },
  });

  if (!projeto.inscricoes_abertas) return 0;

  const eventosParaCriar: Array<{
    titulo: string;
    descricao: string;
    data: Date;
    tipo: 'PRAZO_EDITAL' | 'INSCRICAO';
    editalSlug: string;
    authorId: string;
  }> = [];

  // Início inscrições (08:00)
  if (projeto.inscricao_inicio) {
    eventosParaCriar.push({
      titulo: `Início inscrições — ${projeto.nome}`,
      descricao: `Abertura das inscrições para o projeto "${projeto.nome}".`,
      data: paraHorarioSP(projeto.inscricao_inicio, 'inicio'),
      tipo: 'INSCRICAO',
      editalSlug: projeto.slug,
      authorId: admin.id,
    });
  }

  // Fim inscrições (23:59)
  if (projeto.inscricao_fim) {
    eventosParaCriar.push({
      titulo: `Prazo Final — ${projeto.nome}`,
      descricao: `Último dia para inscrição no projeto "${projeto.nome}".`,
      data: paraHorarioSP(projeto.inscricao_fim, 'prazo'),
      tipo: 'PRAZO_EDITAL',
      editalSlug: projeto.slug,
      authorId: admin.id,
    });
  }

  if (eventosParaCriar.length > 0) {
    await prisma.evento.createMany({ data: eventosParaCriar });
  }

  return eventosParaCriar.length;
}

/**
 * Gera arquivo .ics (iCalendar) para download
 */
export function gerarICS(eventos: Array<{
  titulo: string;
  descricao: string | null;
  data: Date;
  dataFim?: Date | null;
  local?: string | null;
}>): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Portal Conecta IFPR//Events//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Agenda Portal Conecta IFPR',
    'X-WR-TIMEZONE:America/Sao_Paulo',
  ];

  for (const evento of eventos) {
    const dtStart = formatICSDate(evento.data);
    const dtEnd = evento.dataFim
      ? formatICSDate(evento.dataFim)
      : formatICSDate(new Date(evento.data.getTime() + 60 * 60 * 1000)); // +1h padrão

    lines.push('BEGIN:VEVENT');
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeICS(evento.titulo)}`);
    if (evento.descricao) lines.push(`DESCRIPTION:${escapeICS(evento.descricao)}`);
    if (evento.local) lines.push(`LOCATION:${escapeICS(evento.local)}`);
    lines.push(`UID:${evento.titulo}-${evento.data.getTime()}@portal-conecta-ifpr`);
    lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
