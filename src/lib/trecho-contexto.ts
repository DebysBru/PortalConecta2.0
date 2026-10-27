/**
 * ==============================================================================
 * TRECHO DE TEXTO PARA O CONTEXTO DO CHAT
 * ==============================================================================
 *
 * Duas coisas que estavam erradas no contexto enviado à IFizinha (relatado em
 * 22/10/2026, quando ela respondeu "as descrições que eu tenho aqui estão
 * incompletas (o texto vem cortado)"):
 *
 * 1. **HTML cru.** As 233 descrições de projeto do portal são HTML do editor
 *    rico (`<p style="border:none"><span style="font-family:Calibri">...`). O
 *    chat mandava o HTML e cortava em 200 caracteres — o modelo recebia só a
 *    marcação e o começo da frase.
 * 2. **Corte no meio da frase.** `descricao.slice(0, 200)` termina em qualquer
 *    lugar (média das descrições: 4.421 caracteres; a maior tem 81 mil). O
 *    modelo via "cortado" e avisava a pessoa, o que é pior que simplesmente
 *    responder com o que tem e apontar a página do projeto.
 *
 * Aqui o texto vira texto puro e o corte acontece no fim de uma FRASE, sem
 * reticências — o que chega ao modelo lê como texto normal, não como arquivo
 * truncado.
 */

import { textoSimples } from '@/lib/texto';

/**
 * Devolve um trecho legível de `valor`, de até `limite` caracteres.
 *
 * - remove HTML e entidades (`textoSimples`);
 * - corta preferencialmente no fim de uma frase (`. `, `! `, `? `, quebra de
 *   linha) que esteja na segunda metade do limite;
 * - se não houver fim de frase, corta na última palavra inteira;
 * - nunca adiciona "…" (reticência faz o modelo concluir que faltou conteúdo).
 */
export function trechoParaContexto(valor: unknown, limite: number): string {
  if (typeof valor !== 'string' && typeof valor !== 'number') return '';

  const limpo = textoSimples(valor);
  if (!limpo) return '';
  if (limpo.length <= limite) return limpo;

  const corte = limpo.slice(0, limite);
  const fimDeFrase = Math.max(
    corte.lastIndexOf('. '),
    corte.lastIndexOf('! '),
    corte.lastIndexOf('? '),
    corte.lastIndexOf('; ')
  );

  if (fimDeFrase >= Math.floor(limite * 0.4)) {
    return corte.slice(0, fimDeFrase + 1).trim();
  }

  const ultimoEspaco = corte.lastIndexOf(' ');
  return (ultimoEspaco > 0 ? corte.slice(0, ultimoEspaco) : corte).trim();
}
