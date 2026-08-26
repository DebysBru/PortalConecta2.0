/**
 * Rate limiting simples baseado no banco — achado S13 do RELATORIO_TESTES.md
 * ("sem rate limiting em login, cadastro e inscrições"). Não usa memória do
 * processo porque o deploy roda em funções serverless sem estado
 * compartilhado entre instâncias — um limitador em memória reiniciaria (e
 * ficaria inconsistente) a cada nova instância.
 */
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * `chave` deve já incluir o identificador (IP, e-mail, etc.) — ex.:
 * `rateLimitado('suap-login', ip, 5, 5 * 60_000)`.
 */
export async function rateLimitado(
  escopo: string,
  identificador: string,
  limite: number,
  janelaMs: number
): Promise<RateLimitResult> {
  const chave = `${escopo}:${identificador}`;
  const desde = new Date(Date.now() - janelaMs);

  const total = await prisma.rateLimitHit.count({ where: { chave, criadoEm: { gte: desde } } });
  if (total >= limite) {
    return { ok: false, retryAfterSeconds: Math.ceil(janelaMs / 1000) };
  }

  await prisma.rateLimitHit.create({ data: { chave } });

  // Limpeza oportunista de acertos antigos (evita crescimento sem limite da
  // tabela) — roda só ocasionalmente, não a cada chamada.
  if (Math.random() < 0.02) {
    const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.rateLimitHit.deleteMany({ where: { criadoEm: { lt: umDiaAtras } } }).catch(() => {});
  }

  return { ok: true };
}

/**
 * Extrai o IP do cliente a partir dos headers de request (funciona em Route
 * Handlers e em Server Actions — ambos têm acesso a `headers()` do Next).
 * Atrás de um proxy/CDN (Vercel inclui `x-forwarded-for`), o primeiro IP da
 * lista é o do cliente original.
 */
export function obterIpCliente(): string {
  const h = headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return h.get('x-real-ip') ?? 'desconhecido';
}
