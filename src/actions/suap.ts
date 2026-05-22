'use server';

/**
 * Server Actions para integração com SUAP
 * Executam no servidor — credenciais ficam protegidas no .env.local
 */

import { syncProjetos, syncEditais, getLastSyncLogs } from '@/lib/suap-sync';
import { testSuapConnection, fetchSuapEndpoints } from '@/lib/suap-api';
import { prisma } from '@/lib/prisma';

// ─── Sync Actions ──────────────────────────────────────────────────────────────

export async function syncProjetosAction(dryRun = false) {
  try {
    return await syncProjetos({ dryRun });
  } catch (err) {
    return {
      total: 0, criados: 0, atualizados: 0, erros: 1,
      detalhes: [`❌ ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

export async function syncEditaisAction(dryRun = false) {
  try {
    return await syncEditais({ dryRun });
  } catch (err) {
    return {
      total: 0, criados: 0, atualizados: 0, erros: 1,
      detalhes: [`❌ ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

// ─── Status Action ─────────────────────────────────────────────────────────────

export async function getSuapStatusAction() {
  const [conexao, logs, totalProjetos, totalEditais, projetosDoSuap, editaisDoSuap] =
    await Promise.allSettled([
      testSuapConnection(),
      getLastSyncLogs(20),
      prisma.projeto.count(),
      prisma.edital.count(),
      prisma.projeto.count({ where: { suapId: { not: null } } }),
      prisma.edital.count({ where: { suapId: { not: null } } }),
    ]);

  // Considera configurado se tiver qualquer método de auth válido
  const temApiToken = !!(
    process.env.SUAP_API_TOKEN &&
    process.env.SUAP_API_TOKEN !== 'cole-seu-token-pessoal-aqui'
  );
  const temUserPass = !!(
    process.env.SUAP_USERNAME &&
    process.env.SUAP_PASSWORD &&
    process.env.SUAP_PASSWORD !== 'sua-senha-suap-aqui'
  );

  return {
    suap: {
      configurado: temApiToken || temUserPass,
      temApiToken,
      temUserPass,
      baseUrl: process.env.SUAP_BASE_URL ?? 'https://suap.ifpr.edu.br',
      campus: process.env.SUAP_CAMPUS ?? 'Ivaiporã',
      conexao: conexao.status === 'fulfilled'
        ? conexao.value
        : { ok: false, message: String(conexao.reason) },
    },
    banco: {
      totalProjetos: totalProjetos.status === 'fulfilled' ? totalProjetos.value : 0,
      totalEditais: totalEditais.status === 'fulfilled' ? totalEditais.value : 0,
      projetosDoSuap: projetosDoSuap.status === 'fulfilled' ? projetosDoSuap.value : 0,
      editaisDoSuap: editaisDoSuap.status === 'fulfilled' ? editaisDoSuap.value : 0,
    },
    logs: logs.status === 'fulfilled' ? logs.value : [],
  };
}

// ─── Explorar endpoints ────────────────────────────────────────────────────────

export async function getSuapEndpointsAction() {
  try {
    return await fetchSuapEndpoints();
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
