import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

export class AiLimitError extends Error {
  readonly status = 429;
  constructor(public retryAfterSeconds = 60, message = 'A IFizinha está recebendo muitas perguntas. Aguarde um pouco e tente novamente.') { super(message); }
}

/** Limites e leases compartilhados por todos os processos da VPS. */
export async function reservarAtendimento(request: Request, scope = 'chat', identity?: string) {
  // Só confiar no header sobrescrito pelo nginx, quando explicitamente configurado.
  const origin = identity || (process.env.AI_TRUST_PROXY === '1' ? request.headers.get('x-real-ip') : null) || 'publico';
  const key = createHash('sha256').update(origin).digest('hex').slice(0, 24);
  const minute = new Date(Date.now() - 60_000);
  const leaseStart = new Date(Date.now() - 120_000);
  const lease = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(8142751)`;
    // Dentro do lock: requisições concorrentes não podem consumir a mesma vaga.
    if (scope === 'chat') {
      const now = Date.now();
      const hits = await tx.rateLimitHit.findMany({
        where: { chave: `ai:${scope}:${key}`, criadoEm: { gt: new Date(now - 3600_000) } },
        orderBy: { criadoEm: 'desc' }, take: 20, select: { criadoEm: true },
      });
      if (hits.length >= 20) {
        const seconds = Math.max(1, Math.ceil((hits[19].criadoEm.getTime() + 3600_000 - now) / 1000));
        throw new AiLimitError(seconds, `A IFizinha está em fase de testes. O limite é de 20 perguntas por hora. Você poderá perguntar novamente em ${Math.ceil(seconds / 60)} minuto(s).`);
      }
      if (hits[0] && now - hits[0].criadoEm.getTime() < 5000) {
        const seconds = Math.max(1, Math.ceil((hits[0].criadoEm.getTime() + 5000 - now) / 1000));
        throw new AiLimitError(seconds, `A IFizinha está em fase de testes. Aguarde ${seconds} segundo(s) antes de enviar outra pergunta (intervalo mínimo de 5 segundos).`);
      }
    }
    const [local, total, running] = await Promise.all([
      tx.rateLimitHit.count({ where: { chave: `ai:${scope}:${key}`, criadoEm: { gte: minute } } }),
      tx.rateLimitHit.count({ where: { chave: { startsWith: 'ai:' }, criadoEm: { gte: minute } } }),
      tx.job.count({ where: { tipo: 'ai_lease', status: 'rodando', created_at: { gte: leaseStart } } }),
    ]);
    if (local >= (Number(process.env.AI_RPM_ORIGIN) || 12) || total >= (Number(process.env.AI_RPM_GLOBAL) || 60) || running >= (Number(process.env.AI_CONCURRENCY) || 4)) throw new AiLimitError();
    await tx.rateLimitHit.create({ data: { chave: `ai:${scope}:${key}` } });
    await tx.rateLimitHit.deleteMany({ where: { chave: { startsWith: 'ai:' }, criadoEm: { lt: new Date(Date.now() - 86400_000) } } });
    await tx.job.deleteMany({ where: { tipo: 'ai_lease', created_at: { lt: leaseStart } } });
    return tx.job.create({ data: { tipo: 'ai_lease', status: 'rodando', payload: {} } });
  });
  return () => prisma.job.deleteMany({ where: { id: lease.id, tipo: 'ai_lease' } }).catch(() => undefined);
}
