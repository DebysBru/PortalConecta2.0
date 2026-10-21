'use client';

import { useCallback, useRef, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { consultarPesoDeUrls } from '@/lib/upload-midia';
import { caminhosDeImagemNoHtml, urlPublicaDoCaminho } from '@/lib/post-midias';

/**
 * Peso (em bytes) das imagens que estão DENTRO do texto do post.
 *
 * Existe porque o navegador não sabe o tamanho de uma imagem publicada numa
 * sessão anterior: quem responde é o servidor (`/api/files/peso`), que lê o
 * disco. Sem isso o indicador de 20 MB mostraria só o que foi enviado agora e o
 * limite pareceria estourar "do nada" ao salvar.
 *
 * A consulta só acontece quando a LISTA de imagens muda — digitar uma letra não
 * pode disparar requisição.
 */
export function usePesoDasImagensDoTexto(user: FirebaseUser | null) {
  const [bytesDasImagens, setBytesDasImagens] = useState(0);
  const [calculandoPeso, setCalculandoPeso] = useState(false);
  const imagensContadas = useRef('');

  const recalcularPesoDoTexto = useCallback(async (html: string) => {
    if (!user) return;

    const caminhos = caminhosDeImagemNoHtml(html);
    const chave = caminhos.join('|');
    if (chave === imagensContadas.current) return;
    imagensContadas.current = chave;

    if (caminhos.length === 0) {
      setBytesDasImagens(0);
      return;
    }

    setCalculandoPeso(true);
    try {
      const idToken = await user.getIdToken();
      const resultado = await consultarPesoDeUrls({
        idToken,
        urls: caminhos.map((c) => urlPublicaDoCaminho(c)),
      });
      setBytesDasImagens(resultado.ok ? resultado.totalBytes : 0);
    } finally {
      setCalculandoPeso(false);
    }
  }, [user]);

  /** Zera o contador (ao abrir/fechar o formulário, para forçar nova consulta). */
  const resetarPeso = useCallback(() => {
    imagensContadas.current = '';
    setBytesDasImagens(0);
  }, []);

  return { bytesDasImagens, calculandoPeso, recalcularPesoDoTexto, resetarPeso };
}
