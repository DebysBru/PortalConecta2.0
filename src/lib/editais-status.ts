import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';
import { ORIGEM_SUAP_EDITAL, statusPelasDatas } from '@/lib/suap-editais';
import { foiEditadoAposSync } from '@/lib/suap-edicao-manual';

/**
 * Atualização automática do status dos editais importados do SUAP.
 *
 * Problema: o status é calculado pelas datas na hora da importação, e a carga
 * semanal só mexe nos editais NOVOS. Sem isto, um edital importado como "Aberto"
 * continuaria aberto depois de encerrar.
 *
 * Como funciona: não há agendador na VPS, então a conta é refeita quando alguém
 * abre as páginas públicas de editais (`garantirStatusEditaisAtualizado`), no
 * máximo uma vez a cada 10 minutos por processo. Como são poucas dezenas de
 * registros, a consulta é barata. A regra é a mesma da importação
 * (`statusPelasDatas`), sobre as datas gravadas no banco.
 *
 * Respeita decisão humana: edital editado à mão no portal depois da última carga
 * (`foiEditadoAposSync`) não é tocado — o status dele é do admin. E a própria
 * atualização grava `suapSyncedAt` junto, para não parecer edição manual no
 * próximo sync.
 */

const INTERVALO_MS = 10 * 60 * 1000;

let ultimaExecucao = 0;
let emAndamento: Promise<ResultadoAtualizacaoStatus> | null = null;

export interface ResultadoAtualizacaoStatus {
  verificados: number;
  atualizados: number;
  preservados: number;
}

export async function atualizarStatusEditaisSuap(
  opcoes: { agora?: Date; forcar?: boolean } = {},
): Promise<ResultadoAtualizacaoStatus | null> {
  const agora = opcoes.agora ?? new Date();
  if (emAndamento) return emAndamento;
  if (!opcoes.forcar && agora.getTime() - ultimaExecucao < INTERVALO_MS) return null;

  ultimaExecucao = agora.getTime();
  emAndamento = executar(agora).finally(() => {
    emAndamento = null;
  });
  return emAndamento;
}

async function executar(agora: Date): Promise<ResultadoAtualizacaoStatus> {
  // ENCERRADO é terminal: as datas só avançam, então não há o que reavaliar.
  const editais = await prisma.edital.findMany({
    where: {
      origemRef: { startsWith: ORIGEM_SUAP_EDITAL },
      deleted_at: null,
      status: { not: 'ENCERRADO' },
    },
    select: {
      id: true, status: true, dataInicio: true, dataEncerramento: true, dataResultado: true,
      updatedAt: true, suapSyncedAt: true,
    },
  });

  const resultado: ResultadoAtualizacaoStatus = { verificados: editais.length, atualizados: 0, preservados: 0 };

  for (const edital of editais) {
    if (foiEditadoAposSync(edital)) {
      resultado.preservados++;
      continue;
    }
    const novo = statusPelasDatas(edital, agora);
    if (novo === edital.status) continue;

    await prisma.edital.update({ where: { id: edital.id }, data: { status: novo, suapSyncedAt: new Date() } });
    resultado.atualizados++;
  }

  if (resultado.atualizados > 0) {
    // A lista pública e o contexto da IFizinha guardam o status em cache.
    cache.invalidate('^editais:');
    cache.invalidate('^chat:');
  }
  return resultado;
}

/**
 * Para as páginas públicas: nunca quebra a página (falha de banco aqui não pode
 * impedir ninguém de ver os editais) e custa quase nada quando já rodou há pouco.
 */
export async function garantirStatusEditaisAtualizado(): Promise<void> {
  try {
    await atualizarStatusEditaisSuap();
  } catch (erro) {
    console.error('[editais] Falha ao atualizar o status pelas datas:', erro);
  }
}

/** Só para os testes: zera o limitador entre os casos. */
export function reiniciarLimitadorDeStatus(): void {
  ultimaExecucao = 0;
  emAndamento = null;
}
