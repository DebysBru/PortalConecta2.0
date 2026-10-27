import { prisma } from '@/lib/prisma';
import { ORIGEM_SUAP_EDITAL } from '@/lib/suap-editais';
import { chaveProjeto, MARCA_CARGA_NAVEGADOR } from '@/lib/suap-carga';

/**
 * O que a página da Carga semanal precisa saber do banco:
 *
 *  - os identificadores que o portal já tem, que vão embutidos no código copiado
 *    para o script descartar o que não é novo (arquivo pequeno, importação rápida);
 *  - quando foi a última carga pelo navegador e quantos registros ela trouxe.
 */
export interface UltimaCarga {
  em: string; // ISO
  novos: number;
  status: string;
}

export interface ContextoCarga {
  conhecidos: { editais: string[]; projetos: string[] };
  ultimaCarga: { editais: UltimaCarga | null; projetos: UltimaCarga | null };
  totais: { editaisSuap: number; projetos: number };
}

async function ultimoLog(tipo: 'editais' | 'projetos'): Promise<UltimaCarga | null> {
  // Só conta carga feita pelo navegador: tentativas diretas pelo servidor (barradas
  // pelo WAF) não são "extração" e não podem zerar o aviso de carga atrasada.
  const log = await prisma.syncLog.findFirst({
    where: { tipo, status: { not: 'error' }, mensagem: { contains: MARCA_CARGA_NAVEGADOR } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, sincronizados: true, status: true },
  });
  return log ? { em: log.createdAt.toISOString(), novos: log.sincronizados, status: log.status } : null;
}

export async function carregarContextoCarga(): Promise<ContextoCarga> {
  const [editais, projetos, ultimoEditais, ultimoProjetos] = await Promise.all([
    prisma.edital.findMany({ where: { origemRef: { startsWith: ORIGEM_SUAP_EDITAL } }, select: { origemRef: true } }),
    prisma.projeto.findMany({ where: { suapId: { not: null } }, select: { suapId: true } }),
    ultimoLog('editais'),
    ultimoLog('projetos'),
  ]);

  const chavesEditais = editais.map((e) => e.origemRef).filter((r): r is string => !!r);
  const chavesProjetos = projetos.map((p) => p.suapId).filter((id): id is number => typeof id === 'number').map(chaveProjeto);

  return {
    conhecidos: { editais: chavesEditais, projetos: chavesProjetos },
    ultimaCarga: { editais: ultimoEditais, projetos: ultimoProjetos },
    totais: { editaisSuap: chavesEditais.length, projetos: chavesProjetos.length },
  };
}
