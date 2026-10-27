'use client';

import React, { useRef, useState } from 'react';
import { AlertCircle, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { enviarArquivo } from '@/lib/upload-midia';
import { estiloDaCapa } from '@/lib/projeto-midia';
import { EditorDeImagem } from '@/components/ui/EditorDeImagem';

type Props = {
  tipo: 'logo' | 'capa';
  valor: string;
  onChange: (url: string) => void;
  nome: string;
  corPrimaria?: string;
  subpasta?: string;
};

/**
 * Upload de logo/capa do PROJETO (não é a capa de post).
 *
 * O arquivo vai para o mesmo storage das mídias de post. A capa é usada no
 * lugar do fundo azul do projeto; a logo aparece nos cards, no detalhe e nos
 * painéis. O professor coordenador e o gestor da página podem enviar.
 */
export function CampoMidiaProjeto({
  tipo,
  valor,
  onChange,
  nome,
  corPrimaria = '#2F52D3',
  subpasta,
}: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [arquivoParaEditar, setArquivoParaEditar] = useState<File | null>(null);

  const ehCapa = tipo === 'capa';
  const rotulo = ehCapa ? 'Capa do projeto' : 'Logo do projeto';
  const arquivoDoPortal = valor.trim().startsWith('/') && !valor.trim().startsWith('//');

  const enviar = async (arquivo: File | null): Promise<boolean> => {
    if (!arquivo) return false;
    setErro('');
    if (!user) {
      setErro('Sua sessão expirou. Entre novamente para enviar a imagem.');
      return false;
    }

    setEnviando(true);
    try {
      const idToken = await user.getIdToken();
      const resultado = await enviarArquivo({ arquivo, idToken, subpasta });
      if (!resultado.ok) {
        setErro(resultado.error);
        return false;
      }
      onChange(resultado.data.url);
      return true;
    } catch {
      setErro('Não conseguimos enviar a imagem agora. Tente novamente.');
      return false;
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-gray-700">{rotulo}</label>
        {valor && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remover
          </button>
        )}
      </div>

      {ehCapa ? (
        <div
          className="h-28 rounded-xl border border-gray-200 overflow-hidden relative"
          style={estiloDaCapa(corPrimaria, valor)}
        >
          {!valor && (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-white/80">
              Sem capa — o fundo azul do projeto continua
            </span>
          )}
        </div>
      ) : (
        <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center text-white font-black text-2xl"
          style={{ backgroundColor: valor ? '#F3F4F6' : corPrimaria }}
        >
          {valor ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={valor} alt={`Logo ${nome}`} className="w-full h-full object-cover" />
          ) : (
            nome.charAt(0)
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0] ?? null;
            e.target.value = '';
            if (arquivo) setArquivoParaEditar(arquivo);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          {enviando ? 'Enviando...' : valor ? 'Trocar' : ehCapa ? 'Enviar capa' : 'Enviar logo'}
        </button>
        {arquivoDoPortal ? (
          <p className="text-xs text-gray-500 break-all flex-1 min-w-[180px]">
            Arquivo do portal: <code className="text-gray-700">{valor}</code>
          </p>
        ) : (
          <input
            type="text"
            inputMode="url"
            className="input-field flex-1 min-w-[180px]"
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ou cole uma URL externa"
          />
        )}
      </div>

      <p className="text-xs text-gray-400">
        {ehCapa
          ? 'Recomendado 2400×1200 px (2:1). Posicione o assunto principal à direita: o logo, o título e o status ficam na faixa esquerda. Evite o canto direito extremo (mascote).'
          : 'Recomendado 512×512 px (1:1), PNG ou WebP com fundo transparente. Deixe cerca de 10% de margem.'}
      </p>
      {erro && (
        <p className="flex items-start gap-1.5 text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {erro}
        </p>
      )}

      {arquivoParaEditar && (
        <EditorDeImagem
          arquivo={arquivoParaEditar}
          tipo={ehCapa ? 'projeto-capa' : 'logo'}
          onCancelar={() => setArquivoParaEditar(null)}
          onConfirmar={async (arquivo) => {
            const ok = await enviar(arquivo);
            if (ok) setArquivoParaEditar(null);
          }}
        />
      )}
    </div>
  );
}
