import { redirect } from 'next/navigation';
import { ProfessorShell } from '@/components/professor/ProfessorShell';
import { getVerifiedServerSession } from '@/lib/session';
import { getUserRole } from '@/actions/admin';
import { lerVisao } from '@/lib/visao-server';
import { usuarioTemAlgumProjetoComoGestor } from '@/lib/permissions';

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

  // `getUserRole` recalcula o papel ao vivo (src/lib/permissions.ts): só é
  // PROFESSOR quem tem e-mail @ifpr.edu.br E coordena/vice-coordena (ou foi
  // explicitamente autorizado em) pelo menos um projeto — sem projeto
  // carregado, não entra. O Administrador Geral usa o painel completo em
  // /admin, não este.
  const role = await getUserRole(session.email);
  if (role === 'ADMIN') {
    // "Ver como" (src/lib/visao.ts): o admin só entra aqui se escolheu a visão
    // Professor — as permissões reais continuam as de admin (vê todos os projetos).
    const visao = lerVisao(role);
    if (visao === 'ADMIN') redirect('/admin');
    if (visao === 'ESTUDANTE') redirect('/');
    return <ProfessorShell>{children}</ProfessorShell>;
  }

  // Aluno bolsista/voluntário nomeado gestor da página entra no MESMO shell,
  // mas com a navegação reduzida (só os projetos que gerencia). As páginas
  // sensíveis continuam bloqueadas no servidor e redirecionam no cliente.
  const modoGestor = role !== 'PROFESSOR' && (await usuarioTemAlgumProjetoComoGestor(session.email));
  if (role !== 'PROFESSOR' && !modoGestor) redirect('/meus-dados');

  return <ProfessorShell modoGestor={modoGestor}>{children}</ProfessorShell>;
}
