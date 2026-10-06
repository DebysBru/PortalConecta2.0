'use server';

import { prisma } from '@/lib/prisma';
import { getVerifiedServerSession } from '@/lib/session';
import { isAdministradorGeral } from '@/lib/permissions';
import { MENSAGENS } from '@/lib/mensagens';
import { analisarCapturaSuap, type ResultadoCaptura } from '@/lib/suap-import';
import { normalizaSiglaSuap } from '@/lib/suap-api';
import { aplicarProjetosDoSuap, type SyncResult } from '@/lib/suap-sync';

/**
 * Importação de projetos do SUAP a partir da captura feita no navegador.
 *
 * Contexto: o SUAP está atrás de um AWS WAF que desafia o IP do servidor, então a
 * busca direta (`syncProjetosAction`) não passa. Do navegador logado a API
 * responde; a captura (`public/modelos/capturar-projetos-suap.js`) gera um JSON e
 * este par de actions grava o conteúdo **com a mesma lógica do sync**.
 *
 * Autorização: diferente das actions antigas de SUAP (que conferiam apenas o
 * e-mail mandado pelo cliente), aqui a identidade vem do **cookie de sessão
 * verificado no servidor** e, além disso, exige o Administrador Geral — quem
 * importa projetos em massa mexe no catálogo público inteiro.
 */

export type PreviaImportacaoSuap = {
  ok: true;
  analise: ResultadoCaptura;
  existentes: number;
  novos: number;
};

type Falha = { ok: false; error: string };

async function exigirAdminGeral(): Promise<{ ok: true; email: string } | Falha> {
  const sessao = await getVerifiedServerSession();
  if (!sessao?.email) return { ok: false, error: MENSAGENS.naoAutenticado };
  if (!isAdministradorGeral(sessao.email)) return { ok: false, error: MENSAGENS.semPermissaoAdminGeral };

  const usuario = await prisma.user.findUnique({ where: { email: sessao.email }, select: { role: true } });
  if (usuario?.role !== 'ADMIN') return { ok: false, error: MENSAGENS.semPermissaoAdminGeral };

  return { ok: true, email: sessao.email };
}

export async function previsualizarImportacaoSuap(conteudo: string): Promise<PreviaImportacaoSuap | Falha> {
  const auth = await exigirAdminGeral();
  if (!auth.ok) return auth;

  if (!conteudo?.trim()) {
    return { ok: false, error: 'Cole o conteúdo da captura (ou envie o arquivo .json) antes de continuar.' };
  }
  if (conteudo.length > 8_000_000) {
    return { ok: false, error: 'Arquivo muito grande (limite de 8 MB). Divida a captura por ano ou por fonte.' };
  }

  const analise = analisarCapturaSuap(conteudo, process.env.SUAP_CAMPUS_SIGLA ?? 'IVAIPODG');

  // Quantos já existem: a idempotência do sync é pelo `suapId`, derivado de
  // fonte + id do SUAP (ver src/lib/suap-identidade.ts).
  const { suapIdUnico } = await import('@/lib/suap-identidade');
  const ids = analise.projetos.map((p) => suapIdUnico(p._fonte, p.id));
  const existentes = ids.length
    ? await prisma.projeto.count({ where: { suapId: { in: ids } } })
    : 0;

  return { ok: true, analise, existentes, novos: analise.projetos.length - existentes };
}

export async function confirmarImportacaoSuap(
  conteudo: string,
  opcoes: { forcar?: boolean } = {},
): Promise<({ ok: true } & SyncResult) | Falha> {
  const auth = await exigirAdminGeral();
  if (!auth.ok) return auth;

  const sigla = process.env.SUAP_CAMPUS_SIGLA ?? 'IVAIPODG';
  const analise = analisarCapturaSuap(conteudo, sigla);

  if (analise.projetos.length === 0) {
    return {
      ok: false,
      error: analise.erros.length
        ? `Nenhum projeto válido na captura (${analise.erros.length} item(ns) com problema). Confira o arquivo e tente de novo.`
        : 'Nenhum projeto encontrado na captura.',
    };
  }

  // A API do SUAP não filtra por campus: a captura traz o Brasil inteiro. O filtro
  // é aqui — mesma regra do sync direto (`fetchProjetosFromSuap`), senão o portal
  // do campus Ivaiporã encheria de projetos de outros campi.
  const alvo = normalizaSiglaSuap(sigla);
  const doCampus = analise.projetos.filter((p) => normalizaSiglaSuap(p.campus_sigla) === alvo);

  if (doCampus.length === 0) {
    const siglas = Object.keys(analise.resumo.porCampus).sort().join(', ') || '(nenhuma)';
    return {
      ok: false,
      error:
        `A captura tem ${analise.projetos.length} projetos, mas nenhum do campus "${alvo}" — ` +
        `as siglas encontradas foram: ${siglas}. Confira a configuração SUAP_CAMPUS_SIGLA ou capture as páginas do campus certo.`,
    };
  }

  const resultado = await aplicarProjetosDoSuap(doCampus, {
    forcar: opcoes.forcar,
    origem: 'captura do navegador',
  });

  if (doCampus.length < analise.projetos.length) {
    resultado.detalhes.push(
      `ℹ️ ${analise.projetos.length - doCampus.length} projeto(s) de outros campi foram ignorados (só o campus ${alvo} entra no portal).`,
    );
  }

  return { ok: true, ...resultado };
}
