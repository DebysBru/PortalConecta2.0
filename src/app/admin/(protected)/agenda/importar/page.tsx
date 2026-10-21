'use client';

import React, { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowLeft, Calendar, CheckCircle2, Download, FileSpreadsheet,
  Info, Loader2, Upload, XCircle,
} from 'lucide-react';
import {
  previsualizarImportacao, confirmarImportacao,
  type PreviaImportacao, type ResultadoImportacao,
} from '@/actions/agenda-import';
import { COLUNAS_MODELO } from '@/lib/agenda-import';
import { useAuth } from '@/contexts/AuthContext';
import { useMensagemErro } from '@/lib/use-mensagem-erro';

/**
 * Tela de importação do calendário (painel → Agenda → Importar).
 *
 * Duas etapas de propósito: a prévia mostra quantos eventos vêm, quantos já
 * existem pela `ref`, o intervalo de datas e os erros linha a linha — ninguém
 * grava 110 eventos sem ver o que está entrando. A gravação é idempotente: a
 * mesma `ref` atualiza o evento existente.
 */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function ImportarCalendarioPage() {
  const { user, userRole, isMasterAdmin } = useAuth();
  const [error, setError] = useMensagemErro();

  const [nomeArquivo, setNomeArquivo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [atualizarExistentes, setAtualizarExistentes] = useState(true);
  const [enviando, startTransition] = useTransition();
  const [lendo, setLendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMaster = userRole === 'ADMIN' || isMasterAdmin;

  if (!isMaster) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-gray-500">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const lerArquivo = async (arquivo: File) => {
    setLendo(true);
    setError('');
    setPrevia(null);
    setResultado(null);
    try {
      const texto = await arquivo.text();
      setNomeArquivo(arquivo.name);
      setConteudo(texto);
      startTransition(async () => {
        const resposta = await previsualizarImportacao(texto, arquivo.name, user?.email ?? '');
        if (resposta.ok) setPrevia(resposta);
        else setError(resposta.error);
      });
    } catch {
      setError('Não conseguimos ler o arquivo. Se for um .xlsx, exporte como CSV (ou salve como JSON) antes de importar.');
    } finally {
      setLendo(false);
    }
  };

  const confirmar = () => {
    startTransition(async () => {
      const resposta = await confirmarImportacao(conteudo, nomeArquivo, user?.email ?? '', {
        atualizarExistentes,
      });
      if (resposta.ok) {
        setResultado(resposta);
        setPrevia(null);
      } else {
        setError(resposta.error);
      }
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/agenda"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-azul-eletrico"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a agenda
          </Link>
          <h1 className="text-2xl font-black text-gray-900">Importar calendário acadêmico</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Envie um arquivo <strong>CSV</strong> ou <strong>JSON</strong> com os eventos. Cada linha
            vira um evento na agenda; a coluna <code className="rounded bg-gray-100 px-1">ref</code>{' '}
            identifica o evento, então reimportar o mesmo arquivo <strong>atualiza</strong> em vez de
            duplicar.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/modelos/calendario-academico-modelo.csv"
            download
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Baixar modelo CSV
          </a>
          <a
            href="/modelos/calendario-ifpr-ivaipora-2026.csv"
            download
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Calendário 2026 pronto
          </a>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Passo 1: arquivo ── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-azul-eletrico text-sm font-bold text-white">
            1
          </span>
          <h2 className="font-bold text-gray-900">Escolha o arquivo</h2>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.json,.txt,text/csv,application/json"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void lerArquivo(arquivo);
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={lendo || enviando}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center transition-all hover:border-azul-eletrico/40 hover:bg-azul-50/40 disabled:opacity-60"
        >
          {lendo || enviando ? (
            <Loader2 className="h-7 w-7 animate-spin text-azul-eletrico" />
          ) : (
            <Upload className="h-7 w-7 text-azul-eletrico" />
          )}
          <span className="font-semibold text-gray-900">
            {nomeArquivo ? nomeArquivo : 'Clique para escolher o CSV ou JSON'}
          </span>
          <span className="text-xs text-gray-500">
            O arquivo é lido no seu navegador; nada é gravado antes você confirmar.
          </span>
        </button>

        <details className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">
            Quais colunas o arquivo pode ter?
          </summary>
          <div className="mt-3 space-y-1.5">
            {COLUNAS_MODELO.map((coluna) => (
              <p key={coluna.chave} className="text-xs text-gray-600">
                <code className="rounded bg-white px-1.5 py-0.5 font-semibold text-gray-900">
                  {coluna.rotulo}
                </code>
                {coluna.obrigatoria && <span className="ml-1 font-semibold text-rosa-600">obrigatória</span>}
                {' — '}
                {coluna.ajuda}
              </p>
            ))}
            <p className="pt-1 text-xs text-gray-500">
              Separador aceito: <code>;</code>, <code>,</code> ou TAB. Datas em{' '}
              <code>DD/MM/AAAA</code> ou <code>AAAA-MM-DD</code>. Linhas começando com{' '}
              <code>#</code> são ignoradas (dá para comentar o arquivo).
            </p>
          </div>
        </details>
      </div>

      {/* ── Passo 2: prévia ── */}
      {previa && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-azul-eletrico text-sm font-bold text-white">
              2
            </span>
            <h2 className="font-bold text-gray-900">Confira antes de gravar</h2>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { rotulo: 'Eventos no arquivo', valor: previa.analise.linhas.length, cor: 'text-gray-900' },
              { rotulo: 'Novos', valor: previa.novos, cor: 'text-green-600' },
              { rotulo: 'Já existem (serão atualizados)', valor: previa.jaExistem, cor: 'text-azul-eletrico' },
              { rotulo: 'Linhas com problema', valor: previa.analise.erros.length, cor: previa.analise.erros.length ? 'text-red-600' : 'text-gray-400' },
            ].map((item) => (
              <div key={item.rotulo} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className={`text-2xl font-black ${item.cor}`}>{item.valor}</p>
                <p className="text-xs text-gray-500">{item.rotulo}</p>
              </div>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatarData(previa.analise.resumo.primeiraData)} a {formatarData(previa.analise.resumo.ultimaData)}
            </span>
            <span>Formato: {previa.analise.formato.toUpperCase()}{previa.analise.separador ? ` (separador "${previa.analise.separador}")` : ''}</span>
          </div>

          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Por categoria</p>
              <div className="space-y-1">
                {Object.entries(previa.analise.resumo.porCategoria).slice(0, 8).map(([categoria, total]) => (
                  <div key={categoria} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-gray-600">{categoria}</span>
                    <span className="font-semibold text-gray-900">{total}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Por mês</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(previa.analise.resumo.porMes).map(([mes, total]) => {
                  const [ano, numero] = mes.split('-');
                  return (
                    <span key={mes} className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-xs text-gray-600">
                      {MESES[Number(numero) - 1]}/{ano.slice(2)}: <strong className="text-gray-900">{total}</strong>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {previa.analise.avisos.length > 0 && (
            <div className="mb-4 space-y-1 rounded-xl border border-blue-100 bg-blue-50 p-3">
              {previa.analise.avisos.map((aviso) => (
                <p key={aviso} className="flex items-start gap-2 text-xs text-blue-800">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {aviso}
                </p>
              ))}
            </div>
          )}

          {previa.analise.erros.length > 0 && (
            <details className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-red-700">
                {previa.analise.erros.length} linha(s) que não serão importadas
              </summary>
              <div className="mt-2 max-h-48 space-y-1 overflow-auto">
                {previa.analise.erros.map((erro, i) => (
                  <p key={`${erro.linha}-${i}`} className="text-xs text-red-700">
                    Linha {erro.linha}: {erro.motivo}
                  </p>
                ))}
              </div>
            </details>
          )}

          <div className="mb-4 overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2">Público</th>
                </tr>
              </thead>
              <tbody>
                {previa.analise.linhas.slice(0, 12).map((linha) => (
                  <tr key={linha.ref} className="border-t border-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                      {linha.data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                      {linha.dataFim && ` – ${linha.dataFim.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">{linha.titulo}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{linha.tipo}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{linha.categoria ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{linha.publicoAlvo ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previa.analise.linhas.length > 12 && (
              <p className="border-t border-gray-50 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Mostrando 12 de {previa.analise.linhas.length} eventos.
              </p>
            )}
          </div>

          <label className="mb-4 flex items-start gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={atualizarExistentes}
              onChange={(e) => setAtualizarExistentes(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-azul-eletrico"
            />
            <span>
              Atualizar os eventos que já existem (mesma <code>ref</code>). Desmarque para importar
              só o que for novo.
            </span>
          </label>

          <button
            type="button"
            onClick={confirmar}
            disabled={enviando || previa.analise.linhas.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-hero-gradient px-6 py-3 font-semibold text-white shadow-lg transition-all hover:opacity-95 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {previa.analise.linhas.length} evento{previa.analise.linhas.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* ── Resultado ── */}
      {resultado && (
        <div className="rounded-2xl border border-green-100 bg-green-50 p-6">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h2 className="font-bold text-gray-900">Importação concluída</h2>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { rotulo: 'Criados', valor: resultado.criados },
              { rotulo: 'Atualizados', valor: resultado.atualizados },
              { rotulo: 'Sem alteração', valor: resultado.inalterados },
              { rotulo: 'Ignorados', valor: resultado.ignorados },
            ].map((item) => (
              <div key={item.rotulo} className="rounded-xl border border-green-100 bg-white p-3">
                <p className="text-2xl font-black text-gray-900">{item.valor}</p>
                <p className="text-xs text-gray-500">{item.rotulo}</p>
              </div>
            ))}
          </div>
          {resultado.erros.length > 0 && (
            <div className="mb-4 space-y-1">
              {resultado.erros.slice(0, 10).map((erro, i) => (
                <p key={i} className="flex items-start gap-2 text-xs text-red-700">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {erro.linha ? `Linha ${erro.linha}: ` : ''}{erro.motivo}
                </p>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/agenda"
              className="inline-flex items-center gap-2 rounded-xl bg-hero-gradient px-5 py-2.5 text-sm font-semibold text-white"
            >
              <Calendar className="h-4 w-4" />
              Ver a agenda
            </Link>
            <Link
              href="/admin/agenda"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Voltar para o painel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
