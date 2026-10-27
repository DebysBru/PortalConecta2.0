'use server';

import { cookies } from 'next/headers';
import { MENSAGENS } from '@/lib/mensagens';
import { getVerifiedServerSession } from '@/lib/session';
import { resolveUserRole } from '@/lib/permissions';
import {
  parseVisao,
  VISAO_COOKIE_NAME,
  VISAO_MAX_AGE_S,
  type Visao,
} from '@/lib/visao';

/**
 * Troca a visão do Administrador (Aluno / Professor / Admin). A identidade vem
 * do cookie de sessão verificado — não de um e-mail enviado pelo cliente — e só
 * o papel ADMIN real pode escolher uma visão.
 */
export async function definirVisao(
  visao: Visao,
): Promise<{ ok: true; visao: Visao } | { ok: false; error: string }> {
  const sessao = await getVerifiedServerSession();
  if (!sessao) return { ok: false, error: MENSAGENS.naoAutenticado };

  const papel = await resolveUserRole(sessao.email);
  if (papel !== 'ADMIN') return { ok: false, error: MENSAGENS.semPermissaoAdmin };

  const escolhida = parseVisao(visao);
  cookies().set(VISAO_COOKIE_NAME, escolhida, {
    maxAge: VISAO_MAX_AGE_S,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return { ok: true, visao: escolhida };
}
