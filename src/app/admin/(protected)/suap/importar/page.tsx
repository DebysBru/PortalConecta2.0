import { redirect } from 'next/navigation';

/** A importação de projetos virou a Carga semanal (editais + projetos numa só colagem). */
export default function ImportarSuapPage() {
  redirect('/admin/suap/carga');
}
