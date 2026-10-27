import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

/** O chat e os importadores compartilham a mesma janela por chave do provedor. */
export async function reservarQuotaEmbedding(apiKey: string, count: number, signal: AbortSignal) {
  const key = `embedding:${createHash('sha256').update(apiKey).digest('hex').slice(0, 24)}`;
  const limit = Math.max(1, Number(process.env.EMBEDDING_RPM) || 95);
  if (count > limit) throw new Error('Lote maior que a cota configurada');
  while (true) {
    signal.throwIfAborted();
    const reserved = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8142752)`;
      const used = await tx.rateLimitHit.count({ where: { chave: key, criadoEm: { gte: new Date(Date.now() - 60_000) } } });
      if (used + count > limit) return false;
      await tx.rateLimitHit.createMany({ data: Array.from({ length: count }, () => ({ chave: key })) });
      await tx.rateLimitHit.deleteMany({ where: { chave: key, criadoEm: { lt: new Date(Date.now() - 60_000) } } });
      return true;
    });
    if (reserved) return;
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 1000);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }
}
