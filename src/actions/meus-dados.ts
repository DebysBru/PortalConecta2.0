'use server';

import { prisma } from '@/lib/prisma';

/**
 * Busca inscrições de um estudante por email
 */
export async function getMinhasInscricoes(email: string) {
  const inscricoes = await prisma.inscricao.findMany({
    where: { email },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      protocolo: true,
      nome_completo: true,
      email: true,
      telefone: true,
      curso: true,
      turma: true,
      semestre: true,
      tipo_interesse: true,
      status: true,
      created_at: true,
      projeto: {
        select: {
          id: true,
          nome: true,
          slug: true,
          area: true,
          coordenador: true,
          corPrimaria: true,
        },
      },
    },
  });

  return inscricoes;
}

/**
 * Exporta inscrições do estudante em CSV
 */
export async function exportMinhasInscricoesCSV(email: string): Promise<string> {
  const inscricoes = await prisma.inscricao.findMany({
    where: { email },
    orderBy: { created_at: 'desc' },
    select: {
      protocolo: true,
      projeto: { select: { nome: true } },
      tipo_interesse: true,
      status: true,
      created_at: true,
    },
  });

  const headers = ['Protocolo', 'Projeto', 'Tipo Interesse', 'Status', 'Data'];
  const rows = inscricoes.map((i) => [
    i.protocolo,
    i.projeto.nome,
    i.tipo_interesse,
    i.status,
    i.created_at.toLocaleDateString('pt-BR'),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
  return csv;
}

/**
 * Solicita exclusão de dados (LGPD)
 * Marca inscrições como "desistente" (não deleta por audit trail)
 */
export async function solicitarExclusaoDados(email: string, motivo?: string) {
  try {
    // Atualizar todas as inscrições do usuário para desistente
    const result = await prisma.inscricao.updateMany({
      where: { email },
      data: {
        status: 'desistente',
        observacao_interna: `Exclusão solicitada via "Meus dados" em ${new Date().toLocaleDateString('pt-BR')}${motivo ? `. Motivo: ${motivo}` : ''}`,
      },
    });

    // Registrar no audit log
    await prisma.auditLog.create({
      data: {
        acao: 'solicitacao_exclusao_dados',
        entidade: 'inscricao',
        detalhes: {
          email,
          inscricoes_afetadas: result.count,
          motivo: motivo || 'Não informado',
        },
      },
    });

    return { ok: true, count: result.count };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
