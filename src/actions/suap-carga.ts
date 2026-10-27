'use server';

import { prisma } from '@/lib/prisma';
import { getVerifiedServerSession } from '@/lib/session';
import { isAdministradorGeral } from '@/lib/permissions';
import { MENSAGENS } from '@/lib/mensagens';
import { analisarCapturaSuap, tamanhoEmBytes, LIMITE_CAPTURA_BYTES, type ResultadoCaptura } from '@/lib/suap-import';
import { normalizaSiglaSuap } from '@/lib/suap-api';
import { suapIdUnico } from '@/lib/suap-identidade';
import { aplicarEditaisDoSuap, aplicarProjetosDoSuap, type SyncResult } from '@/lib/suap-sync';
import { analisarEditaisCapturados, FONTES_EDITAL, type ResultadoCapturaEditais } from '@/lib/suap-editais';
import { lerPacoteCarga, MARCA_CARGA_NAVEGADOR, type PacoteCarga } from '@/lib/suap-carga';

/**
 * Carga semanal do SUAP: editais (listas web) + projetos (API), tudo capturado no
 * navegador e entregue num único JSON (ver `public/modelos/capturar-suap-semanal.js`).
 *
 * Por que no navegador: o SUAP está atrás de um AWS WAF que desafia o IP do
 * servidor do portal (ver DOCUMENTACAO/SUAP_IMPORTACAO.md).
 *
 * Autorização: a identidade vem do **cookie de sessão verificado no servidor** e
 * exige o Administrador Geral — quem importa em massa mexe no catálogo público.
 *
 * Padrão "só os novos": o script já descarta o que o portal conhece, e a gravação
 * confere de novo (o arquivo pode vir de uma carga antiga). Atualizar o que já
 * existe é uma escolha explícita (`atualizarExistentes`).
 */

type Falha = { ok: false; error: string };

async function exigirAdminGeral(): Promise<{ ok: true; email: string } | Falha> {
  const sessao = await getVerifiedServerSession();
  if (!sessao?.email) return { ok: false, error: MENSAGENS.naoAutenticado };
  if (!isAdministradorGeral(sessao.email)) return { ok: false, error: MENSAGENS.semPermissaoAdminGeral };

  const usuario = await prisma.user.findUnique({ where: { email: sessao.email }, select: { role: true } });
  if (usuario?.role !== 'ADMIN') return { ok: false, error: MENSAGENS.semPermissaoAdminGeral };

  return { ok: true, email: sessao.email };
}

const siglaDoCampus = () => process.env.SUAP_CAMPUS_SIGLA ?? 'IVAIPODG';

function validarTamanho(conteudo: string): Falha | null {
  if (!conteudo?.trim()) {
    return { ok: false, error: 'Cole o conteúdo da captura (ou envie o arquivo .json) antes de continuar.' };
  }
  const bytes = tamanhoEmBytes(conteudo);
  if (bytes > LIMITE_CAPTURA_BYTES) {
    return {
      ok: false,
      error:
        `A captura tem ${(bytes / 1024 / 1024).toFixed(1)} MB e o limite é ${LIMITE_CAPTURA_BYTES / 1024 / 1024} MB. ` +
        'Rode o script de novo — com o código copiado do painel ele já traz só o que é novo e o arquivo fica pequeno.',
    };
  }
  return null;
}

type Entendido = {
  pacote: PacoteCarga;
  editais: ResultadoCapturaEditais | null;
  projetos: ResultadoCaptura | null;
};

function entender(conteudo: string): ({ ok: true } & Entendido) | Falha {
  const lido = lerPacoteCarga(conteudo);
  if (!lido.ok) return { ok: false, error: lido.erro };

  const { ok: _ok, ...pacote } = lido;
  void _ok;
  const editais = pacote.editais ? analisarEditaisCapturados(pacote.editais, siglaDoCampus()) : null;
  const projetos = pacote.projetos ? analisarCapturaSuap(pacote.projetos, siglaDoCampus()) : null;
  return { ok: true, pacote, editais, projetos };
}

// ─── Prévia ───────────────────────────────────────────────────────────────────

export type PreviaCarga = {
  ok: true;
  geradoEm: string | null;
  campus: string;
  ignoradosNoScript: { editais: number; projetos: number };
  problemasDoScript: string[];
  avisos: string[];
  editais: null | {
    total: number;
    novos: number;
    existentes: number;
    outroCampus: number;
    porFonte: Record<string, number>;
    amostra: { fonte: string; titulo: string; inscricoes: string; novo: boolean }[];
    erros: { indice: number; motivo: string }[];
  };
  projetos: null | {
    total: number;
    novos: number;
    existentes: number;
    outroCampus: number;
    porFonte: Record<string, number>;
    amostra: { id: number; fonte: string; titulo: string; situacao: string | null; novo: boolean }[];
    erros: { indice: number; motivo: string }[];
  };
};

export async function previsualizarCargaSuap(conteudo: string): Promise<PreviaCarga | Falha> {
  const auth = await exigirAdminGeral();
  if (!auth.ok) return auth;
  const tamanho = validarTamanho(conteudo);
  if (tamanho) return tamanho;

  const lido = entender(conteudo);
  if (!lido.ok) return lido;
  const { pacote, editais, projetos } = lido;

  const sigla = normalizaSiglaSuap(siglaDoCampus());

  let previaEditais: PreviaCarga['editais'] = null;
  if (editais) {
    const chaves = editais.editais.map((e) => e.chave);
    const jaExistem = new Set(
      chaves.length
        ? (await prisma.edital.findMany({ where: { origemRef: { in: chaves } }, select: { origemRef: true } })).map((e) => e.origemRef)
        : [],
    );
    const existentes = editais.editais.filter((e) => jaExistem.has(e.chave)).length;
    previaEditais = {
      total: editais.editais.length,
      novos: editais.editais.length - existentes,
      existentes,
      outroCampus: editais.resumo.outroCampus,
      porFonte: editais.resumo.porFonte,
      amostra: editais.editais.slice(0, 12).map((e) => ({
        fonte: FONTES_EDITAL[e.fonte].rotulo,
        titulo: e.titulo,
        inscricoes: e.inscricoes,
        novo: !jaExistem.has(e.chave),
      })),
      erros: editais.erros,
    };
  }

  let previaProjetos: PreviaCarga['projetos'] = null;
  if (projetos) {
    const doCampus = projetos.projetos.filter((p) => normalizaSiglaSuap(p.campus_sigla) === sigla);
    const ids = doCampus.map((p) => suapIdUnico(p._fonte, p.id));
    const jaExistem = new Set(
      ids.length
        ? (await prisma.projeto.findMany({ where: { suapId: { in: ids } }, select: { suapId: true } })).map((p) => p.suapId)
        : [],
    );
    const existentes = ids.filter((id) => jaExistem.has(id)).length;
    const porFonte: Record<string, number> = {};
    for (const p of doCampus) porFonte[p._fonte] = (porFonte[p._fonte] ?? 0) + 1;

    previaProjetos = {
      total: doCampus.length,
      novos: doCampus.length - existentes,
      existentes,
      outroCampus: projetos.projetos.length - doCampus.length,
      porFonte,
      amostra: doCampus.slice(0, 12).map((p) => ({
        id: p.id,
        fonte: p._fonte,
        titulo: p.titulo,
        situacao: p.situacao ?? null,
        novo: !jaExistem.has(suapIdUnico(p._fonte, p.id)),
      })),
      erros: projetos.erros,
    };
  }

  return {
    ok: true,
    geradoEm: pacote.geradoEm,
    campus: sigla,
    ignoradosNoScript: pacote.ignoradosNoScript,
    problemasDoScript: pacote.problemas,
    avisos: [...(editais?.avisos ?? []), ...(projetos?.avisos ?? [])],
    editais: previaEditais,
    projetos: previaProjetos,
  };
}

// ─── Importação ───────────────────────────────────────────────────────────────

export type ResultadoCarga = {
  ok: true;
  editais: SyncResult | null;
  projetos: SyncResult | null;
};

export async function confirmarCargaSuap(
  conteudo: string,
  opcoes: { atualizarExistentes?: boolean; forcar?: boolean } = {},
): Promise<ResultadoCarga | Falha> {
  const auth = await exigirAdminGeral();
  if (!auth.ok) return auth;
  const tamanho = validarTamanho(conteudo);
  if (tamanho) return tamanho;

  const lido = entender(conteudo);
  if (!lido.ok) return lido;
  const { pacote, editais, projetos } = lido;

  const somenteNovos = !opcoes.atualizarExistentes;
  const sigla = normalizaSiglaSuap(siglaDoCampus());

  // Nada reconhecível no arquivo (ex.: só itens inválidos) não vira "carga feita":
  // gravar um log vazio faria o guia dizer que a carga da semana já aconteceu.
  const algumItemValido = (editais?.editais.length ?? 0) + (projetos?.projetos.length ?? 0) > 0;
  const nadaNovoDeProposito = pacote.ignoradosNoScript.editais + pacote.ignoradosNoScript.projetos > 0;
  const temErros = (editais?.erros.length ?? 0) + (projetos?.erros.length ?? 0) > 0;
  if (!algumItemValido && !nadaNovoDeProposito && temErros) {
    return { ok: false, error: 'Nenhum item válido na captura. Confira o arquivo (o script costuma avisar o motivo no console) e tente de novo.' };
  }

  let resEditais: SyncResult | null = null;
  if (editais) {
    resEditais = await aplicarEditaisDoSuap(editais.editais, {
      somenteNovos,
      forcar: opcoes.forcar,
      origem: MARCA_CARGA_NAVEGADOR,
      avisos: pacote.problemas.map((p) => `⚠️ Aviso do script: ${p}`),
    });
    if (editais.resumo.outroCampus > 0) {
      resEditais.detalhes.push(`ℹ️ ${editais.resumo.outroCampus} edital(is) de outros campi foram ignorados.`);
    }
  }

  let resProjetos: SyncResult | null = null;
  if (projetos) {
    // A API do SUAP não filtra por campus; o script filtra e aqui é a segunda trava.
    const doCampus = projetos.projetos.filter((p) => normalizaSiglaSuap(p.campus_sigla) === sigla);
    resProjetos = await aplicarProjetosDoSuap(doCampus, {
      somenteNovos,
      forcar: opcoes.forcar,
      origem: MARCA_CARGA_NAVEGADOR,
    });
    if (doCampus.length < projetos.projetos.length) {
      resProjetos.detalhes.push(
        `ℹ️ ${projetos.projetos.length - doCampus.length} projeto(s) de outros campi foram ignorados (só o campus ${sigla} entra no portal).`,
      );
    }
  }

  return { ok: true, editais: resEditais, projetos: resProjetos };
}
