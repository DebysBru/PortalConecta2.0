'use server';

import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export type MyProjetoFormData = {
  nome: string;
  coordenador: string;
  area: string;
  descricao?: string;
  status: string;
  corPrimaria: string;
  email?: string;
  instagram?: string;
  site?: string;
};

export async function getProfessorStats(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { totalProjetos: 0, projetosAtivos: 0, totalInscritos: 0, inscricoesPendentes: 0 };

  const projetos = await prisma.projeto.findMany({
    where: {
      OR: [
        { coordenadorEmail: email },
        { admins: { some: { email } } },
        { coordenadores: { some: { user_id: user.id } } },
      ],
    },
    select: { id: true },
  });

  const projetoIds = projetos.map((p) => p.id);

  const [projetosAtivos, totalInscritos, inscricoesPendentes] = await Promise.all([
    prisma.projeto.count({
      where: {
        id: { in: projetoIds },
        status: { in: ['ATIVO', 'EM_EXECUCAO', 'INSCRICOES_ABERTAS'] },
      },
    }),
    prisma.inscricao.count({
      where: { projeto_id: { in: projetoIds } },
    }),
    prisma.inscricao.count({
      where: {
        projeto_id: { in: projetoIds },
        status: 'recebida',
      },
    }),
  ]);

  return {
    totalProjetos: projetos.length,
    projetosAtivos,
    totalInscritos,
    inscricoesPendentes,
  };
}

export async function listMyProjetos(email: string) {
  return prisma.projeto.findMany({
    where: {
      OR: [
        { coordenadorEmail: email },
        { admins: { some: { email } } },
        { coordenadores: { some: { user: { email } } } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { inscricoes: true } },
    },
  });
}

export async function getProjetoDetalhes(projetoId: string, userEmail: string) {
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    include: {
      coordenadores: { include: { user: { select: { id: true, name: true, email: true } } } },
      admins: { select: { id: true, name: true, email: true } },
      faq: { orderBy: { ordem: 'asc' } },
      tags: true,
      cursos: true,
      _count: { select: { inscricoes: true } },
    },
  });

  if (!projeto) return null;

  const isCoordinator =
    projeto.coordenadorEmail === userEmail ||
    projeto.admins.some((a) => a.email === userEmail) ||
    projeto.coordenadores.some((c) => c.user.email === userEmail);

  if (!isCoordinator) return null;

  return projeto;
}

export async function listInscricoes(projetoId: string, userEmail: string) {
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    include: {
      admins: { select: { email: true } },
      coordenadores: { include: { user: { select: { email: true } } } },
    },
  });

  if (!projeto) return { ok: false, error: 'Projeto não encontrado' } as const;

  const isCoordinator =
    projeto.coordenadorEmail === userEmail ||
    projeto.admins.some((a) => a.email === userEmail) ||
    projeto.coordenadores.some((c) => c.user.email === userEmail);

  if (!isCoordinator) return { ok: false, error: 'Acesso negado' } as const;

  const inscricoes = await prisma.inscricao.findMany({
    where: { projeto_id: projetoId },
    orderBy: { created_at: 'desc' },
  });

  return { ok: true, data: inscricoes } as const;
}

/**
 * Atualiza um projeto (apenas o coordenador/admin pode)
 */
export async function updateMyProjeto(projetoId: string, data: MyProjetoFormData): Promise<ActionResult> {
  try {
    const projeto = await prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { id: true },
    });

    if (!projeto) {
      return { ok: false, error: 'Projeto não encontrado' };
    }

    await prisma.projeto.update({
      where: { id: projetoId },
      data: {
        nome: data.nome,
        slug: slugify(data.nome),
        coordenador: data.coordenador,
        area: data.area,
        descricao: data.descricao || null,
        status: data.status as any,
        corPrimaria: data.corPrimaria,
        email: data.email || null,
        instagram: data.instagram || null,
        site: data.site || null,
      },
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function updateInscricaoStatus(
  inscricaoId: string,
  status: string,
  observacao?: string
): Promise<ActionResult> {
  try {
    await prisma.inscricao.update({
      where: { id: inscricaoId },
      data: {
        status,
        ...(observacao !== undefined ? { observacao_interna: observacao } : {}),
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function exportInscricoesCSV(projetoId: string): Promise<string> {
  const inscricoes = await prisma.inscricao.findMany({
    where: { projeto_id: projetoId },
    orderBy: { created_at: 'asc' },
  });

  const headers = ['Protocolo', 'Nome', 'Email', 'Telefone', 'Curso', 'Turma', 'Semestre', 'Tipo Interesse', 'Status', 'Data'];
  const rows = inscricoes.map((i) => [
    i.protocolo,
    i.nome_completo,
    i.email,
    i.telefone ?? '',
    i.curso ?? '',
    i.turma ?? '',
    i.semestre ?? '',
    i.tipo_interesse,
    i.status,
    i.created_at.toLocaleDateString('pt-BR'),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
  return csv;
}
