import { createHash, randomUUID } from 'crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { chunkDocument } from '@/lib/chunking';
import { curarDocumentoKb } from '@/lib/kb-worker';
import { indexarDocumentoKb } from '@/lib/indexador';
import { cache } from '@/lib/cache';

export type IngestaoRag = {
  titulo: string; conteudo: string; tipo: string; anteriorId?: string;
  permitirTextual?: boolean;
  refId?: string; metadata?: Prisma.InputJsonObject; originalKey?: string; pages?: number;
};

export async function publicarVersaoRag(id: string, client: PrismaClient = prisma, substituirId?: string) {
  return client.$transaction(async tx => {
    const doc = await tx.documentoKb.findUniqueOrThrow({ where: { id } });
    if (!['indexed', 'textual'].includes(doc.status)) throw new Error('A versão ainda não está pronta para publicação');
    const metadata = doc.metadata as Record<string, unknown>;
    const identity = doc.refId || `kb:${doc.id}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identity}))`;
    const active = await tx.documentoKb.findFirst({ where: { refId: identity, ativo: true, id: { not: id } } });
    const expected = substituirId || (typeof metadata.anteriorId === 'string' ? metadata.anteriorId : null);
    if (active && active.id !== expected) throw new Error('Outra versão foi publicada. Atualize a lista antes de substituir.');
    if (expected && !active && !metadata.publicadoEm) {
      const previous = await tx.documentoKb.findUnique({ where: { id: expected } });
      if (!previous?.ativo) throw new Error('O documento anterior mudou ou foi ocultado durante o processamento.');
      // Compatibilidade com documentos anteriores que ainda não possuíam identidade.
      if (previous.refId && previous.refId !== identity) throw new Error('Identidade anterior incompatível');
      await tx.documentoKb.update({ where: { id: previous.id }, data: { ativo: false, refId: identity } });
    }
    const previous = active || (expected ? await tx.documentoKb.findUnique({ where: { id: expected } }) : null);
    if (previous?.status === 'indexed' && doc.status === 'textual' && metadata.permitirTextual !== true) throw new Error('A versão anterior tem busca semântica. Configure os embeddings ou autorize explicitamente a publicação apenas textual.');
    await tx.documentoKb.updateMany({ where: { refId: identity, id: { not: id }, ativo: true }, data: { ativo: false } });
    // Chunks permanecem associados à sua versão; o gate público é d.ativo.
    return tx.documentoKb.update({ where: { id }, data: { ativo: true, refId: identity,
      metadata: { ...(doc.metadata as Prisma.InputJsonObject), publicadoEm: typeof metadata.publicadoEm === 'string' ? metadata.publicadoEm : new Date().toISOString() },
    } });
  });
}

export async function ingerirDocumentoRag(input: IngestaoRag) {
  if (!input.titulo.trim() || input.titulo.length > 500 || !input.conteudo.trim() || input.conteudo.length > 2_000_000) throw new Error('Título ou conteúdo inválido');
  const anterior = input.anteriorId ? await prisma.documentoKb.findUnique({ where: { id: input.anteriorId } }) : null;
  if (input.anteriorId && (!anterior || !anterior.ativo)) throw new Error('Selecione uma versão ativa para substituir');
  const identity = anterior?.refId || input.refId || `kb:${anterior?.id || randomUUID()}`;
  const hash = createHash('sha256').update(input.conteudo).digest('hex');
  const duplicate = await prisma.documentoKb.findFirst({ where: { hashArquivo: hash, ativo: true } });
  if (duplicate) throw new Error('Este conteúdo já está publicado na base');
  const last = await prisma.documentoKb.findFirst({ where: { refId: identity }, orderBy: { versao: 'desc' } });
  const doc = await prisma.documentoKb.create({ data: {
    titulo: input.titulo.trim(), tipo: input.tipo, refId: identity, hashArquivo: hash,
    ativo: false, status: 'chunking', versao: Math.max(last?.versao || 0, anterior?.versao || 0) + 1,
    totalPaginas: input.pages,
    metadata: { ...input.metadata, source: input.metadata?.source || 'texto_direto', originalText: input.originalKey ? undefined : input.conteudo,
      permitirTextual: input.permitirTextual === true,
      ...(input.originalKey ? { originalKey: input.originalKey } : {}), ...(anterior ? { anteriorId: anterior.id } : {}) },
  } });
  try {
    const chunks = chunkDocument(input.conteudo);
    if (!chunks.length) throw new Error('Documento sem trechos utilizáveis');
    await prisma.chunkKb.createMany({ data: chunks.map((c, i) => ({ documentoId: doc.id, documentoVersao: doc.versao, chunkIndex: i, texto: c.texto, secao: c.secao, metadata: { chunk_total: chunks.length } })) });
    await prisma.documentoKb.update({ where: { id: doc.id }, data: { totalChunks: chunks.length } });
    await curarDocumentoKb(doc.id);
    await indexarDocumentoKb(doc.id);
    const published = await publicarVersaoRag(doc.id);
    cache.invalidate('chat:');
    return { id: doc.id, chunks: chunks.length, status: published.status, versao: published.versao };
  } catch (error) {
    await prisma.documentoKb.update({ where: { id: doc.id }, data: { ativo: false, status: 'failed', erro: 'Não foi possível preparar/publicar a versão. A versão anterior foi preservada.' } }).catch(() => undefined);
    throw error;
  }
}

export async function alterarVisibilidadeRag(id: string, ativo: boolean, substituirId?: string) {
  if (ativo) await publicarVersaoRag(id, prisma, substituirId);
  else await prisma.documentoKb.update({ where: { id }, data: { ativo: false } });
  cache.invalidate('chat:');
}
