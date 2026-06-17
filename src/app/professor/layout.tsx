import { ProfessorShell } from '@/components/professor/ProfessorShell';

export const metadata = { title: 'Painel do Professor — Portal Conecta' };

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return <ProfessorShell>{children}</ProfessorShell>;
}
