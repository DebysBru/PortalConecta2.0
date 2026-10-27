import React from 'react';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AlertCircle } from 'lucide-react';
import { getVerifiedServerSession } from '@/lib/session';
import { isAdministradorGeral } from '@/lib/permissions';
import { carregarContextoCarga, type ContextoCarga } from '@/lib/suap-carga-contexto';
import { CargaSuapClient } from './CargaSuapClient';

export const dynamic = 'force-dynamic';

/**
 * Carga semanal do SUAP (guia + importação).
 *
 * É um componente de servidor para duas coisas que o navegador não tem: o script
 * de captura do disco (assim a tela mostra o MESMO código que o admin baixa, sem
 * manter duas cópias) e a lista do que o portal já tem, que vai embutida no código
 * copiado para o script trazer só o que é novo. A autorização das gravações é
 * conferida nas Server Actions; aqui só se evita mandar a lista a quem não é
 * Administrador Geral.
 */
export default async function CargaSuapPage() {
  const sessao = await getVerifiedServerSession();
  if (!sessao?.email || !isAdministradorGeral(sessao.email)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-gray-500">A carga do SUAP é restrita ao Administrador Geral.</p>
      </div>
    );
  }

  let codigo = '// script indisponível: public/modelos/capturar-suap-semanal.js';
  try {
    codigo = await readFile(join(process.cwd(), 'public', 'modelos', 'capturar-suap-semanal.js'), 'utf8');
  } catch {
    // Sem o arquivo a tela continua útil (dá para colar o JSON na mão).
  }

  let contexto: ContextoCarga | null = null;
  try {
    contexto = await carregarContextoCarga();
  } catch (erro) {
    // Sem a lista o script traz tudo e o servidor descarta o repetido ao gravar.
    console.error('[SUAP] Falha ao montar o contexto da carga semanal:', erro);
  }

  return (
    <CargaSuapClient
      codigo={codigo}
      contexto={contexto}
      siglaCampus={process.env.SUAP_CAMPUS_SIGLA ?? 'IVAIPODG'}
    />
  );
}
