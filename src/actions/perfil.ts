'use server';

import { prisma } from '@/lib/prisma';
import { translatePrismaError } from '@/lib/utils';
import { verifySessionToken } from '@/lib/auth-helpers';
import { MENSAGENS } from '@/lib/mensagens';
import {
  LIMITES, validarCampos, validarListaDeTextos, validarTelefone, validarTextoOpcional, validarUrl,
} from '@/lib/validacao';
import {
  ehAnoIngressoValido,
  ehCursoConhecido,
  ehSemestreValido,
  fonteDeLegado,
  fonteDePerfil,
  mesclarFontesAcademicas,
  semestreAtual,
} from '@/lib/perfil-academico';

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
  /** Precisa ser um dos cursos do catálogo (src/lib/perfil-academico.ts). */
  curso?: string;
  /** Ano de ingresso no curso — substituiu o campo livre "Turma". */
  anoIngresso?: number | string | null;
  /** Semestre do curso, de 1 a 10. */
  semestreAtual?: number | string | null;
  matricula?: string;
  experienciasPrevias?: string;
  areasInteresse?: string[];
  habilidades?: string[];
  curriculoLattes?: string;
};

/** Aceita `12`, `"12"`, `""` e `null` — o form manda string, o tipo pede número. */
function inteiroOpcional(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
  return Number.isFinite(numero) ? Math.trunc(numero) : null;
}

export async function getMeuPerfilAluno(idToken: string) {
  const auth = await verifySessionToken(idToken);
  if (!auth.ok) return null;

  const user = await prisma.user.findUnique({ where: { email: auth.email }, select: { id: true } });
  if (!user) return null;

  return prisma.perfilAluno.findUnique({ where: { userId: user.id } });
}

/**
 * Dados acadêmicos prontos para pré-preencher um formulário de inscrição do
 * estudante logado. Junta, campo a campo, as três origens possíveis — perfil
 * novo, colunas legadas do perfil e a última inscrição — na ordem de
 * precedência definida em `mesclarFontesAcademicas`.
 *
 * Existe como action (e não uma consulta solta na página) porque a página de
 * inscrição é pública: quem não está logado simplesmente recebe `null` e
 * preenche tudo à mão, como antes.
 */
export async function getDadosAcademicosInscricao(idToken: string) {
  const auth = await verifySessionToken(idToken);
  if (!auth.ok) return null;

  const user = await prisma.user.findUnique({ where: { email: auth.email }, select: { id: true } });
  if (!user) return null;

  const [perfil, ultimaInscricao] = await Promise.all([
    prisma.perfilAluno.findUnique({ where: { userId: user.id } }),
    // Inscrição antiga pode ter sido feita sem login (só com o e-mail) — daí a
    // busca pelos dois caminhos, igual ao que "Meus Dados" já faz.
    prisma.inscricao.findFirst({
      where: { OR: [{ user_id: user.id }, { email: auth.email }] },
      orderBy: { created_at: 'desc' },
      select: {
        curso: true,
        turma: true,
        semestre: true,
        matricula: true,
        telefone: true,
      },
    }),
  ]);

  const mesclado = mesclarFontesAcademicas(
    fonteDePerfil(perfil),
    fonteDeLegado(perfil),
    fonteDeLegado(ultimaInscricao),
  );

  return {
    ...mesclado,
    // O semestre devolvido é o ATUAL, já avançado desde a última confirmação do
    // estudante — é isso que faz a inscrição nova nascer no semestre certo sem
    // ninguém precisar mexer no perfil a cada seis meses.
    semestreAtual: semestreAtual(mesclado.semestre, mesclado.semestreReferencia),
  };
}

export async function updateMeuPerfilAluno(idToken: string, data: PerfilAlunoFormData): Promise<Result> {
  const auth = await verifySessionToken(idToken);
  if (!auth.ok) return auth;

  const curso = data.curso?.trim() || null;

  // ── Limites de entrada ───────────────────────────────────────────────────
  // O formulário é do próprio aluno, mas quem chama a Server Action direto não
  // passa pelo navegador: sem isto, "matrícula" aceitava 900 KB e o link do
  // Lattes aceitava `javascript:` (que vira XSS quando alguém clica no perfil).
  const v = validarCampos({
    telefone: () => validarTelefone(data.telefone),
    matricula: () => validarTextoOpcional(data.matricula, 'Matrícula', { min: 0, max: LIMITES.matricula }),
    curriculoLattes: () => validarUrl(data.curriculoLattes, 'Currículo Lattes', { opcional: true }),
    experienciasPrevias: () => validarTextoOpcional(data.experienciasPrevias, 'Experiências prévias', LIMITES.texto),
    areasInteresse: () => validarListaDeTextos(data.areasInteresse, 'Áreas de interesse'),
    habilidades: () => validarListaDeTextos(data.habilidades, 'Habilidades'),
  });
  if (!v.ok) return v;

  const anoIngresso = inteiroOpcional(data.anoIngresso);
  if (anoIngresso !== null && !ehAnoIngressoValido(anoIngresso)) {
    return { ok: false, error: MENSAGENS.selecioneOpcao('Ano de Ingresso') };
  }

  const semestreAtualInformado = inteiroOpcional(data.semestreAtual);
  if (semestreAtualInformado !== null && !ehSemestreValido(semestreAtualInformado)) {
    return { ok: false, error: 'O semestre precisa estar entre 1º e 10º.' };
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: auth.email }, select: { id: true } });
    if (!user) return { ok: false, error: 'Usuário não encontrado.' };

    // O catálogo é obrigatório para valor NOVO, mas o valor que já está gravado
    // passa: sem isso, quem tem um curso antigo fora da lista (ou o perfil criado
    // antes do catálogo existir) levaria erro — ou perderia o curso — só por
    // corrigir o telefone. A tela mostra esse valor como "(valor atual)".
    const atual = await prisma.perfilAluno.findUnique({
      where: { userId: user.id },
      select: { curso: true },
    });
    if (curso && !ehCursoConhecido(curso) && curso !== atual?.curso) {
      return { ok: false, error: MENSAGENS.selecioneOpcao('Curso') };
    }

    const payload = {
      telefone: v.valor.telefone,
      curso,
      anoIngresso,
      semestreAtual: semestreAtualInformado,
      // A referência é sempre "agora": o valor que o estudante acabou de
      // confirmar (ou o que o portal calculou e ele aceitou) é o semestre de
      // hoje. É daqui que `semestreAtual` conta os semestres que passarem —
      // ver src/lib/perfil-academico.ts.
      semestreReferencia: semestreAtualInformado === null ? null : new Date(),
      matricula: v.valor.matricula,
      experienciasPrevias: v.valor.experienciasPrevias,
      areasInteresse: v.valor.areasInteresse,
      habilidades: v.valor.habilidades,
      curriculoLattes: v.valor.curriculoLattes,
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
