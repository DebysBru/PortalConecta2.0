import type { CSSProperties } from 'react';

/**
 * Fundo do cabeçalho/card do projeto.
 *
 * Se o professor (ou o gestor da página) enviou uma capa, ela substitui o
 * gradiente azul sólido. O gradiente escuro por cima mantém o texto branco
 * legível mesmo em fotos claras.
 */
export function estiloDaCapa(
  corPrimaria: string | null | undefined,
  bannerUrl: string | null | undefined,
): CSSProperties {
  const cor = corPrimaria || '#2F52D3';
  const capa = (bannerUrl || '').trim();

  if (!capa) {
    return { background: `linear-gradient(135deg, ${cor} 0%, ${cor}cc 100%)` };
  }

  // A URL vem do nosso storage (`/files/...`) ou de um http(s) validado no
  // servidor. Escapar aspas evita quebrar o `url("...")` do CSS.
  const url = capa.replace(/["\\]/g, '');
  return {
    backgroundImage: `linear-gradient(135deg, rgba(15,23,42,0.55) 0%, ${cor}c9 100%), url("${url}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

export function temCapa(bannerUrl: string | null | undefined): boolean {
  return !!(bannerUrl && bannerUrl.trim());
}
