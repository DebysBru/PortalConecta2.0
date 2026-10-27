import '../prisma/_env';
import { randomUUID, createHash } from 'crypto';
import { reservarAtendimento, AiLimitError } from '../src/lib/ai-guard';
import { prisma } from '../src/lib/prisma';
async function main() {
  const db = new URL(process.env.DATABASE_URL!);
  if (!['localhost', '127.0.0.1'].includes(db.hostname) || db.port !== '5433') throw new Error('Teste apenas local');
  process.env.AI_CONCURRENCY = '2';
  const identity = `limite-teste-${randomUUID()}`;
  const key = `ai:verificacao:${createHash('sha256').update(identity).digest('hex').slice(0, 24)}`;
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => reservarAtendimento(new Request('http://localhost'), 'verificacao', identity)));
  const allowed = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof reservarAtendimento>>> => r.status === 'fulfilled');
  const denied = results.filter(r => r.status === 'rejected' && r.reason instanceof AiLimitError);
  try {
    console.log(JSON.stringify({ simultaneous: 6, configuredLimit: 2, allowed: allowed.length, denied: denied.length }));
    if (allowed.length !== 2 || denied.length !== 4) throw new Error('Concorrência ultrapassou o limite ou falhou por outro motivo');
  } finally {
    await Promise.all(allowed.map(r => r.value()));
    await prisma.rateLimitHit.deleteMany({ where: { chave: key } });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
