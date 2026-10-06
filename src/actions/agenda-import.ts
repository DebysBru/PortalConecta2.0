'use server';

import { prisma } from '@/lib/prisma';
import { getVerifiedServerSession } from '@/lib/session';
import { MENSAGENS } from '@/lib/mensagens';
import { analisarArquivo, gerarModeloCSV, type ResultadoAnalise } from '@/lib/agenda-import';
import { ensureUser } from '@/actions/admin';

/**
 * Importação do calendário acadêmico na Agenda (painel).
 *
 * Fluxo em duas etapas, para ninguém importar 110 eventos sem ver o que vem:
 *   1. `previsualizarImportacao` — analisa o arquivo, devolve o resumo, os erros
 *      por linha e quantos eventos já existem (pela `ref`);
 *   2. `confirmarImportacao` — grava de fato, criando/atualizando por `origemRef`.
 *
 * Idempotência: a `ref` de cada linha vira `Evento.origemRef` (único). Reimportar
 * o mesmo arquivo **atualiza** em vez de duplicar — é o que permite corrigir a
 * planilha e importar de novo sem sujar a agenda.
 *
 * Autorização: mesma regra das outras actions do painel (`src/actions/admin.ts`)
 * — o e-mail vem do cliente, mas só vale se bater com a sessão verificada no
 * servidor E o usuário for ADMIN.
 */

export type PreviaImportacao = {
  ok: true;
  arquivo: string;
  analise: ResultadoAnalise;
  jaExistem: number;
  novos: number;
};

export type ResultadoImportacao = {
  ok: true;
  criados: number;
  atualizados: number;
  inalterados: number;
  ignorados: number;
  erros: { linha: number; motivo: string }[];
  lote: string;
};

type Falha = { ok: false; error: string };

async function exigirAdminCalendario(email?: string): Promise<{ ok: true; userId: string } | Falha> {
  if (!email) return { ok: false, error: MENSAGENS.naoAutenticado };

  const sessao = await getVerifiedServerSession();
  if (!sessao?.email || sessao.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, error: MENSAGENS.semPermissaoAdmin };
  }

  const usuario = await prisma.user.findUnique({ where: { email }, select: { role: true, id: true } });
  if (usuario?.role !== 'ADMIN') return { ok: false, error: MENSAGENS.semPermissaoAdmin };

  return { ok: true, userId: usuario.id };
}

/** Modelo CSV para o botão "Baixar modelo" (não precisa de sessão: é estático). */
export async function baixarModeloCalendario(): Promise<string> {
  return gerarModeloCSV();
}

export async function previsualizarImportacao(
  conteudo: string,
  nomeArquivo: string,
  callerEmail: string,
): Promise<PreviaImportacao | Falha> {
  const auth = await exigirAdminCalendario(callerEmail);
  if (!auth.ok) return auth;

  if (!conteudo?.trim()) {
    return { ok: false, error: 'O arquivo está vazio. Envie um CSV ou JSON com pelo menos as colunas "titulo" e "data".' };
  }
  if (conteudo.length > 5_000_000) {
    return { ok: false, error: 'Arquivo muito grande (limite de 5 MB). Divida o calendário em mais de um arquivo.' };
  }

  const analise = analisarArquivo(conteudo);
  const refs = analise.linhas.map((l) => l.ref);

  const existentes = refs.length
    ? await prisma.evento.count({ where: { origemRef: { in: refs } } })
    : 0;

  return {
    ok: true,
    arquivo: nomeArquivo || 'arquivo',
    analise,
    jaExistem: existentes,
    novos: analise.linhas.length - existentes,
  };
}

export async function confirmarImportacao(
  conteudo: string,
  nomeArquivo: string,
  callerEmail: string,
  opcoes: { atualizarExistentes?: boolean } = {},
): Promise<ResultadoImportacao | Falha> {
  const auth = await exigirAdminCalendario(callerEmail);
  if (!auth.ok) return auth;

  const analise = analisarArquivo(conteudo);
  if (analise.linhas.length === 0) {
    return {
      ok: false,
      error: analise.erros.length
        ? `Nenhum evento válido no arquivo (${analise.erros.length} linha(s) com problema). Corrija e tente de novo.`
        : 'Nenhum evento encontrado no arquivo.',
    };
  }

  const autor = await ensureUser(callerEmail);
  const lote = (nomeArquivo || 'importacao').slice(0, 120);
  const atualizarExistentes = opcoes.atualizarExistentes !== false;

  let criados = 0;
  let atualizados = 0;
  let inalterados = 0;

  const existentes = await prisma.evento.findMany({
    where: { origemRef: { in: analise.linhas.map((l) => l.ref) } },
    select: { origemRef: true },
  });
  const refsExistentes = new Set(existentes.map((e) => e.origemRef));

  // Em lotes de 50 para não estourar o tempo da transação em arquivos grandes.
  const TAMANHO_LOTE = 50;
  for (let i = 0; i < analise.linhas.length; i += TAMANHO_LOTE) {
    const fatia = analise.linhas.slice(i, i + TAMANHO_LOTE);
    for (const linha of fatia) {
      const dados = {
        titulo: linha.titulo,
        descricao: linha.descricao,
        data: linha.data,
        dataFim: linha.dataFim,
        tipo: linha.tipo,
        local: linha.local,
        categoria: linha.categoria,
        subcategoria: linha.subcategoria,
        publicoAlvo: linha.publicoAlvo,
        nivel: linha.nivel,
        natureza: linha.natureza,
        interessaAlunos: linha.interessaAlunos,
        interessaProfessores: linha.interessaProfessores,
        importLote: lote,
        importadoEm: new Date(),
      };

      try {
        if (refsExistentes.has(linha.ref)) {
          if (!atualizarExistentes) {
            inalterados++;
            continue;
          }
          await prisma.evento.update({ where: { origemRef: linha.ref }, data: dados });
          atualizados++;
        } else {
          await prisma.evento.create({
            data: { ...dados, origemRef: linha.ref, authorId: autor.id },
          });
          criados++;
        }
      } catch {
        // Uma linha problemática não pode derrubar a importação inteira.
        analise.erros.push({ linha: 0, motivo: `Não foi possível gravar "${linha.titulo}" (${linha.ref})` });
      }
    }
  }

  return {
    ok: true,
    criados,
    atualizados,
    inalterados,
    ignorados: analise.erros.length,
    erros: analise.erros.slice(0, 50),
    lote,
  };
}

/** Quantos eventos vieram de importação (para a tela de importação). */
export async function estatisticasCalendario(): Promise<{
  total: number;
  importados: number;
  lotes: { lote: string; total: number; ultimo: Date | null }[];
}> {
  const [total, importados, porLote] = await Promise.all([
    prisma.evento.count(),
    prisma.evento.count({ where: { origemRef: { not: null } } }),
    prisma.evento.groupBy({
      by: ['importLote'],
      where: { importLote: { not: null } },
      _count: { _all: true },
      _max: { importadoEm: true },
    }),
  ]);

  return {
    total,
    importados,
    lotes: porLote
      .filter((l) => l.importLote)
      .map((l) => ({ lote: l.importLote as string, total: l._count._all, ultimo: l._max.importadoEm })),
  };
}
