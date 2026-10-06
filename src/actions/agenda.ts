'use server';

import { prisma } from '@/lib/prisma';
import { resolverUsuarioDaSessao } from '@/lib/usuario-sessao';

/**
 * Acompanhamento da agenda pelo estudante.
 *
 * Três formas de acompanhar, como pedido:
 *   1. **um evento** (`alternarAcompanhamentoEvento`) — o botão de sino em cada card;
 *   2. **todos os eventos de um filtro** (`seguirEventos`) — "acompanhar os 28
 *      prazos", por exemplo, a partir do filtro que está na tela;
 *   3. **o calendário inteiro** (`definirSeguirCalendarioInteiro`) — inclusive o
 *      que for importado depois.
 *
 * Onde fica guardado: os eventos individuais viram linhas em `Favorito`
 * (`entidade = 'evento'`), a mesma tabela dos favoritos de edital/projeto — assim
 * o estudante vê o que acompanha também na área dele, sem um segundo mecanismo.
 * A opção "calendário inteiro" é uma linha em `AgendaPreferencia`.
 *
 * Como nos outros arquivos de ação, a identidade vem do ID token do Firebase
 * verificado no servidor — nunca de um `userId` mandado pelo cliente.
 */

export type AcompanhamentoAgenda = { seguirTudo: boolean; ids: string[] };

type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Estado inicial da tela: o que o estudante já acompanha. */
export async function listarAcompanhamento(idToken: string): Promise<AcompanhamentoAgenda> {
  const sessao = await resolverUsuarioDaSessao(idToken);
  if (!sessao.ok) return { seguirTudo: false, ids: [] };

  const [favoritos, preferencia] = await Promise.all([
    prisma.favorito.findMany({
      where: { user_id: sessao.userId, entidade: 'evento' },
      select: { entidade_id: true },
    }),
    prisma.agendaPreferencia.findUnique({
      where: { user_id: sessao.userId },
      select: { seguirTudo: true },
    }),
  ]);

  return {
    seguirTudo: preferencia?.seguirTudo ?? false,
    ids: favoritos.map((f) => f.entidade_id),
  };
}

/** Botão de sino de um evento. Devolve o estado final para a UI não adivinhar. */
export async function alternarAcompanhamentoEvento(
  idToken: string,
  eventoId: string,
): Promise<Resultado<{ seguindo: boolean }>> {
  const sessao = await resolverUsuarioDaSessao(idToken);
  if (!sessao.ok) return sessao;

  if (!eventoId?.trim()) {
    return { ok: false, error: 'Não identificamos este evento. Recarregue a página e tente de novo.' };
  }

  try {
    const existente = await prisma.favorito.findUnique({
      where: {
        user_id_entidade_entidade_id: { user_id: sessao.userId, entidade: 'evento', entidade_id: eventoId },
      },
    });

    if (existente) {
      await prisma.favorito.delete({
        where: {
          user_id_entidade_entidade_id: { user_id: sessao.userId, entidade: 'evento', entidade_id: eventoId },
        },
      });
      return { ok: true, seguindo: false };
    }

    const evento = await prisma.evento.findUnique({ where: { id: eventoId }, select: { id: true } });
    if (!evento) {
      return { ok: false, error: 'Este evento saiu da agenda. Atualize a página para ver a lista atual.' };
    }

    await prisma.favorito.create({
      data: { user_id: sessao.userId, entidade: 'evento', entidade_id: eventoId },
    });
    return { ok: true, seguindo: true };
  } catch {
    return { ok: false, error: 'Não conseguimos atualizar o que você acompanha agora. Tente novamente em instantes.' };
  }
}

/** Acompanhar (ou parar de acompanhar) todos os eventos de uma seleção/filtro. */
export async function seguirEventos(
  idToken: string,
  eventoIds: string[],
  seguir: boolean,
): Promise<Resultado<{ total: number }>> {
  const sessao = await resolverUsuarioDaSessao(idToken);
  if (!sessao.ok) return sessao;

  const ids = [...new Set((eventoIds ?? []).filter((id) => typeof id === 'string' && id.trim()))];
  if (ids.length === 0) {
    return { ok: false, error: 'Nenhum evento nesta seleção.' };
  }
  if (ids.length > 500) {
    return { ok: false, error: 'Seleção muito grande de uma vez (limite de 500 eventos). Estreite o filtro e tente de novo.' };
  }

  try {
    if (seguir) {
      // Só grava o que existe de fato — a mesma preocupação de `validarAlvo`.
      const existentes = await prisma.evento.findMany({ where: { id: { in: ids } }, select: { id: true } });
      await prisma.favorito.createMany({
        data: existentes.map((e) => ({ user_id: sessao.userId, entidade: 'evento', entidade_id: e.id })),
        skipDuplicates: true,
      });
      return { ok: true, total: existentes.length };
    }

    const removidos = await prisma.favorito.deleteMany({
      where: { user_id: sessao.userId, entidade: 'evento', entidade_id: { in: ids } },
    });
    return { ok: true, total: removidos.count };
  } catch {
    return { ok: false, error: 'Não conseguimos atualizar o que você acompanha agora. Tente novamente em instantes.' };
  }
}

/** "Acompanho o calendário inteiro" — vale também para o que for importado depois. */
export async function definirSeguirCalendarioInteiro(
  idToken: string,
  seguir: boolean,
): Promise<Resultado<{ seguirTudo: boolean }>> {
  const sessao = await resolverUsuarioDaSessao(idToken);
  if (!sessao.ok) return sessao;

  try {
    await prisma.agendaPreferencia.upsert({
      where: { user_id: sessao.userId },
      create: { user_id: sessao.userId, seguirTudo: seguir },
      update: { seguirTudo: seguir },
    });
    return { ok: true, seguirTudo: seguir };
  } catch {
    return { ok: false, error: 'Não conseguimos salvar sua preferência agora. Tente novamente em instantes.' };
  }
}

/**
 * Ids que o estudante acompanha de fato — usado no servidor pelo exportador .ics.
 * Com `seguirTudo`, devolve `null` para significar "todos os eventos".
 */
export async function idsAcompanhados(userId: string): Promise<string[] | null> {
  const preferencia = await prisma.agendaPreferencia.findUnique({
    where: { user_id: userId },
    select: { seguirTudo: true },
  });
  if (preferencia?.seguirTudo) return null;

  const favoritos = await prisma.favorito.findMany({
    where: { user_id: userId, entidade: 'evento' },
    select: { entidade_id: true },
  });
  return favoritos.map((f) => f.entidade_id);
}
