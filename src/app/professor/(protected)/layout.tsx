import { redirect } from 'next/navigation';
import { ProfessorShell } from '@/components/professor/ProfessorShell';
import { getVerifiedServerSession } from '@/lib/session';
import { getUserRole } from '@/actions/admin';

export const metadata = { title: 'Painel do Professor — Portal Conecta' };

/**
 * Route group `(protected)` — mesma razão do admin: isola este layout de
 * `professor/login/page.tsx` sem depender de detectar a rota atual via
 * header repassado pelo middleware (não se mostrou confiável neste
 * ambiente).
 */
export default async function ProfessorProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getVerifiedServerSession();
  if (!session) redirect('/professor/login');

  const role = await getUserRole(session.email);
  if (role !== 'PROFESSOR' && role !== 'ADMIN') redirect('/');

  return <ProfessorShell>{children}</ProfessorShell>;
}
