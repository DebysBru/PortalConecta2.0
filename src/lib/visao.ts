/**
 * "Ver como": o Administrador pode navegar pelo portal como Aluno, Professor
 * ou Admin (padrão) sem trocar de e-mail — só para testar telas e fluxos.
 *
 * É uma visão de INTERFACE: define qual painel/menu aparece e para onde os
 * layouts redirecionam. NÃO reduz as permissões reais — as Server Actions
 * continuam autorizando pelo papel real da sessão. Por isso, na visão
 * Professor o admin enxerga todos os projetos (e não só os de um coordenador).
 *
 * Este arquivo não importa nada de servidor, então vale tanto no cliente
 * quanto no servidor.
 */
import type { UserRole } from '@prisma/client';

export type Visao = 'ADMIN' | 'PROFESSOR' | 'ESTUDANTE';

export const VISAO_COOKIE_NAME = 'visao';
export const VISAO_MAX_AGE_S = 7 * 24 * 60 * 60; // 7 dias
export const VISAO_PADRAO: Visao = 'ADMIN';

export const VISOES: { valor: Visao; rotulo: string; destino: string }[] = [
  { valor: 'ESTUDANTE', rotulo: 'Visão Aluno', destino: '/' },
  { valor: 'PROFESSOR', rotulo: 'Visão Professor', destino: '/professor' },
  { valor: 'ADMIN', rotulo: 'Visão Admin (padrão)', destino: '/admin' },
];

export function parseVisao(valor: unknown): Visao {
  return valor === 'ESTUDANTE' || valor === 'PROFESSOR' || valor === 'ADMIN' ? valor : VISAO_PADRAO;
}

export function destinoDaVisao(visao: Visao): string {
  return VISOES.find((v) => v.valor === visao)?.destino ?? '/admin';
}

/**
 * Visão efetiva dado o papel REAL e o valor do cookie: quem não é ADMIN não
 * pode escolher visão — enxerga sempre o que o próprio papel dá.
 */
export function resolverVisao(papelReal: UserRole | null, valorDoCookie: unknown): Visao {
  if (papelReal === 'ADMIN') return parseVisao(valorDoCookie);
  return papelReal === 'PROFESSOR' ? 'PROFESSOR' : 'ESTUDANTE';
}
