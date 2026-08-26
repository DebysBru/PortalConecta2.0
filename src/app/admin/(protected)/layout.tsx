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

  // AdminShell (client) permite ADMIN e PROFESSOR — cada página dentro de
  // /admin/* já faz sua própria restrição mais específica quando precisa
  // (ex.: admin/editais só libera pra `isMaster`). Aqui só fechamos o
  // buraco do achado S9: alguém sem sessão nenhuma (ESTUDANTE ou nem
  // logado) não deve nem receber o HTML da página.
  const role = await getUserRole(session.email);
  if (role !== 'ADMIN' && role !== 'PROFESSOR') redirect('/');

  return <AdminShell>{children}</AdminShell>;
}
