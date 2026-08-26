'use server';

import { db } from '@/lib/prisma';

// `syncUserProfileAction`/`getCurrentUserAction` removidas em 2026-08-26:
// eram Server Actions sem checagem de autorização nenhuma (achados S18/S26
// do RELATORIO_TESTES.md — aceitavam `userId`/`email` como parâmetro comum,
// sem provar posse da conta), e não tinham nenhum caller — o fluxo real de
// login já usa `ensureUser`/`getUserRole` (src/actions/admin.ts) via
// AuthContext. Autoatendimento real (perfil, exclusão de conta) agora vive
// em src/actions/perfil.ts e src/actions/meus-dados.ts, com verificação de
// token via `verifySessionToken` (src/lib/auth-helpers.ts).

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
