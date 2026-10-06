'use client';

import React, { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowLeft, CheckCircle2, ClipboardCopy, Download, FileJson,
  Info, Loader2, RefreshCw, ShieldAlert, Upload, WifiOff,
} from 'lucide-react';
import {
  previsualizarImportacaoSuap, confirmarImportacaoSuap, type PreviaImportacaoSuap,
} from '@/actions/suap-import';
import type { SyncResult } from '@/lib/suap-sync';
import { useAuth } from '@/contexts/AuthContext';
import { useMensagemErro } from '@/lib/use-mensagem-erro';

/**
 * Importação de projetos do SUAP a partir de uma captura feita no navegador.
 *
 * A tela existe porque o SUAP está atrás de um AWS WAF que desafia o IP do
 * servidor (ver DOCUMENTACAO/SUAP_IMPORTACAO.md): a sincronização automática
 * esbarra no CAPTCHA, mas do navegador logado a API responde. O usuário roda o
 * script de captura, cola o JSON aqui e confere a prévia antes de gravar.
 */
export function ImportarSuapClient({ codigoCaptura, siglaCampus }: { codigoCaptura: string; siglaCampus: string }) {
  const { user, userRole, isMasterAdmin } = useAuth();
  const [error, setError] = useMensagemErro();

  const [conteudo, setConteudo] = useState('');
  const [previa, setPrevia] = useState<PreviaImportacaoSuap | null>(null);
  const [resultado, setResultado] = useState<SyncResult | null>(null);
  const [forcar, setForcar] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [enviando, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const isMaster = userRole === 'ADMIN' || isMasterAdmin;

  const jaColei = useMemo(() => conteudo.trim().length > 0, [conteudo]);

  if (!isMaster) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-gray-500">Importar projetos do SUAP é restrito ao Administrador Geral.</p>
      </div>
    );
  }

  const analisar = (texto: string, arquivo = 'colado no painel') => {
    setError('');
    setPrevia(null);
    setResultado(null);
    startTransition(async () => {
      const resposta = await previsualizarImportacaoSuap(texto);
      if (resposta.ok) {
        setPrevia(resposta);
        setNomeArquivo(arquivo);
      } else {
        setError(resposta.error);
      }
    });
  };

  const lerArquivo = async (arquivo: File) => {
    setLendo(true);
    try {
      const texto = await arquivo.text();
      setConteudo(texto);
      analisar(texto, arquivo.name);
    } catch {
      setError('Não conseguimos ler o arquivo. Use o .json gerado pela captura.');
    } finally {
      setLendo(false);
    }
  };

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(codigoCaptura);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 4000);
    } catch {
      setError('O navegador bloqueou a cópia. Abra o arquivo do script pelo botão de download.');
    }
  };

  const confirmar = () => {
    setError('');
    startTransition(async () => {
      const resposta = await confirmarImportacaoSuap(conteudo, { forcar });
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
      <div>
        <Link
          href="/admin/suap"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-azul-eletrico"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a Sincronização SUAP
        </Link>
        <h1 className="text-2xl font-black text-gray-900">Importar projetos do SUAP</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          A sincronização automática não passa pelo SUAP porque o servidor do portal é desafiado
          pelo WAF deles (CAPTCHA). Do <strong>seu navegador logado</strong> a API responde — este
          é o caminho que funciona hoje.
        </p>
      </div>

      {/* Por que não pelo servidor */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Por que a sincronização direta parou</p>
          <p className="mt-1 leading-relaxed">
            O SUAP responde <code className="rounded bg-white/70 px-1">405</code> com a página
            &quot;Human Verification&quot; para <em>qualquer</em> requisição vinda do nosso servidor
            (o cabeçalho de resposta traz <code className="rounded bg-white/70 px-1">x-amzn-waf-action: captcha</code>).
            Não é problema de token nem de endpoint: o bloqueio acontece antes de a API ver a
            requisição. Quando a TI do IFPR liberar o IP do portal no WAF, a sincronização
            automática volta a funcionar e esta tela continua valendo como alternativa.
          </p>
        </div>
      </div>

      {/* Passo 1 — captura */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-azul-eletrico text-sm font-bold text-white">1</span>
            <h2 className="font-bold text-gray-900">Capture os projetos no SUAP</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copiarCodigo}
              className="inline-flex items-center gap-2 rounded-xl bg-azul-eletrico px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-azul-600"
            >
              {copiado ? <CheckCircle2 className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
              {copiado ? 'Código copiado!' : 'Copiar o código da captura'}
            </button>
            <a
              href="/modelos/capturar-projetos-suap.js"
              download
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Baixar o script
            </a>
          </div>
        </div>

        <ol className="mb-4 space-y-2 text-sm text-gray-600">
          <li>
            <strong>1.</strong> Abra o SUAP (<a href="https://suap.ifpr.edu.br" target="_blank" rel="noopener noreferrer" className="text-azul-eletrico hover:underline">suap.ifpr.edu.br</a>) e
            entre com a sua conta normalmente.
          </li>
          <li><strong>2.</strong> Abra o Console do navegador: <code className="rounded bg-gray-100 px-1">F12</code> → aba <strong>Console</strong>.</li>
          <li>
            <strong>3.</strong> Cole o código (botão acima) e aperte <strong>Enter</strong>. Ele busca as páginas de
            extensão e pesquisa usando a sua própria sessão — <strong>nenhum token é necessário</strong> — e{' '}
            <strong>já traz só os projetos do campus {siglaCampus}</strong> (por isso o arquivo sai pequeno). Se a
            API aceitar filtrar por campus, ele aproveita; se não aceitar, ele percorre as páginas e filtra aqui.
          </li>
          <li><strong>4.</strong> Ao terminar, o JSON já está na área de transferência (se o navegador bloquear, ele baixa o arquivo). Volte aqui e cole no passo 2.</li>
        </ol>

        <p className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
          Precisa capturar <strong>outro campus</strong>? Rode antes no Console:{' '}
          <code className="rounded bg-white px-1">{`window.__portalConectaCampus = 'SIGLA'`}</code> e depois o script.
          Se nenhum projeto do campus aparecer, o próprio script lista as siglas que encontrou no SUAP.
        </p>

        <details className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">
            Ver o código que vai ser colado no Console ({codigoCaptura.split('\n').length} linhas)
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100">
            {codigoCaptura}
          </pre>
          <p className="mt-2 text-xs text-gray-500">
            O script só faz <code>GET</code> em <code>/api/extensao/projetos/</code> e{' '}
            <code>/api/pesquisa/projetos/</code> do próprio SUAP e junta o resultado. Ele não envia
            nada para lugar nenhum.
          </p>
        </details>
      </div>

      {/* Passo 2 — importar */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-azul-eletrico text-sm font-bold text-white">2</span>
          <h2 className="font-bold text-gray-900">Traga a captura para o portal</h2>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json,.txt"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void lerArquivo(arquivo);
          }}
        />

        <textarea
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder='Cole aqui o JSON da captura (começa com {"origem":"captura-suap-navegador"...})'
          rows={6}
          className="input-field font-mono text-xs"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={lendo}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-60"
          >
            {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
            Escolher o arquivo .json
          </button>
          <button
            type="button"
            onClick={() => analisar(conteudo)}
            disabled={!jaColei || enviando}
            className="inline-flex items-center gap-2 rounded-xl bg-hero-gradient px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-95 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Conferir a captura
          </button>
          {jaColei && (
            <button
              type="button"
              onClick={() => { setConteudo(''); setPrevia(null); setResultado(null); setError(''); }}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {previa && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-azul-eletrico text-sm font-bold text-white">3</span>
            <h2 className="font-bold text-gray-900">Confira antes de gravar</h2>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { rotulo: 'Projetos na captura', valor: previa.analise.projetos.length, cor: 'text-gray-900' },
              { rotulo: 'Novos', valor: previa.novos, cor: 'text-green-600' },
              { rotulo: 'Já existem (serão atualizados)', valor: previa.existentes, cor: 'text-azul-eletrico' },
              { rotulo: 'Itens com problema', valor: previa.analise.erros.length, cor: previa.analise.erros.length ? 'text-red-600' : 'text-gray-400' },
            ].map((item) => (
              <div key={item.rotulo} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className={`text-2xl font-black ${item.cor}`}>{item.valor}</p>
                <p className="text-xs text-gray-500">{item.rotulo}</p>
              </div>
            ))}
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Por fonte</p>
              {Object.entries(previa.analise.resumo.porFonte).map(([fonte, total]) => (
                <p key={fonte} className="text-sm text-gray-600">
                  {fonte === 'pesquisa' ? 'Pesquisa' : 'Extensão'}: <strong className="text-gray-900">{total}</strong>
                </p>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Por situação</p>
              {Object.entries(previa.analise.resumo.porSituacao).slice(0, 6).map(([situacao, total]) => (
                <p key={situacao} className="truncate text-sm text-gray-600">
                  {situacao}: <strong className="text-gray-900">{total}</strong>
                </p>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Por campus</p>
              {Object.entries(previa.analise.resumo.porCampus).slice(0, 6).map(([campus, total]) => (
                <p key={campus} className="truncate text-sm text-gray-600">
                  {campus}: <strong className="text-gray-900">{total}</strong>
                </p>
              ))}
            </div>
          </div>

          <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Deste arquivo, <strong>{previa.analise.resumo.noCampusAlvo}</strong> são do campus{' '}
              <strong>{previa.analise.resumo.siglaAlvo}</strong> — os outros ficam de fora (a API do
              SUAP não filtra por campus, então o filtro é feito aqui).
            </span>
          </div>

          {previa.analise.avisos.length > 0 && (
            <div className="mb-4 space-y-1 rounded-xl border border-amber-100 bg-amber-50 p-3">
              {previa.analise.avisos.map((aviso) => (
                <p key={aviso} className="flex items-start gap-2 text-xs text-amber-900">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {aviso}
                </p>
              ))}
            </div>
          )}

          {previa.analise.erros.length > 0 && (
            <details className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-red-700">
                {previa.analise.erros.length} item(ns) que não serão importados
              </summary>
              <div className="mt-2 max-h-40 space-y-1 overflow-auto">
                {previa.analise.erros.map((erro, i) => (
                  <p key={i} className="text-xs text-red-700">
                    Item {erro.indice}: {erro.motivo}
                  </p>
                ))}
              </div>
            </details>
          )}

          <div className="mb-4 overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Fonte</th>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2">Campus</th>
                </tr>
              </thead>
              <tbody>
                {previa.analise.projetos.slice(0, 12).map((projeto) => (
                  <tr key={`${projeto._fonte}-${projeto.id}`} className="border-t border-gray-50">
                    <td className="px-3 py-2 text-gray-500">{projeto.id}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{projeto._fonte}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{projeto.titulo}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{projeto.situacao ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{projeto.campus_sigla ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previa.analise.projetos.length > 12 && (
              <p className="border-t border-gray-50 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Mostrando 12 de {previa.analise.projetos.length} projetos.
              </p>
            )}
          </div>

          <label className="mb-4 flex items-start gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={forcar}
              onChange={(e) => setForcar(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-azul-eletrico"
            />
            <span>
              Sobrescrever também os projetos que foram <strong>editados à mão no portal</strong>{' '}
              depois do último sync. Desmarcado, o portal preserva essas edições e avisa quais foram.
            </span>
          </label>

          <button
            type="button"
            onClick={confirmar}
            disabled={enviando || previa.analise.projetos.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-hero-gradient px-6 py-3 font-semibold text-white shadow-lg transition-all hover:opacity-95 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {previa.analise.projetos.length} projeto{previa.analise.projetos.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {resultado && (
        <div className="rounded-2xl border border-green-100 bg-green-50 p-6">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h2 className="font-bold text-gray-900">Importação concluída</h2>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { rotulo: 'Recebidos', valor: resultado.total },
              { rotulo: 'Criados', valor: resultado.criados },
              { rotulo: 'Atualizados', valor: resultado.atualizados },
              { rotulo: 'Preservados', valor: resultado.preservados },
            ].map((item) => (
              <div key={item.rotulo} className="rounded-xl border border-green-100 bg-white p-3">
                <p className="text-2xl font-black text-gray-900">{item.valor}</p>
                <p className="text-xs text-gray-500">{item.rotulo}</p>
              </div>
            ))}
          </div>
          {resultado.erros > 0 && (
            <p className="mb-3 flex items-center gap-2 text-sm text-red-700">
              <ShieldAlert className="h-4 w-4" />
              {resultado.erros} projeto(s) não puderam ser gravados — os demais foram.
            </p>
          )}
          <details className="mb-4 rounded-xl border border-green-100 bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-700">
              Ver o relatório completo ({resultado.detalhes.length} linhas)
            </summary>
            <div className="mt-2 max-h-64 space-y-1 overflow-auto">
              {resultado.detalhes.map((linha, i) => (
                <p key={i} className="text-xs text-gray-600">{linha}</p>
              ))}
            </div>
          </details>
          <div className="flex flex-wrap gap-3">
            <Link href="/projetos" className="inline-flex items-center gap-2 rounded-xl bg-hero-gradient px-5 py-2.5 text-sm font-semibold text-white">
              Ver os projetos no site
            </Link>
            <Link href="/admin/projetos" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Revisar no painel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
