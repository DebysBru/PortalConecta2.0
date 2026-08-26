/**
 * Worker da fila `Job` para curadoria de documentos_kb/chunks_kb.
 *
 * Nesta etapa o job é processado imediatamente (in-process) logo após ser
 * criado, não por um consumidor externo/cron — mas o ciclo de vida do Job
 * (pendente → rodando → ok/erro) já é o mesmo que um worker assíncrono real
 * usaria, então trocar para processamento em background depois é só trocar
 * QUEM chama esta função, não como ela funciona.
 */

import { prisma } from '@/lib/prisma';
import { curarDocumento } from '@/lib/curador';
import type { Prisma } from '@prisma/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('kb-worker');

export async function curarDocumentoKb(documentoId: string): Promise<void> {
  const job = await prisma.job.create({
    data: { tipo: 'kb_curate', payload: { documentoId }, status: 'rodando' },
  });
  log.info('Curadoria iniciada', { documentoId, jobId: job.id });

  try {
    const doc = await prisma.documentoKb.findUnique({
      where: { id: documentoId },
      include: { chunks: { where: { ativo: true }, orderBy: { chunkIndex: 'asc' } } },
    });
    if (!doc) throw new Error('Documento não encontrado');

    await prisma.documentoKb.update({ where: { id: documentoId }, data: { status: 'processing' } });

    const curadoria = await curarDocumento(
      doc.titulo,
      doc.tipo,
      doc.chunks.map((c) => ({ chunkIndex: c.chunkIndex, texto: c.texto, secao: c.secao }))
    );

    for (const chunkResult of curadoria.chunks) {
      const chunk = doc.chunks.find((c) => c.chunkIndex === chunkResult.chunkIndex);
      if (!chunk) continue;

      const chunkMetadata = (chunk.metadata ?? {}) as Prisma.JsonObject;

      await prisma.chunkKb.update({
        where: { id: chunk.id },
        data: {
          secao: chunkResult.secao ?? chunk.secao,
          categoria: curadoria.categoria,
          metadata: {
            ...chunkMetadata,
            qualidade: chunkResult.qualidade,
            ...(chunkResult.tabelaReformatada ? { tabela_reformatada: chunkResult.tabelaReformatada } : {}),
          },
        },
      });
    }

    const docMetadata = (doc.metadata ?? {}) as Prisma.JsonObject;

    await prisma.documentoKb.update({
      where: { id: documentoId },
      data: {
        status: 'chunking',
        processadoEm: new Date(),
        metadata: {
          ...docMetadata,
          resumo: curadoria.resumo,
          categoria: curadoria.categoria,
          tags: curadoria.tags,
        },
      },
    });

    await prisma.job.update({ where: { id: job.id }, data: { status: 'ok' } });
    log.info('Curadoria concluída', { documentoId, jobId: job.id, categoria: curadoria.categoria, totalTags: curadoria.tags.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error('Curadoria falhou — documento segue disponível sem metadados de IA', { documentoId, jobId: job.id, erro: msg });
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'erro', erro: msg, tentativas: { increment: 1 } },
    });
    // Curadoria é enriquecimento, não extração — o documento segue disponível
    // com os chunks determinísticos da Etapa 2, só sem os metadados de IA.
    await prisma.documentoKb.update({ where: { id: documentoId }, data: { status: 'chunking' } }).catch(() => {});
  }
}
