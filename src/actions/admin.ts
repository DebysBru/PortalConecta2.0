'use server';

import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import {
  CategoriaEdital, StatusEdital, StatusProjeto, StatusPost,
  TipoEvento, UserRole,
} from '@prisma/client';

const MASTER_ADMIN_EMAIL = 'bru.mkt2024@gmail.com';

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function getUserRole(email: string): Promise<UserRole | null> {
  if (!email) return null;
  if (email === MASTER_ADMIN_EMAIL) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'ADMINISTRADOR' },
      create: { email, name: 'Administrador Master', role: 'ADMINISTRADOR' },
    });
    return 'ADMINISTRADOR';
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  return user?.role ?? null;
}

export async function ensureUser(email: string, name?: string): Promise<{ id: string; role: UserRole }> {
  const user = await prisma.user.upsert({
    where: { email },
    update: name ? { name } : {},
    create: { email, name: name ?? email, role: email === MASTER_ADMIN_EMAIL ? 'ADMINISTRADOR' : 'VISITANTE' },
  });
  return { id: user.id, role: user.role };
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const [editaisAtivos, projetos, usuarios, eventos] = await Promise.all([
    prisma.edital.count({ where: { status: { in: ['ATIVO', 'ENCERRA_BREVE'] } } }),
    prisma.projeto.count({ where: { status: 'EM_EXECUCAO' } }),
    prisma.user.count(),
    prisma.evento.count({ where: { data: { gte: new Date() } } }),
  ]);
  return { editaisAtivos, projetos, usuarios, eventos };
}

// ── Editais ───────────────────────────────────────────────────────────────────

export type EditalFormData = {
  titulo: string;
  categoria: CategoriaEdital;
  resumo: string;
  dataEncerramento: string;
  status: StatusEdital;
  linkOficial: string;
  arquivoPdfUrl?: string;
  destaque?: boolean;
  traducaoIFizinha: {
    oquee: string;
    quempode: string;
    beneficios: string;
    documentos: string;
    comoinscrever: string;
    prazo: string;
    observacoes?: string;
  };
};

export async function listEditais() {
  return prisma.edital.findMany({
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { name: true, email: true } } },
  });
}

export async function createEdital(
  data: EditalFormData,
  authorEmail: string,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const author = await ensureUser(authorEmail);
    const slug = slugify(data.titulo);
    const edital = await prisma.edital.create({
      data: {
        titulo: data.titulo,
        slug,
        categoria: data.categoria,
        resumo: data.resumo,
        dataEncerramento: new Date(data.dataEncerramento),
        status: data.status,
        linkOficial: data.linkOficial,
        arquivoPdfUrl: data.arquivoPdfUrl ?? null,
        destaque: data.destaque ?? false,
        traducaoIFizinha: data.traducaoIFizinha,
        authorId: author.id,
      },
    });
    return { ok: true, data: { id: edital.id, slug: edital.slug } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function updateEdital(
  id: string,
  data: Partial<EditalFormData>,
): Promise<ActionResult> {
  try {
    await prisma.edital.update({
      where: { id },
      data: {
        ...data,
        dataEncerramento: data.dataEncerramento ? new Date(data.dataEncerramento) : undefined,
        slug: data.titulo ? slugify(data.titulo) : undefined,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function deleteEdital(id: string): Promise<ActionResult> {
  try {
    await prisma.edital.delete({ where: { id } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Projetos ──────────────────────────────────────────────────────────────────

export type ProjetoFormData = {
  nome: string;
  coordenador: string;
  area: string;
  descricao?: string;
  status: StatusProjeto;
  logoUrl?: string;
  corPrimaria?: string;
  email?: string;
  instagram?: string;
  site?: string;
  destaque?: boolean;
};

export async function listProjetos() {
  return prisma.projeto.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createProjeto(data: ProjetoFormData): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const slug = slugify(data.nome);
    const projeto = await prisma.projeto.create({
      data: {
        nome: data.nome,
        slug,
        coordenador: data.coordenador,
        area: data.area,
        descricao: data.descricao ?? null,
        status: data.status,
        logoUrl: data.logoUrl ?? null,
        corPrimaria: data.corPrimaria ?? '#2F52D3',
        email: data.email ?? null,
        instagram: data.instagram ?? null,
        site: data.site ?? null,
        destaque: data.destaque ?? false,
      },
    });
    return { ok: true, data: { id: projeto.id, slug: projeto.slug } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function updateProjeto(id: string, data: Partial<ProjetoFormData>): Promise<ActionResult> {
  try {
    await prisma.projeto.update({
      where: { id },
      data: {
        ...data,
        slug: data.nome ? slugify(data.nome) : undefined,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function deleteProjeto(id: string): Promise<ActionResult> {
  try {
    await prisma.projeto.delete({ where: { id } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export type PostFormData = {
  titulo: string;
  conteudo: string;
  resumo?: string;
  imagemUrl?: string;
  status: StatusPost;
  projetoId: string;
};

export async function listPosts() {
  return prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      projeto: { select: { nome: true, slug: true } },
      author: { select: { name: true } },
    },
  });
}

export async function createPost(data: PostFormData, authorEmail: string): Promise<ActionResult<{ id: string }>> {
  try {
    const author = await ensureUser(authorEmail);
    const slug = slugify(data.titulo);
    const post = await prisma.post.create({
      data: {
        titulo: data.titulo,
        slug,
        conteudo: data.conteudo,
        resumo: data.resumo ?? null,
        imagemUrl: data.imagemUrl ?? null,
        status: data.status,
        projetoId: data.projetoId,
        authorId: author.id,
      },
    });
    return { ok: true, data: { id: post.id } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function updatePost(id: string, data: Partial<PostFormData>): Promise<ActionResult> {
  try {
    await prisma.post.update({
      where: { id },
      data: {
        ...data,
        slug: data.titulo ? slugify(data.titulo) : undefined,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function deletePost(id: string): Promise<ActionResult> {
  try {
    await prisma.post.delete({ where: { id } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Eventos ───────────────────────────────────────────────────────────────────

export type EventoFormData = {
  titulo: string;
  descricao?: string;
  data: string;
  dataFim?: string;
  tipo: TipoEvento;
  local?: string;
  linkInscr?: string;
  editalSlug?: string;
};

export async function listEventos() {
  return prisma.evento.findMany({ orderBy: { data: 'asc' } });
}

export async function createEvento(data: EventoFormData, authorEmail: string): Promise<ActionResult<{ id: string }>> {
  try {
    const author = await ensureUser(authorEmail);
    const evento = await prisma.evento.create({
      data: {
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        data: new Date(data.data),
        dataFim: data.dataFim ? new Date(data.dataFim) : null,
        tipo: data.tipo,
        local: data.local ?? null,
        linkInscr: data.linkInscr ?? null,
        editalSlug: data.editalSlug ?? null,
        authorId: author.id,
      },
    });
    return { ok: true, data: { id: evento.id } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function updateEvento(id: string, data: Partial<EventoFormData>): Promise<ActionResult> {
  try {
    await prisma.evento.update({
      where: { id },
      data: {
        ...data,
        data: data.data ? new Date(data.data) : undefined,
        dataFim: data.dataFim ? new Date(data.dataFim) : undefined,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function deleteEvento(id: string): Promise<ActionResult> {
  try {
    await prisma.evento.delete({ where: { id } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Usuários (master only) ────────────────────────────────────────────────────

export async function listUsuarios() {
  return prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function updateUserRole(userId: string, role: UserRole): Promise<ActionResult> {
  try {
    await prisma.user.update({ where: { id: userId }, data: { role } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    await prisma.user.delete({ where: { id: userId } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function inviteUser(email: string, role: UserRole): Promise<ActionResult> {
  try {
    await prisma.user.upsert({
      where: { email },
      update: { role },
      create: { email, name: email, role },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
