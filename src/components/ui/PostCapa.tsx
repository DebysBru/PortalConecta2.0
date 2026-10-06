import React from 'react';
import { capaDoPost } from '@/lib/post-capa';

/**
 * Miniatura/capa do post na listagem e no topo do post.
 *
 * Regra: imagem enviada > ícone escolhido > ícone padrão. Nunca fica um
 * retângulo vazio (era o que acontecia nos posts criados pelo painel do
 * professor, que nem campo de imagem tinha).
 */
export function PostCapa({
  post,
  tamanho = 'card',
}: {
  post: { titulo: string; imagemUrl?: string | null; icone?: string | null };
  /**
   * `card`   = miniatura 192×128 na lista pública;
   * `hero`   = faixa larga no topo do post;
   * `compact`= preenche o contêiner (usado na lista do painel).
   */
  tamanho?: 'card' | 'hero' | 'compact';
}) {
  const capa = capaDoPost(post);

  const caixa =
    tamanho === 'hero'
      ? 'w-full h-56 sm:h-72 rounded-xl overflow-hidden'
      : tamanho === 'compact'
        ? 'w-full h-full rounded-lg overflow-hidden'
        : 'w-full sm:w-48 h-32 flex-shrink-0 rounded-xl overflow-hidden';

  if (capa.tipo === 'imagem') {
    return (
      <div className={`${caixa} bg-gray-100`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={capa.url} alt={post.titulo} className="w-full h-full object-cover" />
      </div>
    );
  }

  const { Icone, fundo, cor } = capa.icone;
  const tamanhoIcone = tamanho === 'hero' ? 'w-20 h-20' : tamanho === 'compact' ? 'w-6 h-6' : 'w-10 h-10';

  return (
    <div className={`${caixa} ${fundo} flex items-center justify-center`}>
      <Icone className={`${cor} ${tamanhoIcone}`} aria-hidden="true" />
      <span className="sr-only">Capa: {capa.icone.rotulo}</span>
    </div>
  );
}
