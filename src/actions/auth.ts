'use server';

import { db } from '@/lib/prisma';
import { assignUserRole, ensureUserProfile } from '@/lib/auth-helpers';
import { UserRole } from '@prisma/client';

/**
 * Server action para garantir que um usuário tem perfil no banco
 * Deve ser chamado após signup/login
 */
export async function syncUserProfileAction(userId: string, email: string, name?: string, photo?: string) {
  try {
    const user = await ensureUserProfile(userId, email, name, photo);
    return { success: true, user };
  } catch (error) {
    console.error('Erro ao sincronizar perfil do usuário:', error);
    throw error;
  }
}

/**
 * Retorna o perfil do usuário atual
 */
export async function getCurrentUserAction(userId: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        curso: true,
        matricula: true,
      },
    });
    return user;
  } catch (error) {
    console.error('Erro ao buscar perfil do usuário:', error);
    throw error;
  }
}

/**
 * Retorna estatísticas do dashboard admin
 * (também usadas na home pública)
 */
export async function getDashboardStatsAction() {
  try {
    const [editaisAtivos, projetos, usuarios, eventos] = await Promise.all([
      db.edital.count({
        where: {
          status: 'ABERTO',
          review_status: 'PUBLICADO',
          deleted_at: null,
        },
      }),
      db.projeto.count({
        where: {
          status: { in: ['ATIVO', 'EM_EXECUCAO', 'INSCRICOES_ABERTAS'] },
          review_status: 'PUBLICADO',
          deleted_at: null,
        },
      }),
      db.user.count(),
      db.evento.count({
        where: {
          data: { gte: new Date() }, // Eventos futuros
        },
      }),
    ]);

    return {
      editaisAtivos,
      projetos,
      usuarios,
      eventos,
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    throw error;
  }
}
