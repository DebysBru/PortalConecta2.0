import { db } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { getAdminAuth } from '@/lib/firebase-admin';

/**
 * Verifica o ID token do Firebase no servidor (via firebase-admin) e retorna
 * o e-mail/uid REAIS do dono da sessão — nunca um valor que o cliente afirma
 * ser seu.
 *
 * Antes desta função, várias actions de autoatendimento (`meus-dados.ts`,
 * `perfil.ts`) recebiam um `email`/`userId` como parâmetro comum e confiavam
 * nele — qualquer chamada direta à Server Action podia passar o e-mail de
 * outra pessoa e ler/exportar/excluir os dados dela (achados S3/S18/S20/S26
 * do RELATORIO_TESTES.md). Isso não é "só" checar um papel (como
 * `requireAdminEmail` faz em outros arquivos) — é provar posse da conta, o
 * que exige verificar a assinatura do token, não só olhar um campo de texto.
 */
export async function verifySessionToken(
  idToken?: string
): Promise<{ ok: true; uid: string; email: string } | { ok: false; error: string }> {
  if (!idToken) return { ok: false, error: 'Não autenticado' };
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (!decoded.email) return { ok: false, error: 'Sessão sem e-mail associado' };
    return { ok: true, uid: decoded.uid, email: decoded.email };
  } catch {
    return { ok: false, error: 'Sessão inválida ou expirada — faça login novamente' };
  }
}

/**
 * Determina o papel de um usuário baseado em seus dados
 * Regras (§4.2 SPEC):
 * - Email @ifpr.edu.br + professor no SUAP → PROFESSOR
 * - Email admin seed list → ADMIN
 * - Caso contrário → ESTUDANTE
 */
export async function assignUserRole(email: string, suapData?: { isCoordinator?: boolean }): Promise<UserRole> {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
  const allowedProfessorDomain = process.env.ALLOWED_PROFESSOR_DOMAIN || 'ifpr.edu.br';

  // Verificar se é admin (seed list)
  if (adminEmails.includes(email)) {
    return UserRole.ADMIN;
  }

  // Verificar se é professor (@ifpr.edu.br e coordena projeto no SUAP)
  const isDomainProfessor = email.endsWith(`@${allowedProfessorDomain}`);
  if (isDomainProfessor && suapData?.isCoordinator) {
    return UserRole.PROFESSOR;
  }

  // Padrão: estudante
  return UserRole.ESTUDANTE;
}

/**
 * Cria ou atualiza perfil do usuário após signup
 * Chamado por webhook ou server action no signup
 */
export async function ensureUserProfile(userId: string, email: string, name?: string, photo?: string) {
  const role = await assignUserRole(email);

  const user = await db.user.upsert({
    where: { id: userId },
    update: {
      email,
      name: name || undefined,
      image: photo || undefined,
      role,
    },
    create: {
      id: userId,
      email,
      name: name || undefined,
      image: photo || undefined,
      role,
    },
  });

  return user;
}

/**
 * Verifica se o usuário tem permissão para acessar um recurso
 * Implementa RLS simulada
 */
export async function requireRole(userId: string, requiredRole: UserRole | UserRole[]) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Usuário não encontrado');

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  if (!roles.includes(user.role)) {
    throw new Error('Acesso negado: permissão insuficiente');
  }

  return user;
}

/**
 * Verifica se o usuário coordena um projeto específico
 */
export async function requireProjectCoordinator(userId: string, projectId: string) {
  const coordinator = await db.projectCoordinator.findFirst({
    where: {
      projeto_id: projectId,
      user_id: userId,
    },
  });

  if (!coordinator) {
    throw new Error('Acesso negado: você não coordena este projeto');
  }

  return coordinator;
}

/**
 * Verifica se o usuário tem permissão explícita
 */
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const perm = await db.userPermission.findUnique({
    where: {
      user_id_permission: {
        user_id: userId,
        permission,
      },
    },
  });

  return !!perm;
}

/**
 * Garante acesso admin
 */
export async function requireAdmin(userId: string) {
  return requireRole(userId, UserRole.ADMIN);
}

/**
 * Garante acesso professor ou admin
 */
export async function requireProfessor(userId: string) {
  return requireRole(userId, [UserRole.PROFESSOR, UserRole.ADMIN]);
}
