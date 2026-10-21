/**
 * Abertura do chat da IFizinha a partir de qualquer lugar da página.
 *
 * O `ChatWidget` vive no layout raiz (renderiza em todas as páginas) e controla
 * o próprio estado de aberto/fechado. Para o botão "Pergunte à IFizinha" do
 * header (e qualquer CTA futuro) conseguir abrir o chat sem transformar o
 * widget num contexto global, os dois combinam um evento no `window`.
 *
 * Assim: nada de provider novo no layout, nada de estado duplicado, e o botão
 * continua funcionando mesmo se o widget mudar de lugar.
 */
export const EVENTO_ABRIR_CHAT = 'ifizinha:abrir-chat';

/** Abre o chat da IFizinha (no-op no servidor). */
export function abrirChatIFizinha(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENTO_ABRIR_CHAT));
}
