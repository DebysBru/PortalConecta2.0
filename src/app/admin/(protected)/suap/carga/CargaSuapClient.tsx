'use client';

import React, { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertCircle, AlertTriangle, ArrowLeft, CalendarCheck, CheckCircle2, ClipboardCopy, Download,
  ExternalLink, FileJson, Info, Loader2, RefreshCw, ShieldAlert, Upload,
} from 'lucide-react';
import {
  previsualizarCargaSuap, confirmarCargaSuap, type PreviaCarga, type ResultadoCarga,
} from '@/actions/suap-carga';
import type { SyncResult } from '@/lib/suap-sync';
import type { ContextoCarga, UltimaCarga } from '@/lib/suap-carga-contexto';
import { LIMITE_CAPTURA_BYTES } from '@/lib/suap-limites';
import { useAuth } from '@/contexts/AuthContext';
import { useMensagemErro } from '@/lib/use-mensagem-erro';

/** Depois de quantos dias o guia avisa que a carga semanal está atrasada. */
const DIAS_ATE_ATRASAR = 8;

const LISTAS_SUAP = [
  { rotulo: 'Editais de pesquisa', url: 'https://suap.ifpr.edu.br/pesquisa/editais/' },
  { rotulo: 'Editais de projetos (extensão)', url: 'https://suap.ifpr.edu.br/projetos/editais/' },
  { rotulo: 'Editais de projetos de ensino', url: 'https://suap.ifpr.edu.br/projetos_ensino/editais/' },
];

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function quandoFoi(carga: UltimaCarga | null): { texto: string; atrasada: boolean } {
  if (!carga) return { texto: 'Nenhuma carga feita ainda', atrasada: true };
  const dias = diasDesde(carga.em);
  const data = new Date(carga.em).toLocaleDateString('pt-BR');
  const relativo = dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
  return { texto: `${data} (${relativo})`, atrasada: dias >= DIAS_ATE_ATRASAR };
}

/**
 * Carga semanal do SUAP: guia passo a passo + importação.
 *
 * O SUAP está atrás de um AWS WAF que desafia o IP do servidor (ver
 * DOCUMENTACAO/SUAP_IMPORTACAO.md), então a leitura acontece no navegador de quem
 * está logado. Um script único captura editais (listas web) e projetos (API), o
 * painel embute nele a lista do que já existe, e a prévia mostra o que é novo
 * antes de gravar.
 */
export function CargaSuapClient({
  codigo, contexto, siglaCampus,
}: { codigo: string; contexto: ContextoCarga | null; siglaCampus: string }) {
  const { isMasterAdmin, userRole } = useAuth();
  const [error, setError] = useMensagemErro();

  const [conteudo, setConteudo] = useState('');
  const [previa, setPrevia] = useState<PreviaCarga | null>(null);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
  const [trazerTudo, setTrazerTudo] = useState(false);
  const [atualizarExistentes, setAtualizarExistentes] = useState(false);
  const [forcar, setForcar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [enviando, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const isMaster = userRole === 'ADMIN' || isMasterAdmin;
  const editaisUltima = quandoFoi(contexto?.ultimaCarga.editais ?? null);
  const projetosUltima = quandoFoi(contexto?.ultimaCarga.projetos ?? null);
  const atrasada = editaisUltima.atrasada || projetosUltima.atrasada;

  const tamanhoBytes = useMemo(() => (conteudo ? new Blob([conteudo]).size : 0), [conteudo]);
  const grandeDemais = tamanhoBytes > LIMITE_CAPTURA_BYTES;

  /** Código que vai para o Console: o script, com a lista do que o portal já tem na frente. */
  const codigoParaCopiar = useMemo(() => {
    if (trazerTudo || !contexto) return codigo;
    return `window.__portalConectaConhecidos = ${JSON.stringify(contexto.conhecidos)};\n${codigo}`;
  }, [codigo, contexto, trazerTudo]);

  if (!isMaster) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-gray-500">A carga do SUAP é restrita ao Administrador Geral.</p>
      </div>
    );
  }

  const mensagemDeFalha = (erro: unknown) => {
    const texto = erro instanceof Error ? erro.message : String(erro);
    if (/Body exceeded|413|body size limit/i.test(texto)) {
      return (
        `A captura é grande demais para o envio (${(tamanhoBytes / 1024 / 1024).toFixed(1)} MB; limite ${LIMITE_CAPTURA_BYTES / 1024 / 1024} MB). ` +
        'Use o código copiado deste painel: ele já traz só o que é novo e o arquivo fica pequeno.'
      );
    }
    return texto || 'Não conseguimos falar com o servidor agora. Tente novamente em alguns instantes.';
  };

  const limpar = () => {
    setConteudo(''); setPrevia(null); setResultado(null); setError('');
    setAtualizarExistentes(false); setForcar(false);
  };

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(codigoParaCopiar);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 4000);
    } catch {
      setError('O navegador bloqueou a cópia. Abra o código abaixo, selecione tudo e copie com Ctrl+C.');
    }
  };

  const analisar = (texto: string) => {
    setError('');
    setPrevia(null);
    setResultado(null);

    const bytes = new Blob([texto]).size;
    if (bytes === 0) { setError('O conteúdo está vazio. Confira o que foi colado.'); return; }
    if (bytes > LIMITE_CAPTURA_BYTES) {
      setError(
        `Esta captura tem ${(bytes / 1024 / 1024).toFixed(1)} MB e o limite é ${LIMITE_CAPTURA_BYTES / 1024 / 1024} MB. ` +
        'Rode o script de novo com o código copiado deste painel — ele já traz só o que é novo.',
      );
      return;
    }

    startTransition(async () => {
      try {
        const resposta = await previsualizarCargaSuap(texto);
        if (resposta.ok) setPrevia(resposta);
        else setError(resposta.error);
      } catch (erro) {
        setError(mensagemDeFalha(erro));
      }
    });
  };

  const lerArquivo = async (arquivo: File) => {
    setLendo(true);
    setError('');
    try {
      if (arquivo.size > LIMITE_CAPTURA_BYTES) {
        setError(`“${arquivo.name}” tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB e o limite é ${LIMITE_CAPTURA_BYTES / 1024 / 1024} MB.`);
        return;
      }
      const texto = await arquivo.text();
      setConteudo(texto);
      analisar(texto);
    } catch {
      setError('Não conseguimos ler o arquivo. Use o .json gerado pelo script.');
    } finally {
      setLendo(false);
    }
  };

  const confirmar = () => {
    setError('');
    startTransition(async () => {
      try {
        const resposta = await confirmarCargaSuap(conteudo, { atualizarExistentes, forcar: atualizarExistentes && forcar });
        if (resposta.ok) { setResultado(resposta); setPrevia(null); }
        else setError(resposta.error);
      } catch (erro) {
        setError(mensagemDeFalha(erro));
      }
    });
  };

  const novosNaPrevia = (previa?.editais?.novos ?? 0) + (previa?.projetos?.novos ?? 0);
  const existentesNaPrevia = (previa?.editais?.existentes ?? 0) + (previa?.projetos?.existentes ?? 0);
  const aGravar = atualizarExistentes ? novosNaPrevia + existentesNaPrevia : novosNaPrevia;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div>
        <Link href="/admin/suap" className="mb-2 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-azul-eletrico">
          <ArrowLeft className="h-4 w-4" />
          Voltar para a Sincronização SUAP
        </Link>
        <h1 className="text-2xl font-black text-gray-900">Carga semanal do SUAP</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Traz para o portal os <strong>editais</strong> e os <strong>projetos</strong> do campus {siglaCampus} que ainda não
          estão aqui. Leva uns 5 minutos, uma vez por semana, e não precisa de token nem de API oficial.
        </p>
      </div>

      {/* Quando foi a última carga */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { rotulo: 'Editais', carga: contexto?.ultimaCarga.editais ?? null, quando: editaisUltima, total: contexto?.totais.editaisSuap },
          { rotulo: 'Projetos', carga: contexto?.ultimaCarga.projetos ?? null, quando: projetosUltima, total: contexto?.totais.projetos },
        ].map((item) => (
          <div
            key={item.rotulo}
            className={`rounded-2xl border p-4 ${item.quando.atrasada ? 'border-amber-200 bg-amber-50' : 'border-green-100 bg-green-50'}`}
          >
            <div className="flex items-center gap-2">
              <CalendarCheck className={`h-4 w-4 ${item.quando.atrasada ? 'text-amber-600' : 'text-green-600'}`} />
              <p className="text-sm font-semibold text-gray-900">Última carga de {item.rotulo.toLowerCase()}</p>
            </div>
            <p className="mt-1 text-lg font-black text-gray-900">{item.quando.texto}</p>
            <p className="text-xs text-gray-600">
              {item.carga ? `${item.carga.novos} registro(s) gravado(s) naquela carga. ` : ''}
              {typeof item.total === 'number' ? `${item.total} ${item.rotulo === 'Editais' ? 'edital(is) do SUAP' : 'projeto(s) do SUAP'} no portal.` : ''}
            </p>
          </div>
        ))}
      </div>
      {atrasada && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <p>
            <strong>Está na hora da carga.</strong> Siga o passo a passo abaixo. Se a última carga foi há mais de uma semana,
            nada se perde: o script compara com o que o portal já tem, não com a data.
          </p>
        </div>
      )}

      {/* Passo 1 */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-azul-eletrico text-sm font-bold text-white">1</span>
            <h2 className="font-bold text-gray-900">Capture no SUAP</h2>
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
              href="/modelos/capturar-suap-semanal.js"
              download
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Baixar o script
            </a>
          </div>
        </div>

        <ol className="mb-4 space-y-2.5 text-sm text-gray-600">
          <li>
            <strong>1.</strong> Clique em <strong>Copiar o código da captura</strong> (acima).
          </li>
          <li>
            <strong>2.</strong> Abra o SUAP (<a href="https://suap.ifpr.edu.br" target="_blank" rel="noopener noreferrer" className="text-azul-eletrico hover:underline">suap.ifpr.edu.br</a>) e
            entre com a sua conta, normalmente. <em>Deixe essa aba aberta.</em>
          </li>
          <li>
            <strong>3.</strong> Aperte <code className="rounded bg-gray-100 px-1">F12</code> e abra a aba <strong>Console</strong>.
            No Chrome e no Edge, na primeira vez, o navegador pede para digitar{' '}
            <code className="rounded bg-gray-100 px-1">allow pasting</code> e Enter antes de aceitar código colado — é uma trava dele, não um erro.
          </li>
          <li>
            <strong>4.</strong> Cole o código (<code className="rounded bg-gray-100 px-1">Ctrl+V</code>) e aperte <strong>Enter</strong>. Acompanhe as mensagens
            <code className="mx-1 rounded bg-gray-100 px-1">[Portal Conecta]</code>; leva de 10 segundos a 2 minutos.
          </li>
          <li>
            <strong>5.</strong> Quando aparecer <strong>✅ Captura pronta</strong>, o resultado já está na sua área de transferência
            (se o navegador bloquear, ele baixa um arquivo .json). Volte para esta página.
          </li>
        </ol>

        <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
          <p className="mb-2 font-semibold text-gray-800">O que o script lê (só leitura, na sua sessão)</p>
          <ul className="space-y-1">
            {LISTAS_SUAP.map((lista) => (
              <li key={lista.url} className="flex flex-wrap items-center gap-1.5">
                {lista.rotulo}:{' '}
                <a href={lista.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-azul-eletrico hover:underline">
                  {lista.url.replace('https://', '')} <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
            <li>Projetos de extensão e de pesquisa: pela API do SUAP, usando a mesma sessão.</li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            Sempre filtrado pelo campus <strong>{siglaCampus}</strong>. O script só faz <code>GET</code> no próprio SUAP e não envia nada a
            lugar nenhum; os endereços dos PDFs (temporários e assinados) não são copiados.
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={trazerTudo}
            onChange={(e) => setTrazerTudo(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-azul-eletrico"
          />
          <span>
            Trazer <strong>também o que já existe</strong> no portal (só se você pretende atualizar os registros — o arquivo fica maior).
            Desmarcado, o código copiado já leva dentro a lista do que o portal tem
            {contexto ? ` (${contexto.conhecidos.editais.length} editais e ${contexto.conhecidos.projetos.length} projetos)` : ''} e o script
            traz só o que é novo.
          </span>
        </label>
        {!contexto && (
          <p className="mt-2 flex items-center gap-2 text-xs text-amber-700">
            <AlertCircle className="h-3.5 w-3.5" />
            Não consegui ler a lista do que o portal já tem; o script vai trazer tudo e o portal descarta o repetido na hora de gravar.
          </p>
        )}

        <details className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">
            Ver o código que vai ser colado no Console ({codigo.split('\n').length} linhas)
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100">{codigo}</pre>
        </details>
      </section>

      {/* Passo 2 */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-azul-eletrico text-sm font-bold text-white">2</span>
          <h2 className="font-bold text-gray-900">Traga o resultado para o portal</h2>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json,.txt"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void lerArquivo(arquivo);
            e.target.value = '';
          }}
        />
        <textarea
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder='Cole aqui o que o script copiou (começa com {"origem":"captura-suap-navegador"...})'
          rows={5}
          className="input-field font-mono text-xs"
        />
        {conteudo && (
          <p className={`mt-2 text-xs ${grandeDemais ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
            {tamanhoBytes < 102400 ? `${Math.max(1, Math.round(tamanhoBytes / 1024))} KB` : `${(tamanhoBytes / 1024 / 1024).toFixed(1)} MB`} carregado
            {grandeDemais ? ` — acima do limite de ${LIMITE_CAPTURA_BYTES / 1024 / 1024} MB` : ` (limite: ${LIMITE_CAPTURA_BYTES / 1024 / 1024} MB)`}
          </p>
        )}

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
            disabled={!conteudo.trim() || enviando}
            className="inline-flex items-center gap-2 rounded-xl bg-hero-gradient px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-95 disabled:opacity-60"
          >
            {enviando && !previa ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Conferir
          </button>
          {conteudo && (
            <button type="button" onClick={limpar} className="text-sm text-gray-500 hover:text-gray-900">Limpar</button>
          )}
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Passo 3 */}
      {previa && (
        <section className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-azul-eletrico text-sm font-bold text-white">3</span>
            <h2 className="font-bold text-gray-900">Confira antes de gravar</h2>
          </div>

          {previa.problemasDoScript.length > 0 && (
            <div className="mb-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">O script avisou de problemas — o que falhou não está neste arquivo:</p>
              {previa.problemasDoScript.map((p) => (
                <p key={p} className="flex items-start gap-2 text-xs text-amber-900">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />{p}
                </p>
              ))}
              <p className="text-xs text-amber-800">Veja &quot;Se der problema&quot; mais abaixo. Dá para importar o que veio e repetir a captura depois.</p>
            </div>
          )}

          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <BlocoPrevia titulo="Editais" dados={previa.editais} ignorados={previa.ignoradosNoScript.editais} />
            <BlocoPrevia titulo="Projetos" dados={previa.projetos} ignorados={previa.ignoradosNoScript.projetos} />
          </div>

          {previa.avisos.length > 0 && (
            <div className="mb-4 space-y-1 rounded-xl border border-amber-100 bg-amber-50 p-3">
              {previa.avisos.map((aviso) => (
                <p key={aviso} className="flex items-start gap-2 text-xs text-amber-900">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />{aviso}
                </p>
              ))}
            </div>
          )}

          {novosNaPrevia === 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Nada de novo nesta semana. Mesmo assim vale registrar: a data da carga fica salva e o aviso de atraso some.</span>
            </div>
          )}

          <label className="mb-2 flex items-start gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={atualizarExistentes}
              onChange={(e) => { setAtualizarExistentes(e.target.checked); if (!e.target.checked) setForcar(false); }}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-azul-eletrico"
            />
            <span>
              Atualizar também os <strong>{existentesNaPrevia}</strong> que já existem no portal. Desmarcado (o normal), eles não são tocados.
            </span>
          </label>
          {atualizarExistentes && (
            <label className="mb-2 ml-6 flex items-start gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={forcar}
                onChange={(e) => setForcar(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-azul-eletrico"
              />
              <span>Sobrescrever também o que foi <strong>editado à mão no portal</strong> depois da última carga. Desmarcado, essas edições são preservadas.</span>
            </label>
          )}

          <button
            type="button"
            onClick={confirmar}
            disabled={enviando}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-hero-gradient px-6 py-3 font-semibold text-white shadow-lg transition-all hover:opacity-95 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {aGravar > 0 ? `Importar ${aGravar} registro${aGravar !== 1 ? 's' : ''}` : 'Registrar a carga (nada novo)'}
          </button>
        </section>
      )}

      {resultado && <ResultadoDaCarga resultado={resultado} />}

      <SeDerProblema siglaCampus={siglaCampus} />
    </div>
  );
}

// ─── Partes da tela ────────────────────────────────────────────────────────────

function BlocoPrevia({
  titulo, dados, ignorados,
}: {
  titulo: string;
  ignorados: number;
  dados: PreviaCarga['editais'] | PreviaCarga['projetos'];
}) {
  if (!dados) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <p className="font-semibold text-gray-900">{titulo}</p>
        <p className="mt-1 text-sm text-gray-500">Não vieram neste arquivo (o script não conseguiu ler esta parte). Nada será registrado para eles.</p>
      </div>
    );
  }

  const amostra = dados.amostra as { titulo: string; novo: boolean }[];
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="mb-2 font-semibold text-gray-900">{titulo}</p>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-green-50 p-2"><p className="text-xl font-black text-green-700">{dados.novos}</p><p className="text-[11px] text-gray-600">novos</p></div>
        <div className="rounded-lg bg-gray-50 p-2"><p className="text-xl font-black text-gray-700">{dados.existentes}</p><p className="text-[11px] text-gray-600">já no portal</p></div>
        <div className="rounded-lg bg-gray-50 p-2"><p className="text-xl font-black text-gray-700">{ignorados}</p><p className="text-[11px] text-gray-600">descartados pelo script</p></div>
      </div>
      {dados.outroCampus > 0 && (
        <p className="mb-2 text-xs text-gray-500">{dados.outroCampus} de outro(s) campus foram ignorados.</p>
      )}
      {dados.erros.length > 0 && (
        <details className="mb-2 rounded-lg border border-red-100 bg-red-50 p-2">
          <summary className="cursor-pointer text-xs font-semibold text-red-700">{dados.erros.length} item(ns) com problema (não serão importados)</summary>
          <div className="mt-1 max-h-28 space-y-0.5 overflow-auto">
            {dados.erros.map((erro, i) => <p key={i} className="text-xs text-red-700">Item {erro.indice}: {erro.motivo}</p>)}
          </div>
        </details>
      )}
      {amostra.length > 0 ? (
        <ul className="max-h-56 space-y-1 overflow-auto text-sm">
          {amostra.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${item.novo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {item.novo ? 'novo' : 'já tem'}
              </span>
              <span className="text-gray-800">{item.titulo}</span>
            </li>
          ))}
          {dados.total > amostra.length && <li className="text-xs text-gray-500">… e mais {dados.total - amostra.length}.</li>}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Nenhum item neste arquivo.</p>
      )}
    </div>
  );
}

function ResultadoDaCarga({ resultado }: { resultado: ResultadoCarga }) {
  const partes: [string, SyncResult | null][] = [['Editais', resultado.editais], ['Projetos', resultado.projetos]];
  const erros = (resultado.editais?.erros ?? 0) + (resultado.projetos?.erros ?? 0);

  return (
    <section className="rounded-2xl border border-green-100 bg-green-50 p-6">
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <h2 className="font-bold text-gray-900">Carga concluída</h2>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        {partes.map(([nome, r]) => (
          <div key={nome} className="rounded-xl border border-green-100 bg-white p-4">
            <p className="mb-2 font-semibold text-gray-900">{nome}</p>
            {r ? (
              <>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    ['Recebidos', r.total], ['Criados', r.criados], ['Atualizados', r.atualizados],
                    [r.ignorados ? 'Já tinha' : 'Preservados', r.ignorados ? r.ignorados : r.preservados],
                  ].map(([rotulo, valor]) => (
                    <div key={String(rotulo)}><p className="text-xl font-black text-gray-900">{valor}</p><p className="text-[11px] text-gray-500">{rotulo}</p></div>
                  ))}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-gray-700">Ver o relatório ({r.detalhes.length} linhas)</summary>
                  <div className="mt-2 max-h-48 space-y-1 overflow-auto">
                    {r.detalhes.map((linha, i) => <p key={i} className="text-xs text-gray-600">{linha}</p>)}
                  </div>
                </details>
              </>
            ) : (
              <p className="text-sm text-gray-500">Esta parte não veio no arquivo; nada foi registrado.</p>
            )}
          </div>
        ))}
      </div>

      {erros > 0 && (
        <p className="mb-3 flex items-center gap-2 text-sm text-red-700">
          <ShieldAlert className="h-4 w-4" />
          {erros} registro(s) não puderam ser gravados — os demais foram. Veja o relatório.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/editais" className="inline-flex items-center gap-2 rounded-xl bg-hero-gradient px-5 py-2.5 text-sm font-semibold text-white">Revisar os editais</Link>
        <Link href="/admin/projetos" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Revisar os projetos</Link>
      </div>
    </section>
  );
}

function SeDerProblema({ siglaCampus }: { siglaCampus: string }) {
  const itens: [string, React.ReactNode][] = [
    [
      'Apareceu CAPTCHA / “Human Verification”',
      <>O SUAP pediu para provar que você é humano. Recarregue a aba do SUAP (F5), resolva o desafio, confirme que continua logado e cole o código de novo.</>,
    ],
    [
      '“Você não está logado no SUAP nesta aba”',
      <>O script usa a sua sessão. Entre no SUAP nessa mesma aba, espere a página inicial carregar e rode de novo. Rode sempre numa aba do <code>suap.ifpr.edu.br</code>, nunca em outro site.</>,
    ],
    [
      'O Console não deixa colar',
      <>No Chrome/Edge digite <code>allow pasting</code> e Enter, e cole de novo. É uma proteção do navegador, só é pedida uma vez.</>,
    ],
    [
      'O script diz que o “layout do SUAP pode ter mudado”',
      <>As listas de editais são lidas do HTML do SUAP (não existe API para isso). Se o SUAP mudar a página, o script <strong>avisa em vez de importar errado</strong> — e a parte que funcionou ainda pode ser importada. Avise a equipe técnica com a mensagem do Console; o ajuste é no arquivo <code>public/modelos/capturar-suap-semanal.js</code>.</>,
    ],
    [
      'Nenhum projeto do campus apareceu',
      <>O script lista no Console as siglas de campus que encontrou. Se a sua for outra que não <strong>{siglaCampus}</strong>, rode antes <code>window.__portalConectaCampus = &apos;SIGLA&apos;</code>.</>,
    ],
    [
      'O navegador não copiou o resultado',
      <>Ele baixa um arquivo <code>.json</code> sozinho. Use “Escolher o arquivo .json” no passo 2.</>,
    ],
    [
      'Um edital que mudei no SUAP apareceu duplicado',
      <>Como o SUAP não mostra um código para o edital, o portal o reconhece pelo <strong>título + ano de abertura das inscrições</strong>. Se o título (ou o ano) for alterado no SUAP, ele chega como edital novo — arquive o antigo em <Link href="/admin/editais" className="text-azul-eletrico hover:underline">Editais</Link>.</>,
    ],
  ];

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6">
      <h2 className="mb-1 font-bold text-gray-900">Se der problema</h2>
      <p className="mb-4 text-sm text-gray-500">
        Como funciona o “só os novos”: o código que você copia leva dentro a lista do que o portal já tem; o script descarta esses itens, e o
        portal confere de novo ao gravar. A <em>data</em> da última carga é só informativa — os editais do SUAP não trazem data de publicação, então
        comparar por data poderia perder um edital novo cujas inscrições já começaram.
      </p>
      <div className="space-y-2">
        {itens.map(([titulo, corpo]) => (
          <details key={titulo} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-800">{titulo}</summary>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{corpo}</p>
          </details>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-500">
        A alternativa definitiva — a TI do IFPR liberar o IP do portal no WAF — está descrita em <code>DOCUMENTACAO/SUAP_IMPORTACAO.md</code>.
      </p>
    </section>
  );
}
