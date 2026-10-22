'use client';

import React, { useEffect, useRef, useState } from 'react';
import { capaDoPost } from '@/lib/post-capa';

/**
 * Miniatura/capa do post na listagem e no topo do post.
 *
 * Regra: imagem enviada > ícone escolhido > ícone padrão. Nunca fica um
 * retângulo vazio (era o que acontecia nos posts criados pelo painel do
 * professor, que nem campo de imagem tinha).
 *
 * Se a URL da imagem estiver quebrada (por exemplo, alguém colou o link de uma
 * publicação do Instagram em vez do endereço da imagem), o `onError` troca
 * para o ícone escolhido/padrão em vez de deixar o ícone de imagem quebrada
 * ocupando o card.
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
  const [imagemQuebrada, setImagemQuebrada] = useState(false);
  const imagemRef = useRef<HTMLImageElement>(null);
  const capa = capaDoPost(post);
  const capaExibida = imagemQuebrada
    ? capaDoPost({ ...post, imagemUrl: null })
    : capa;

  // A imagem pode falhar ANTES da hidratação (o SSR já entrega o <img>). Nesse
  // caso o `onError` do React não é anexado a tempo e o card fica com o ícone
  // de imagem quebrada. Ao montar, conferimos o estado real do elemento.
  useEffect(() => {
    setImagemQuebrada(false);
    const img = imagemRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setImagemQuebrada(true);
    }
  }, [post.imagemUrl]);

  const caixa =
    tamanho === 'hero'
      ? 'w-full h-56 sm:h-72 rounded-xl overflow-hidden'
      : tamanho === 'compact'
        ? 'w-full h-full rounded-lg overflow-hidden'
        : 'w-full sm:w-48 h-32 flex-shrink-0 rounded-xl overflow-hidden';

  if (capaExibida.tipo === 'imagem') {
    return (
      <div className={`${caixa} bg-gray-100`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imagemRef}
          src={capaExibida.url}
          alt={post.titulo}
          className="w-full h-full object-cover"
          onError={() => setImagemQuebrada(true)}
        />
      </div>
    );
  }

  const { Icone, fundo, cor } = capaExibida.icone;
  const tamanhoIcone = tamanho === 'hero' ? 'w-20 h-20' : tamanho === 'compact' ? 'w-6 h-6' : 'w-10 h-10';

  return (
    <div className={`${caixa} ${fundo} flex items-center justify-center`}>
      <Icone className={`${cor} ${tamanhoIcone}`} aria-hidden="true" />
      <span className="sr-only">Capa: {capaExibida.icone.rotulo}</span>
    </div>
  );
}
