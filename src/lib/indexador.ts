/**
 * Indexador — última etapa da pipeline de ingestão. Gera embeddings para os
 * chunks já curados (Etapa 3) e grava no pgvector. Diferente da curadoria,
 * falha aqui É bloqueante: sem embedding o chunk não é encontrado pela busca
 * vetorial, então o documento não pode ficar marcado como `indexed`.
 */

import { prisma } from '@/lib/prisma';
import { generateBatchEmbeddings, validateEmbedding, EmbeddingNotConfigured, embeddingConfig, embeddingSignature, textoParaEmbedding } from '@/lib/embeddings';
import { saveChunksWithEmbeddings } from '@/lib/busca-vetorial';
import { createLogger } from '@/lib/logger';
import { mensagemAmigavel } from '@/lib/mensagens';

const log = createLogger('indexador');

export async function indexarDocumentoKb(documentoId: string): Promise<'indexed' | 'textual'> {
  const job = await prisma.job.create({
    data: { tipo: 'kb_embed', payload: { documentoId }, status: 'rodando' },
  });
  log.info('Indexação iniciada', { documentoId, jobId: job.id });

  try {
    const doc = await prisma.documentoKb.findUnique({
      where: { id: documentoId },
      include: { chunks: { where: { ativo: true }, orderBy: { chunkIndex: 'asc' } } },
    });
    if (!doc) throw new Error('Documento não encontrado');
    if (doc.chunks.length === 0) throw new Error('Documento não tem chunks ativos para indexar');

    await prisma.documentoKb.update({ where: { id: documentoId }, data: { status: 'embedding' } });

    const textos = doc.chunks.map(textoParaEmbedding);
    const embeddings = await generateBatchEmbeddings(textos);
    embeddings.forEach((e) => validateEmbedding(e));

    const saved = await saveChunksWithEmbeddings(
      doc.chunks.map((c, i) => ({
        id: c.id,
        documentoId: c.documentoId,
        documentoVersao: c.documentoVersao,
        chunkIndex: c.chunkIndex,
        texto: c.texto,
        secao: c.secao,
        categoria: c.categoria,
        paginaInicial: c.paginaInicial,
        paginaFinal: c.paginaFinal,
        metadata: (c.metadata ?? {}) as Record<string, unknown>,
        ativo: c.ativo,
        embedding: embeddings[i],
      }))
    );

    if (saved !== doc.chunks.length) throw new Error('Persistência parcial de embeddings');
    await prisma.documentoKb.update({
      where: { id: documentoId },
      data: {
        metadata: { ...(doc.metadata as Record<string, string>), embedding_signature: embeddingSignature(), semantic: true },
        status: 'indexed',
        processadoEm: new Date(),
        modeloEmbedding: embeddingConfig().model,
        embeddingDimensions: embeddings[0]?.length ?? 1536,
      },
    });

    await prisma.job.update({ where: { id: job.id }, data: { status: 'ok' } });
    log.info('Indexação concluída', { documentoId, jobId: job.id, totalChunks: doc.chunks.length });
    return 'indexed';
  } catch (e) {
    if (e instanceof EmbeddingNotConfigured) {
      await prisma.documentoKb.update({ where: { id: documentoId }, data: { status: 'textual', modeloEmbedding: 'none', erro: null } });
      await prisma.job.update({ where: { id: job.id }, data: { status: 'ok', payload: { documentoId, modo: 'textual' } } });
      return 'textual';
    }
    const tecnico = e instanceof Error ? e.message : String(e);
    log.error('Indexação falhou', { documentoId, jobId: job.id, erro: tecnico });
    // O que é gravado no banco aparece no painel de administração — por isso
    // guarda a versão amigável, não a mensagem crua do erro.
    const msg = mensagemAmigavel(e, 'Não conseguimos preparar este documento para a busca. Tente enviar o arquivo novamente.');
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'erro', erro: msg, tentativas: { increment: 1 } },
    });
    await prisma.documentoKb
      .update({ where: { id: documentoId }, data: { status: 'failed', erro: msg } })
      .catch(() => {});
    throw new Error(msg, { cause: e });
  }
}
