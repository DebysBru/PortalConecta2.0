import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { getVerifiedServerSession } from '@/lib/session';
import { getUserRole } from '@/actions/admin';

export const metadata = { title: 'Admin — Portal Conecta' };

/**
 * Route group `(protected)` — não aparece na URL (`/admin/editais` continua
 * `/admin/editais`), mas isola este layout de `admin/login/page.tsx`. Sem
 * essa separação, um layout compartilhado em `admin/layout.tsx` também
 * envolveria a própria página de login, e redirecionar quem não tem sessão
 * pra `/admin/login` viraria um loop (a tentativa de forwarding de pathname
 * via header de middleware não se mostrou confiável neste ambiente — ver
 * ANALISE_E_PLANO_RAG.md / PLANO_DE_TESTES_E_VALIDACAO.md).
 */
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getVerifiedServerSession();
  if (!session) redirect('/admin/login');

  // `getUserRole` já recalcula o papel ao vivo (src/lib/permissions.ts):
  // só o Administrador Geral (ADMIN_EMAILS) é ADMIN, e ninguém fora do
  // domínio @ifpr.edu.br chega a ser PROFESSOR/ADMIN. O painel /admin é
  // exclusivo do Administrador Geral — um Professor (coordenador/vice de
  // projeto) tem o próprio painel em /professor, e quem não é nem um nem
  // outro cai na área de usuário comum.
  const role = await getUserRole(session.email);
  if (role === 'PROFESSOR') redirect('/professor');
  if (role !== 'ADMIN') redirect('/meus-dados');

  return <AdminShell>{children}</AdminShell>;
}
