'use server';

import { prisma } from '@/lib/prisma';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

// ── Buscar perfil completo ─────────────────────────────────────────────────────

export async function getMyProfile(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      googleLinked: true,
      suapUsername: true,
      suapNome: true,
      suapEmail: true,
      suapFoto: true,
      createdAt: true,
      projetosAdmin: { select: { id: true, nome: true, slug: true } },
    },
  });
}

// ── Atualizar nome de exibição ─────────────────────────────────────────────────

export async function updateMyName(email: string, name: string): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) {
    return { ok: false, error: 'O nome deve ter pelo menos 2 caracteres.' };
  }
  if (trimmed.length > 80) {
    return { ok: false, error: 'O nome deve ter no máximo 80 caracteres.' };
  }
  try {
    await prisma.user.update({ where: { email }, data: { name: trimmed } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Excluir conta ──────────────────────────────────────────────────────────────

export async function deleteMyAccount(email: string): Promise<Result> {
  try {
    // Cascade: Account, Session, Post.authorId, Edital.authorId, Evento.authorId
    // Posts, editais e eventos perdem o author mas não são deletados (FK nullable não existe)
    // Para evitar violação de FK, primeiro removemos vínculos de admin em projetos
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) return { ok: false, error: 'Usuário não encontrado.' };

    // Desvincula o usuário de todos os projetos que ele administra
    await prisma.projeto.updateMany({
      where: { admins: { some: { id: user.id } } },
      data: {}, // trigger the relation disconnect via next step
    });
    // Disconnect via raw relation update (Prisma many-to-many)
    await prisma.user.update({
      where: { id: user.id },
      data: { projetosAdmin: { set: [] } },
    });

    // Agora deleta (Account e Session em cascade pelo schema)
    await prisma.user.delete({ where: { id: user.id } });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
