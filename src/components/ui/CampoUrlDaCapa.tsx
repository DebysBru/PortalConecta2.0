'use client';

import React from 'react';

/**
 * Campo de URL externa da capa do post.
 *
 * BUG QUE ORIGINOU ESTE COMPONENTE (relatado em 21/10/2026): a imagem enviada
 * do computador é salva em `/files/...` e ficava num `<input type="url">`. O
 * navegador recusa caminho relativo nesse tipo de campo, então o botão Salvar
 * parava com "Insira um URL" mesmo com a imagem já no servidor. Pior: como o
 * campo era a única referência editável, apagar o texto desvinculava a imagem.
 *
 * Regra: caminho do nosso storage (`/files/...`) NÃO é editável — aparece só
 * como informação e a remoção é feita pelo botão "Remover" do seletor de capa.
 * A URL externa continua opcional, num campo de texto (nunca `type="url"`).
 */

/** `true` para caminho servido pelo próprio portal (ex.: `/files/imagens/...`). */
export function ehCaminhoDoStorage(url: string | null | undefined): boolean {
  const valor = (url ?? '').trim();
  // `//host/...` é URL de outro domínio (protocol-relative), não caminho local.
  return valor.startsWith('/') && !valor.startsWith('//');
}

export function CampoUrlDaCapa({
  imagemUrl,
  onChange,
}: {
  imagemUrl: string;
  onChange: (url: string) => void;
}) {
  if (ehCaminhoDoStorage(imagemUrl)) {
    return (
      <p className="mt-3 text-xs text-gray-500 break-all">
        Imagem salva no servidor em <code className="text-gray-700">{imagemUrl}</code>. Use{' '}
        <strong className="font-semibold">Remover</strong> acima para desvincular do post — o
        caminho não precisa ser editado.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <label className="label-field text-xs">ou cole uma URL de imagem externa (opcional)</label>
      <input
        type="text"
        inputMode="url"
        className="input-field"
        value={imagemUrl}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
      />
    </div>
  );
}
