'use server';

import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { derivarEventosEdital, derivarEventosProjeto } from '@/lib/evento-helpers';
import {
  CategoriaEdital, StatusEdital, StatusProjeto, StatusPost,
  TipoEvento, UserRole,
} from '@prisma/client';

const MASTER_ADMIN_EMAIL = process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || 'bru.mkt2024@gmail.com';

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function getUserRole(email: string): Promise<UserRole | null> {
  if (!email) return null;
  if (email === MASTER_ADMIN_EMAIL) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'ADMIN' },
      create: { email, name: 'Administrador Master', role: 'ADMIN' },
    });
    return 'ADMIN';
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  return user?.role ?? null;
}

export async function ensureUser(email: string, name?: string): Promise<{ id: string; role: UserRole }> {
  const user = await prisma.user.upsert({
    where: { email },
    update: name ? { name } : {},
    create: { email, name: name ?? email, role: email === MASTER_ADMIN_EMAIL ? 'ADMIN' : 'ESTUDANTE' },
  });
  return { id: user.id, role: user.role };
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const [editaisAtivos, projetos, usuarios, eventos] = await Promise.all([
    prisma.edital.count({ where: { status: { in: ['ABERTO', 'EM_ANALISE'] } } }),
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

    // Derivar eventos automaticamente
    await derivarEventosEdital(edital.id).catch(console.error);

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

    // Re-derivar eventos quando datas mudam
    await derivarEventosEdital(id).catch(console.error);

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
  dataInicio?: string;
  servidores?: string;
  alunos?: string;
  observacao?: string;
  status: StatusProjeto;
  logoUrl?: string;
  corPrimaria?: string;
  email?: string;
  instagram?: string;
  site?: string;
  destaque?: boolean;
  adminEmails?: string;
};

export async function listProjetos(userEmail?: string, userRole?: string) {
  const where = userRole === 'PROFESSOR' && userEmail 
    ? { admins: { some: { email: userEmail } } } 
    : {};
  return prisma.projeto.findMany({ 
    where,
    orderBy: { createdAt: 'desc' },
    include: { admins: { select: { email: true } } }
  });
}

async function syncProjectAdmins(projetoId: string, emailsStr: string) {
  const emails = emailsStr.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  
  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await prisma.user.create({ data: { email, name: email, role: 'PROFESSOR' } });
    } else if (user.role === 'ESTUDANTE') {
      await prisma.user.update({ where: { email }, data: { role: 'PROFESSOR' } });
    }
  }

  await prisma.projeto.update({
    where: { id: projetoId },
    data: {
      admins: {
        set: emails.map(email => ({ email }))
      }
    }
  });
}

export async function createProjeto(data: ProjetoFormData): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const slug = slugify(data.nome);
    const { adminEmails, ...dbData } = data;
    const projeto = await prisma.projeto.create({
      data: {
        nome: dbData.nome,
        slug,
        coordenador: dbData.coordenador,
        area: dbData.area,
        descricao: dbData.descricao ?? null,
        dataInicio: dbData.dataInicio ? new Date(dbData.dataInicio) : null,
        servidores: dbData.servidores ?? null,
        alunos: dbData.alunos ?? null,
        observacao: dbData.observacao ?? null,
        status: dbData.status,
        logoUrl: dbData.logoUrl ?? null,
        corPrimaria: dbData.corPrimaria ?? '#2F52D3',
        email: dbData.email ?? null,
        instagram: dbData.instagram ?? null,
        site: dbData.site ?? null,
        destaque: dbData.destaque ?? false,
      },
    });
    if (adminEmails !== undefined) {
      await syncProjectAdmins(projeto.id, adminEmails);
    }

    // Derivar eventos automaticamente
    await derivarEventosProjeto(projeto.id).catch(console.error);

    return { ok: true, data: { id: projeto.id, slug: projeto.slug } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function updateProjeto(id: string, data: Partial<ProjetoFormData>): Promise<ActionResult> {
  try {
    const { adminEmails } = data;
    
    // Create an explicit update payload to prevent mass assignment
    // and avoid Prisma rejecting unknown fields sent by the client.
    const updateData: any = {};
    if (data.nome !== undefined) {
      updateData.nome = data.nome;
      updateData.slug = slugify(data.nome);
    }
    if (data.coordenador !== undefined) updateData.coordenador = data.coordenador;
    if (data.area !== undefined) updateData.area = data.area;
    if (data.descricao !== undefined) updateData.descricao = data.descricao;
    if (data.dataInicio !== undefined) updateData.dataInicio = data.dataInicio ? new Date(data.dataInicio) : null;
    if (data.servidores !== undefined) updateData.servidores = data.servidores;
    if (data.alunos !== undefined) updateData.alunos = data.alunos;
    if (data.observacao !== undefined) updateData.observacao = data.observacao;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.corPrimaria !== undefined) updateData.corPrimaria = data.corPrimaria;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.instagram !== undefined) updateData.instagram = data.instagram;
    if (data.site !== undefined) updateData.site = data.site;
    if (data.destaque !== undefined) updateData.destaque = data.destaque;

    await prisma.projeto.update({
      where: { id },
      data: updateData,
    });
    
    if (adminEmails !== undefined) {
      await syncProjectAdmins(id, adminEmails);
    }

    // Re-derivar eventos quando dados mudam
    await derivarEventosProjeto(id).catch(console.error);

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
  videoUrl?: string;
  arquivoPdfUrl?: string;
  linkExterno?: string;
  status: StatusPost;
  projetoId: string;
};

export async function listPosts(userEmail?: string, userRole?: string) {
  const where = userRole === 'PROFESSOR' && userEmail 
    ? { projeto: { admins: { some: { email: userEmail } } } } 
    : {};
  return prisma.post.findMany({
    where,
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
        videoUrl: data.videoUrl ?? null,
        arquivoPdfUrl: data.arquivoPdfUrl ?? null,
        linkExterno: data.linkExterno ?? null,
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
  return prisma.user.findMany({ 
    orderBy: { createdAt: 'desc' },
    include: { projetosAdmin: { select: { id: true, nome: true } } }
  });
}

export async function updateUserRole(userId: string, role: UserRole, projetoId?: string): Promise<ActionResult> {
  try {
    if (role === 'PROFESSOR' && !projetoId) {
      return { ok: false, error: 'Um projeto deve ser selecionado para o Professor.' };
    }

    await prisma.user.update({ where: { id: userId }, data: { role } });

    if (role === 'PROFESSOR' && projetoId) {
      await prisma.projeto.update({
        where: { id: projetoId },
        data: {
          admins: {
            connect: { id: userId }
          }
        }
      });
    }

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

export async function inviteUser(email: string, role: UserRole, projetoId?: string): Promise<ActionResult> {
  try {
    if (role === 'PROFESSOR' && !projetoId) {
      return { ok: false, error: 'Um projeto deve ser selecionado para o Professor.' };
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { role },
      create: { email, name: email, role },
    });

    if (role === 'PROFESSOR' && projetoId) {
      await prisma.projeto.update({
        where: { id: projetoId },
        data: {
          admins: {
            connect: { id: user.id }
          }
        }
      });
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
