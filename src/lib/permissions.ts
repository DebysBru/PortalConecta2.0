/**
 * Regras de acesso do painel administrativo — centralizadas aqui para não
 * duplicar (e divergir) a mesma checagem em admin.ts, professor.ts e nos
 * layouts de /admin e /professor.
 *
 * Modelo:
 *  - Administrador Geral: único e-mail em ADMIN_EMAILS (ronan.lopes@ifpr.edu.br).
 *    Acesso total — todos os projetos, editais, posts, RAG, sync SUAP.
 *  - Professor: qualquer e-mail @ifpr.edu.br que seja coordenador, vice-coordenador,
 *    ou tenha sido explicitamente autorizado (admins/coordenadores) em pelo menos
 *    um projeto. Acesso restrito aos próprios projetos.
 *  - Qualquer outro e-mail (fora do domínio institucional, ou @ifpr.edu.br sem
 *    nenhum projeto vinculado): sem acesso ao painel — só à própria área de
 *    usuário (/meus-dados).
 */
import { prisma } from '@/lib/prisma';
import type { Prisma, UserRole } from '@prisma/client';

const ALLOWED_STAFF_DOMAIN = (process.env.ALLOWED_PROFESSOR_DOMAIN || 'ifpr.edu.br').toLowerCase();
const MASTER_ADMIN_EMAIL = process.env.ADMIN_EMAILS?.split(',')[0]?.trim().toLowerCase();

export function isDominioInstitucional(email: string): boolean {
  return email.toLowerCase().endsWith(`@${ALLOWED_STAFF_DOMAIN}`);
}

export function isAdministradorGeral(email: string): boolean {
  return !!MASTER_ADMIN_EMAIL && email.toLowerCase() === MASTER_ADMIN_EMAIL;
}

/** Fragmento de `where` do Prisma: projetos onde o e-mail é coordenador, vice-coordenador,
 *  admin explícito (ProjectAdmins) ou coordenador cadastrado (ProjectCoordinator). */
export function whereUsuarioTemAcessoAoProjeto(email: string): Prisma.ProjetoWhereInput {
  return {
    OR: [
      { coordenadorEmail: email },
      { viceCoordenadorEmail: email },
      { admins: { some: { email } } },
      { coordenadores: { some: { user: { email } } } },
    ],
  };
}

export async function usuarioTemAlgumProjeto(email: string): Promise<boolean> {
  const count = await prisma.projeto.count({ where: whereUsuarioTemAcessoAoProjeto(email) });
  return count > 0;
}

type ProjetoAcessoFields = {
  coordenadorEmail: string | null;
  viceCoordenadorEmail?: string | null;
  admins: { email: string }[];
  coordenadores: { user: { email: string } }[];
};

/** Mesma regra de `whereUsuarioTemAcessoAoProjeto`, aplicada a um projeto já carregado em memória. */
export function projetoTemAcesso(projeto: ProjetoAcessoFields, email: string): boolean {
  return (
    projeto.coordenadorEmail === email ||
    projeto.viceCoordenadorEmail === email ||
    projeto.admins.some((a) => a.email === email) ||
    projeto.coordenadores.some((c) => c.user.email === email)
  );
}

/** Busca o projeto e verifica coordenador/vice/admin — usar quando não há dados já carregados. */
export async function isCoordenadorOuViceDoProjeto(projetoId: string, email: string): Promise<boolean> {
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    select: {
      coordenadorEmail: true,
      viceCoordenadorEmail: true,
      admins: { select: { email: true } },
      coordenadores: { select: { user: { select: { email: true } } } },
    },
  });
  if (!projeto) return false;
  return projetoTemAcesso(projeto, email);
}

/**
 * Checagem de acesso a um projeto que o Administrador Geral sempre passa
 * (vê e edita tudo), e um Professor só passa se for coordenador/vice/admin
 * daquele projeto específico.
 */
export async function temAcessoAoProjeto(projetoId: string, email: string): Promise<boolean> {
  if (isAdministradorGeral(email)) return true;
  return isCoordenadorOuViceDoProjeto(projetoId, email);
}

/** Lista os projetos visíveis para o e-mail: todos para o Administrador Geral, só os próprios para os demais. */
export async function projetosAcessiveis(email: string) {
  if (isAdministradorGeral(email)) {
    return prisma.projeto.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { inscricoes: true } } },
    });
  }
  return prisma.projeto.findMany({
    where: whereUsuarioTemAcessoAoProjeto(email),
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { inscricoes: true } } },
  });
}

/**
 * Papel efetivo do e-mail, recalculado ao vivo (nunca só o campo `role`
 * salvo) e persistido de volta no banco (self-healing):
 *  - Administrador Geral → sempre ADMIN.
 *  - Fora do domínio institucional → sempre ESTUDANTE, mesmo que o banco
 *    tenha um valor antigo (ex.: dado legado).
 *  - Domínio institucional → PROFESSOR só enquanto coordenar/vice-coordenar
 *    (ou tiver sido explicitamente autorizado em) algum projeto; caso
 *    contrário ESTUDANTE.
 *
 * Retorna `null` só quando o usuário nunca existiu no banco (nunca logou).
 */
export async function resolveUserRole(email: string): Promise<UserRole | null> {
  if (isAdministradorGeral(email)) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'ADMIN' },
      create: { email, name: 'Administrador Geral', role: 'ADMIN' },
    });
    return 'ADMIN';
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (!user) return null;

  if (!isDominioInstitucional(email)) {
    if (user.role !== 'ESTUDANTE') {
      await prisma.user.update({ where: { email }, data: { role: 'ESTUDANTE' } });
    }
    return 'ESTUDANTE';
  }

  const temProjeto = await usuarioTemAlgumProjeto(email);
  const roleCorreta: UserRole = temProjeto ? 'PROFESSOR' : 'ESTUDANTE';
  if (user.role !== roleCorreta) {
    await prisma.user.update({ where: { email }, data: { role: roleCorreta } });
  }
  return roleCorreta;
}
