'use client';

import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, AlertCircle, Trash2, Check } from 'lucide-react';
import { ICONES_DE_POST, chaveDeIconeValida, type ChaveIconePost } from '@/lib/post-capa';
import { enviarArquivo } from '@/lib/upload-midia';

/**
 * Seletor de capa do post: uma imagem enviada OU um ícone do catálogo.
 *
 * Os dois são MUTUAMENTE EXCLUSIVOS de propósito: manter imagem e ícone ao mesmo
 * tempo faria o professor escolher um ícone e continuar vendo a foto antiga no
 * card (a imagem tem precedência na renderização). Quem escolhe um, limpa o
 * outro — e o texto abaixo explica isso.
 */
export function SeletorDeCapaDoPost({
  imagemUrl,
  icone,
  onImagem,
  onIcone,
  obterToken,
  subpasta,
}: {
  imagemUrl: string;
  icone: ChaveIconePost | null;
  onImagem: (url: string) => void;
  onIcone: (chave: ChaveIconePost | null) => void;
  obterToken: () => Promise<string | null>;
  subpasta?: string;
}) {
  const inputArquivo = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const escolherArquivo = () => {
    setErro('');
    inputArquivo.current?.click();
  };

  const enviar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro('');
    setEnviando(true);
    try {
      const idToken = await obterToken();
      if (!idToken) {
        setErro('Sua sessão expirou. Entre novamente para enviar a imagem.');
        return;
      }
      const resultado = await enviarArquivo({ arquivo, idToken, subpasta });
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      onImagem(resultado.data.url);
      onIcone(null); // imagem e ícone não convivem
    } finally {
      setEnviando(false);
      if (inputArquivo.current) inputArquivo.current.value = '';
    }
  };

  const removerImagem = () => onImagem('');

  return (
    <div className="space-y-3">
      {/* Imagem */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={escolherArquivo}
          disabled={enviando}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          {enviando ? 'Enviando...' : 'Enviar imagem de capa'}
        </button>

        {imagemUrl && (
          <>
            <div className="w-24 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagemUrl} alt="Prévia da capa" className="w-full h-full object-cover" />
            </div>
            <button
              type="button"
              onClick={removerImagem}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remover
            </button>
          </>
        )}
      </div>

      <input
        ref={inputArquivo}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => enviar(e.target.files?.[0])}
      />

      {erro && (
        <p className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {erro}
        </p>
      )}

      {/* Ícones nativos */}
      <div>
        <p className="text-xs text-gray-500 mb-2">
          Sem foto? Escolha um ícone que diga o tipo da publicação — ele aparece na
          lista de atualizações no lugar da imagem.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {ICONES_DE_POST.map(({ chave, rotulo, descricao, Icone, fundo, cor }) => {
            const selecionado = icone === chave;
            return (
              <button
                key={chave}
                type="button"
                title={descricao}
                aria-pressed={selecionado}
                onClick={() => {
                  // Clicar de novo no ícone escolhido remove a capa: assim dá para
                  // voltar ao padrão sem precisar de outro botão.
                  onIcone(selecionado ? null : chave);
                  if (!selecionado) onImagem('');
                }}
                className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition-colors ${
                  selecionado
                    ? 'border-azul-eletrico bg-azul-eletrico/5'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {selecionado && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-azul-eletrico text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                )}
                <span className={`w-9 h-9 rounded-lg ${fundo} ${cor} flex items-center justify-center`}>
                  <Icone className="w-4 h-4" />
                </span>
                <span className="text-[11px] leading-tight text-gray-700">{rotulo}</span>
              </button>
            );
          })}
        </div>
        {icone && chaveDeIconeValida(icone) && (
          <p className="text-xs text-gray-400 mt-2">
            Ícone escolhido. Clique nele de novo para voltar ao padrão.
          </p>
        )}
      </div>
    </div>
  );
}
