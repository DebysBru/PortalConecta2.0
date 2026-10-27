'use server';

import { prisma } from '@/lib/prisma';
import { ingerirDocumentoRag, alterarVisibilidadeRag } from '@/lib/rag-publicacao';
import { cache } from '@/lib/cache';
import { removerOriginalRag } from '@/lib/rag-storage';
import { MENSAGENS, mensagemAmigavel } from '@/lib/mensagens';
import { getVerifiedServerSession } from '@/lib/session';

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Exige ADMIN — e que o e-mail informado seja o da SESSÃO verificada.
 *
 * Antes bastava o e-mail pertencer a um admin no banco: como o e-mail chega do
 * cliente e os administrativos são públicos na documentação do projeto, qualquer
 * pessoa podia chamar estas actions direto (mesma classe do achado S1).
 */
async function requireAdminEmail(email?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!email) return { ok: false, error: MENSAGENS.naoAutenticado };

  const sessao = await getVerifiedServerSession();
  if (!sessao?.email || sessao.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, error: MENSAGENS.semPermissaoAdmin };
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (user?.role !== 'ADMIN') return { ok: false, error: MENSAGENS.semPermissaoAdmin };
  return { ok: true };
}

export async function listDocumentosKb(callerEmail?: string) {
  const auth = await requireAdminEmail(callerEmail);
  if (!auth.ok) return auth;

  const docs = await prisma.documentoKb.findMany({ orderBy: { createdAt: 'desc' } });
  return { ok: true, data: docs } as const;
}

export async function getDocumentoKbDetail(id: string, callerEmail?: string) {
  const auth = await requireAdminEmail(callerEmail);
  if (!auth.ok) return auth;

  const doc = await prisma.documentoKb.findUnique({
    where: { id },
    include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
  });
  if (!doc) return { ok: false, error: 'Não encontramos este documento. Ele pode ter sido removido por outra pessoa.' } as const;
  return { ok: true, data: doc } as const;
}

export async function createDocumentoKbFromText(
  data: { titulo: string; conteudo: string; tipo: string; anteriorId?: string; permitirTextual?: boolean },
  callerEmail?: string
): Promise<ActionResult<{ id: string; chunks: number }>> {
  const auth = await requireAdminEmail(callerEmail);
  if (!auth.ok) return auth;

  try {
    const titulo = data.titulo?.trim();
    const conteudo = data.conteudo?.trim();
    if (!titulo) return { ok: false, error: MENSAGENS.campoObrigatorio('Título') };
    if (!conteudo) return { ok: false, error: MENSAGENS.campoObrigatorio('Conteúdo') };

    const result = await ingerirDocumentoRag({ titulo, conteudo, tipo: data.tipo || 'documento_livre', anteriorId: data.anteriorId, permitirTextual: data.permitirTextual === true, metadata: { autor: callerEmail! } });
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: mensagemAmigavel(e, 'Não conseguimos salvar o documento. Tente novamente em alguns instantes.') };
  }
}

export async function deleteDocumentoKb(id: string, callerEmail?: string): Promise<ActionResult> {
  const auth = await requireAdminEmail(callerEmail);
  if (!auth.ok) return auth;

  try {
    const doc = await prisma.documentoKb.findUnique({ where: { id } });
    await prisma.documentoKb.delete({ where: { id } });
    const key = (doc?.metadata as Record<string, unknown> | undefined)?.originalKey;
    if (typeof key === 'string') await removerOriginalRag(key);
    cache.invalidate('chat:');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensagemAmigavel(e, 'Não conseguimos excluir este documento. Tente novamente.') };
  }
}

export async function toggleDocumentoKb(id: string, callerEmail?: string): Promise<ActionResult<{ ativo: boolean }>> {
  const auth = await requireAdminEmail(callerEmail);
  if (!auth.ok) return auth;

  try {
    const doc = await prisma.documentoKb.findUnique({ where: { id } });
    if (!doc) return { ok: false, error: 'Não encontramos este documento. Ele pode ter sido removido por outra pessoa.' };

    await alterarVisibilidadeRag(id, !doc.ativo);
    const updated = { ativo: !doc.ativo };

    return { ok: true, data: { ativo: updated.ativo } };
  } catch (e) {
    return { ok: false, error: mensagemAmigavel(e, 'Não conseguimos mudar a situação deste documento. Tente novamente.') };
  }
}

export async function updateDocumentoKbTitulo(id: string, titulo: string, callerEmail?: string): Promise<ActionResult> {
  const auth = await requireAdminEmail(callerEmail);
  if (!auth.ok) return auth;

  try {
    const trimmed = titulo.trim();
    if (!trimmed) return { ok: false, error: MENSAGENS.campoObrigatorio('Título') };
    await prisma.documentoKb.update({ where: { id }, data: { titulo: trimmed } });
    cache.invalidate('chat:');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensagemAmigavel(e, 'Não conseguimos renomear este documento. Tente novamente.') };
  }
}
