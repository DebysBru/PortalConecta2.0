/**
 * Regras de acesso do painel administrativo — centralizadas aqui para não
 * duplicar (e divergir) a mesma checagem em admin.ts, professor.ts e nos
 * layouts de /admin e /professor.
 *
 * Modelo:
 *  - Administrador Geral: o e-mail mestre em ADMIN_EMAILS
 *    (ronan.lopes@ifpr.edu.br) e os usuários que ele promover (permissão
 *    `admin_geral` em UserPermission). Acesso total — todos os projetos,
 *    editais, posts, RAG, sync SUAP.
 *  - Professor: qualquer e-mail @ifpr.edu.br que seja coordenador, vice-coordenador,
 *    ou tenha sido explicitamente autorizado (admins/coordenadores) em pelo menos
 *    um projeto. Acesso restrito aos próprios projetos.
 *  - Gestor da página: aluno bolsista/voluntário selecionado, nomeado pelo
 *    coordenador (permissão `gestor_projeto:<id>`). Edita posts e a apresentação
 *    daquele projeto, sem acesso a vagas, inscrições ou dados institucionais.
 *  - Qualquer outro e-mail (fora do domínio institucional, ou @ifpr.edu.br sem
 *    nenhum projeto vinculado): sem acesso ao painel — só à própria área de
 *    usuário (/meus-dados).
 */
import { prisma } from '@/lib/prisma';
import { getVerifiedServerSession } from '@/lib/session';
import type { Prisma, UserRole } from '@prisma/client';

const ALLOWED_STAFF_DOMAIN = (process.env.ALLOWED_PROFESSOR_DOMAIN || 'ifpr.edu.br').toLowerCase();
const MASTER_ADMIN_EMAIL = process.env.ADMIN_EMAILS?.split(',')[0]?.trim().toLowerCase();

/**
 * Permissões que vivem em `UserPermission` (sem mudar o enum de papel):
 *  - `admin_geral`: o e-mail mestre pode promover outros usuários a
 *    Administrador Geral. O papel `ADMIN` sozinho não basta para promover
 *    ninguém — só o e-mail mestre (ADMIN_EMAILS) faz isso.
 *  - `gestor_projeto:<id>`: aluno bolsista/voluntário selecionado que pode
 *    editar os posts e a apresentação da página daquele projeto, sem acesso a
 *    vagas, inscrições, dados sensíveis ou exclusão.
 */
export const PERMISSAO_ADMIN_GERAL = 'admin_geral';
export const PERMISSAO_GESTOR_PREFIXO = 'gestor_projeto:';

export function permissaoDeGestor(projetoId: string): string {
  return `${PERMISSAO_GESTOR_PREFIXO}${projetoId}`;
}

export function projetoIdDaPermissaoDeGestor(permission: string): string | null {
  return permission.startsWith(PERMISSAO_GESTOR_PREFIXO)
    ? permission.slice(PERMISSAO_GESTOR_PREFIXO.length)
    : null;
}

/**
 * O e-mail informado é o MESMO da sessão verificada no servidor?
 *
 * POR QUE ISTO EXISTE: todas as funções deste arquivo recebem um `email` — e, nas
 * Server Actions do painel, esse e-mail vem do CLIENTE (`user.email` do contexto
 * de autenticação). Só conferir "esse e-mail é coordenador/admin no banco" NÃO é
 * autenticação: qualquer pessoa pode chamar a Server Action direto (o id da ação
 * está no bundle) passando `ronan.lopes@ifpr.edu.br` — que está na documentação
 * pública do projeto — e receber poderes de admin/coordenador. É a mesma classe
 * dos achados S1/S2/S3 do RELATORIO_TESTES.md.
 *
 * A identidade de verdade sai do **cookie de sessão httpOnly**, verificado com a
 * chave do Firebase (`getVerifiedServerSession`), que o cliente não consegue
 * forjar. O e-mail do parâmetro continua sendo usado para consultar o banco — mas
 * só depois de bater com o da sessão.
 */
async function emailConfereComSessao(email: string): Promise<boolean> {
  if (!email) return false;
  const sessao = await getVerifiedServerSession();
  if (!sessao?.email) return false;
  return sessao.email.toLowerCase() === email.toLowerCase();
}

export function isDominioInstitucional(email: string): boolean {
  return email.toLowerCase().endsWith(`@${ALLOWED_STAFF_DOMAIN}`);
}

export function isAdministradorGeral(email: string): boolean {
  return !!MASTER_ADMIN_EMAIL && email.toLowerCase() === MASTER_ADMIN_EMAIL;
}

/** Nome explícito para quem pode promover outros administradores. */
export function isMasterAdminEmail(email: string): boolean {
  return isAdministradorGeral(email);
}

/**
 * O usuário tem o papel ADMIN **por ter sido promovido** pelo e-mail mestre?
 *
 * Diferente de `isAdministradorGeral`, esta é uma checagem de banco e só deve
 * ser usada onde a promoção concedida importa (resolver o papel, por exemplo).
 */
export async function temPermissaoAdminGeral(email: string): Promise<boolean> {
  if (!email) return false;
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      permissions: {
        where: { permission: PERMISSAO_ADMIN_GERAL },
        select: { id: true },
        take: 1,
      },
    },
  });
  return !!user?.permissions.length;
}

/** Administrador Geral = e-mail mestre OU usuário promovido pelo mestre. */
export async function ehAdministradorGeral(email: string): Promise<boolean> {
  return isAdministradorGeral(email) || (await temPermissaoAdminGeral(email));
}

/**
 * O e-mail é gestor da página daquele projeto?
 *
 * A identidade NÃO é conferida aqui de propósito: quem chama é uma action que
 * já validou a sessão (ou `temAcessoAoProjeto(..., { incluirGestor: true })`).
 */
export async function ehGestorDoProjeto(projetoId: string, email: string): Promise<boolean> {
  if (!projetoId || !email) return false;
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      permissions: {
        where: { permission: permissaoDeGestor(projetoId) },
        select: { id: true },
        take: 1,
      },
    },
  });
  return !!user?.permissions.length;
}

/** Algum projeto em que o usuário é gestor de página (para liberar o painel limitado). */
export async function usuarioTemAlgumProjetoComoGestor(email: string): Promise<boolean> {
  if (!email) return false;
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      permissions: {
        where: { permission: { startsWith: PERMISSAO_GESTOR_PREFIXO } },
        select: { id: true },
        take: 1,
      },
    },
  });
  return !!user?.permissions.length;
}

/** IDs dos projetos em que o usuário é gestor de página. */
export async function projetosComoGestor(email: string): Promise<string[]> {
  if (!email) return [];
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      permissions: {
        where: { permission: { startsWith: PERMISSAO_GESTOR_PREFIXO } },
        select: { permission: true },
      },
    },
  });
  return (user?.permissions ?? [])
    .map((p) => projetoIdDaPermissaoDeGestor(p.permission))
    .filter((id): id is string => !!id);
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
 *
 * ⚠️ O `email` precisa ser o da sessão verificada: quem chama isto são as Server
 * Actions do painel, onde o e-mail chega do cliente. Sem a conferência, bastava
 * mandar o e-mail de um coordenador para editar o projeto dele.
 */
export async function temAcessoAoProjeto(
  projetoId: string,
  email: string,
  opcoes?: { incluirGestor?: boolean },
): Promise<boolean> {
  if (!(await emailConfereComSessao(email))) return false;
  if (isAdministradorGeral(email)) return true;

  // Administrador promovido pelo e-mail mestre também enxerga todos os projetos.
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (user?.role === 'ADMIN') return true;

  if (await isCoordenadorOuViceDoProjeto(projetoId, email)) return true;

  // Gestor da página: só entra quando o chamador pede explicitamente (posts e
  // apresentação). NÃO vale para vagas, inscrições ou dados sensíveis.
  if (opcoes?.incluirGestor) return ehGestorDoProjeto(projetoId, email);

  return false;
}

/**
 * Lista os projetos visíveis para o e-mail: todos para o Administrador Geral, só os próprios para os demais.
 * Mesma exigência de sessão de `temAcessoAoProjeto`.
 */
export async function projetosAcessiveis(email: string) {
  if (!(await emailConfereComSessao(email))) return [];

  if (isAdministradorGeral(email)) {
    return prisma.projeto.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { inscricoes: true } } },
    });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (user?.role === 'ADMIN') {
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

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      role: true,
      permissions: {
        where: { permission: PERMISSAO_ADMIN_GERAL },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!user) return null;

  // Promovido pelo e-mail mestre: continua ADMIN mesmo sem projeto/domínio.
  if ((user.permissions ?? []).length > 0) {
    if (user.role !== 'ADMIN') {
      await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    }
    return 'ADMIN';
  }

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
