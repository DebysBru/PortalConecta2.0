import React from 'react';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImportarSuapClient } from './ImportarSuapClient';

export const dynamic = 'force-dynamic';

/**
 * Página de importação de projetos do SUAP.
 *
 * É um componente de servidor só para ler o script de captura do disco
 * (`public/modelos/capturar-projetos-suap.js`) e entregá-lo ao cliente — assim a
 * tela mostra o MESMO código que o usuário baixa, sem manter duas cópias. A
 * autorização é conferida nas Server Actions (sessão verificada + Administrador
 * Geral), não aqui.
 */
export default async function ImportarSuapPage() {
  let codigoCaptura = '// script indisponível: public/modelos/capturar-projetos-suap.js';

  try {
    codigoCaptura = await readFile(
      join(process.cwd(), 'public', 'modelos', 'capturar-projetos-suap.js'),
      'utf8',
    );
  } catch {
    // Sem o arquivo a tela continua útil (dá para colar o JSON na mão).
  }

  return (
    <ImportarSuapClient
      codigoCaptura={codigoCaptura}
      siglaCampus={process.env.SUAP_CAMPUS_SIGLA ?? 'IVAIPODG'}
    />
  );
}
