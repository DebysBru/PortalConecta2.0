'use client';

import { useCallback, useState } from 'react';
import { mensagemAmigavel, MENSAGENS } from '@/lib/mensagens';

/**
 * Estado de mensagem de erro já normalizado para exibição.
 *
 * Por que existe: as telas de painel guardavam o texto do erro em `useState` e
 * jogavam na tela como veio — se algum servidor devolvesse erro técnico (Prisma,
 * Firebase, API de IA, caminho de arquivo), ele aparecia literalmente para o
 * usuário. Este hook é um substituto direto de `useState('')`:
 *
 *     const [error, setError] = useMensagemErro();
 *     setError(result.error, 'Não conseguimos salvar. Tente novamente.');
 *
 * `setError` aceita qualquer coisa (`string`, `Error`, `unknown`) e nunca deixa
 * passar termo técnico. `limparErro` equivale ao antigo `setError('')`.
 */
export function useMensagemErro(): [
  string,
  (erro: unknown, fallback?: string) => void,
  () => void,
] {
  const [erro, setErro] = useState('');

  const definir = useCallback((novo: unknown, fallback?: string) => {
    // `''`/null limpa o aviso — é o uso mais comum (`setError('')`).
    if (novo === '' || novo === null || novo === undefined) {
      setErro('');
      return;
    }
    setErro(mensagemAmigavel(novo, fallback ?? MENSAGENS.operacaoNaoConcluida));
  }, []);

  const limpar = useCallback(() => setErro(''), []);

  return [erro, definir, limpar];
}
