import { cookies } from 'next/headers';
import type { UserRole } from '@prisma/client';
import { resolverVisao, VISAO_COOKIE_NAME, type Visao } from '@/lib/visao';

/** Visão efetiva da requisição atual (ver `src/lib/visao.ts`). */
export function lerVisao(papelReal: UserRole | null): Visao {
  return resolverVisao(papelReal, cookies().get(VISAO_COOKIE_NAME)?.value);
}
