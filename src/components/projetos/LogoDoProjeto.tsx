import React from 'react';

/**
 * Logo do projeto usada em TODAS as telas (home, listagem, detalhe, painel do
 * professor e admin). Antes cada card desenhava só a inicial; o detalhe
 * mostrava a imagem — por isso o mesmo projeto aparecia diferente dependendo
 * da tela. O fallback também é único: a inicial sobre a cor do projeto.
 */
export function LogoDoProjeto({
  nome,
  logoUrl,
  className = '',
}: {
  nome: string;
  logoUrl?: string | null;
  className?: string;
}) {
  if (logoUrl && logoUrl.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`Logo ${nome}`}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <span aria-hidden className={className}>
      {nome.charAt(0)}
    </span>
  );
}
