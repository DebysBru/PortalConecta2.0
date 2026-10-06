'use client';

import React, { useRef, useState } from 'react';
import {
  Paperclip, Upload, Trash2, Loader2, AlertCircle, FileText, FileArchive, CheckCircle,
} from 'lucide-react';
import { enviarArquivo } from '@/lib/upload-midia';
import {
  LIMITE_POST_BYTES, formatarMb, resumoDoPeso, somarBytes, mensagemPesoExcedido,
  type MidiaDoPost,
} from '@/lib/post-midias';

/**
 * Anexos do post (PDF, ZIP, RAR) + o indicador de peso do post inteiro.
 *
 * O limite é do POST, não de cada arquivo: o componente mostra a soma (imagens
 * que já estão no texto + anexos) o tempo todo, para o professor não descobrir
 * o estouro só na hora de salvar. Quem decide de verdade é o servidor, que
 * refaz a conta lendo o tamanho de cada arquivo no disco.
 *
 * O arquivo sobe assim que é escolhido (não no salvar do post): assim o
 * professor vê na hora se passou do limite e o salvamento fica rápido. Efeito
 * colateral aceito: arquivo enviado e depois removido da lista continua no
 * disco até alguém limpar — nenhum post aponta para ele.
 */
export function PostAnexosUploader({
  obterToken,
  subpasta,
  anexos,
  onChange,
  bytesNoTexto,
  carregandoPeso,
}: {
  /** Devolve um ID token do Firebase fresco (o upload é autenticado por ele). */
  obterToken: () => Promise<string | null>;
  subpasta?: string;
  anexos: MidiaDoPost[];
  onChange: (anexos: MidiaDoPost[]) => void;
  /** Soma das imagens que já estão no texto do post (calculada pelo formulário). */
  bytesNoTexto: number;
  carregandoPeso?: boolean;
}) {
  const inputArquivo = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const totalBytes = bytesNoTexto + somarBytes(anexos);
  const resumo = resumoDoPeso(totalBytes);

  const escolher = () => {
    setErro('');
    inputArquivo.current?.click();
  };

  const enviar = async (arquivos: FileList | null) => {
    if (!arquivos || arquivos.length === 0) return;

    setErro('');
    setEnviando(true);
    const novos: MidiaDoPost[] = [];
    let falha = '';

    try {
      // Token buscado no momento do envio: se o professor deixou o formulário
      // aberto por mais de uma hora, o token em memória já teria expirado.
      const idToken = await obterToken();
      if (!idToken) {
        setErro('Sua sessão expirou. Entre novamente para anexar arquivos.');
        return;
      }

      for (const arquivo of Array.from(arquivos)) {
        const resultado = await enviarArquivo({ arquivo, idToken, subpasta });
        if (!resultado.ok) {
          falha = resultado.error;
          break;
        }
        novos.push({
          path: resultado.data.path,
          url: resultado.data.url,
          nome: resultado.data.nome,
          bytes: resultado.data.bytes,
          mime: resultado.data.mime,
        });
      }

      if (novos.length > 0) onChange([...anexos, ...novos]);
      if (falha) setErro(falha);
    } finally {
      setEnviando(false);
      if (inputArquivo.current) inputArquivo.current.value = '';
    }
  };

  const remover = (path: string) => onChange(anexos.filter((a) => a.path !== path));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={escolher}
          disabled={enviando}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {enviando ? 'Enviando...' : 'Anexar arquivo'}
        </button>

        <span className="text-xs text-gray-500">PDF, ZIP ou RAR — até {formatarMb(LIMITE_POST_BYTES, 0)} no post inteiro</span>
      </div>

      <input
        ref={inputArquivo}
        type="file"
        multiple
        accept=".pdf,.zip,.rar,application/pdf,application/zip,application/vnd.rar"
        className="hidden"
        onChange={(e) => enviar(e.target.files)}
      />

      {/* Indicador de peso: soma as imagens do texto + os anexos. */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={resumo.excedido ? 'text-red-700 font-semibold' : 'text-gray-600'}>
            Peso do post: {formatarMb(totalBytes)} de {formatarMb(LIMITE_POST_BYTES, 0)}
            {carregandoPeso && ' (calculando as imagens do texto...)'}
          </span>
          {!resumo.excedido && (
            <span className="text-gray-400">cabe mais {formatarMb(resumo.restanteBytes)}</span>
          )}
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${resumo.excedido ? 'bg-red-500' : resumo.percentual > 80 ? 'bg-amber-500' : 'bg-azul-eletrico'}`}
            style={{ width: `${Math.max(resumo.percentual, totalBytes > 0 ? 3 : 0)}%` }}
          />
        </div>
        {resumo.excedido && (
          <p className="flex items-start gap-1.5 mt-2 text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {mensagemPesoExcedido(totalBytes)}
          </p>
        )}
      </div>

      {erro && (
        <p className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {erro}
        </p>
      )}

      {anexos.length > 0 && (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {anexos.map((anexo) => (
            <li key={anexo.path} className="flex items-center gap-3 px-3 py-2 bg-white">
              <IconeDoAnexo nome={anexo.nome ?? anexo.path} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800 truncate">{anexo.nome ?? 'arquivo'}</p>
                <p className="text-xs text-gray-400">{formatarMb(anexo.bytes)}</p>
              </div>
              <button
                type="button"
                onClick={() => remover(anexo.path)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Remover este anexo do post"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {anexos.length === 0 && !erro && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <Paperclip className="w-3.5 h-3.5" />
          Nenhum arquivo anexado. As imagens inseridas no texto também contam no limite.
        </p>
      )}
    </div>
  );
}

function IconeDoAnexo({ nome }: { nome: string }) {
  const minusculo = nome.toLowerCase();
  if (minusculo.endsWith('.zip') || minusculo.endsWith('.rar')) {
    return <FileArchive className="w-4 h-4 text-roxo-luminoso flex-shrink-0" />;
  }
  if (minusculo.endsWith('.pdf')) {
    return <FileText className="w-4 h-4 text-azul-eletrico flex-shrink-0" />;
  }
  return <CheckCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />;
}
