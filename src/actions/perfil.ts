'use server';

import { prisma } from '@/lib/prisma';
import { translatePrismaError } from '@/lib/utils';
import { verifySessionToken } from '@/lib/auth-helpers';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

// ── Buscar perfil completo ─────────────────────────────────────────────────────

/**
 * `idToken` é o ID token do Firebase do usuário logado (`user.getIdToken()`
 * no cliente) — verificado no servidor via `verifySessionToken`. Antes,
 * essas funções recebiam um `email` comum e confiavam nele: qualquer chamada
 * direta à Server Action podia passar o e-mail de outra pessoa e ler/editar/
 * excluir os dados dela (achados S3/S18/S20 do RELATORIO_TESTES.md).
 */
export async function getMyProfile(idToken: string) {
  const auth = await verifySessionToken(idToken);
  if (!auth.ok) return null;

  return prisma.user.findUnique({
    where: { email: auth.email },
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

export async function updateMyName(idToken: string, name: string): Promise<Result> {
  const auth = await verifySessionToken(idToken);
  if (!auth.ok) return auth;

  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) {
    return { ok: false, error: 'O nome deve ter pelo menos 2 caracteres.' };
  }
  if (trimmed.length > 80) {
    return { ok: false, error: 'O nome deve ter no máximo 80 caracteres.' };
  }
  try {
    await prisma.user.update({ where: { email: auth.email }, data: { name: trimmed } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: translatePrismaError(e) };
  }
}

// ── Perfil detalhado do aluno ────────────────────────────────────────────────

export type PerfilAlunoFormData = {
  telefone?: string;
  curso?: string;
  turma?: string;
  semestre?: string;
  matricula?: string;
  experienciasPrevias?: string;
  areasInteresse?: string[];
  habilidades?: string[];
  curriculoLattes?: string;
};

export async function getMeuPerfilAluno(idToken: string) {
  const auth = await verifySessionToken(idToken);
  if (!auth.ok) return null;

  const user = await prisma.user.findUnique({ where: { email: auth.email }, select: { id: true } });
  if (!user) return null;

  return prisma.perfilAluno.findUnique({ where: { userId: user.id } });
}

export async function updateMeuPerfilAluno(idToken: string, data: PerfilAlunoFormData): Promise<Result> {
  const auth = await verifySessionToken(idToken);
  if (!auth.ok) return auth;

  if (data.curriculoLattes && !/^https?:\/\//.test(data.curriculoLattes.trim())) {
    return { ok: false, error: 'Link do currículo Lattes deve começar com http:// ou https://' };
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: auth.email }, select: { id: true } });
    if (!user) return { ok: false, error: 'Usuário não encontrado.' };

    const payload = {
      telefone: data.telefone?.trim() || null,
      curso: data.curso?.trim() || null,
      turma: data.turma?.trim() || null,
      semestre: data.semestre?.trim() || null,
      matricula: data.matricula?.trim() || null,
      experienciasPrevias: data.experienciasPrevias?.trim() || null,
      areasInteresse: data.areasInteresse?.map((a) => a.trim()).filter(Boolean) ?? [],
      habilidades: data.habilidades?.map((h) => h.trim()).filter(Boolean) ?? [],
      curriculoLattes: data.curriculoLattes?.trim() || null,
    };

    await prisma.perfilAluno.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...payload },
      update: payload,
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: translatePrismaError(e) };
  }
}

// ── Excluir conta ──────────────────────────────────────────────────────────────

export async function deleteMyAccount(idToken: string): Promise<Result> {
  const auth = await verifySessionToken(idToken);
  if (!auth.ok) return auth;

  try {
    // Cascade: Account, Session, Post.authorId, Edital.authorId, Evento.authorId
    // Posts, editais e eventos perdem o author mas não são deletados (FK nullable não existe)
    // Para evitar violação de FK, primeiro removemos vínculos de admin em projetos
    const user = await prisma.user.findUnique({
      where: { email: auth.email },
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
    return { ok: false, error: translatePrismaError(e) };
  }
}
