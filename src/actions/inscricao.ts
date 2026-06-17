'use server';

import { prisma } from '@/lib/prisma';
import { enviarConfirmacaoInscricao } from '@/lib/email';

type InscricaoFormData = {
  projetoId: string;
  nome_completo: string;
  email: string;
  telefone?: string;
  curso?: string;
  turma?: string;
  semestre?: string;
  idade?: number;
  matricula?: string;
  tipo_interesse: 'BOLSISTA' | 'VOLUNTARIO' | 'AMBOS';
  disponibilidade?: string;
  experiencia_previa?: string;
  justificativa?: string;
  ciencia_regras: boolean;
  consentimento_lgpd: boolean;
  campos_extra?: Record<string, unknown>;
  userId?: string;
};

type ActionResult = { ok: true; data: { protocolo: string } } | { ok: false; error: string };

/**
 * Gera protocolo único: PRJ-YYYY-NNNNNN
 */
async function gerarProtocolo(): Promise<string> {
  const ano = new Date().getFullYear();
  const count = await prisma.inscricao.count({
    where: {
      protocolo: { startsWith: `PRJ-${ano}-` },
    },
  });
  const num = (count + 1).toString().padStart(6, '0');
  return `PRJ-${ano}-${num}`;
}

/**
 * Verifica se o projeto aceita inscrições
 */
export async function verificarInscricoesAbertas(projetoId: string) {
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    select: {
      id: true,
      nome: true,
      status: true,
      inscricoes_abertas: true,
      inscricao_inicio: true,
      inscricao_fim: true,
      vagasBolsista: true,
      vagasVoluntario: true,
      formulario_extra: true,
    },
  });

  if (!projeto) return { aberto: false, erro: 'Projeto não encontrado' };
  if (!projeto.inscricoes_abertas && projeto.status !== 'INSCRICOES_ABERTAS') {
    return { aberto: false, erro: 'Inscrições não estão abertas para este projeto' };
  }

  const agora = new Date();
  if (projeto.inscricao_inicio && agora < projeto.inscricao_inicio) {
    return { aberto: false, erro: 'Inscrições ainda não iniciaram' };
  }
  if (projeto.inscricao_fim && agora > projeto.inscricao_fim) {
    return { aberto: false, erro: 'Prazo de inscrições encerrado' };
  }

  return { aberto: true, projeto };
}

/**
 * Cria inscrição
 */
export async function criarInscricao(data: InscricaoFormData): Promise<ActionResult> {
  try {
    // Validações
    if (!data.ciencia_regras) {
      return { ok: false, error: 'Você precisa ciência das regras para se inscrever' };
    }
    if (!data.consentimento_lgpd) {
      return { ok: false, error: 'Consentimento LGPD é obrigatório' };
    }
    if (!data.nome_completo || !data.email) {
      return { ok: false, error: 'Nome e email são obrigatórios' };
    }

    // Verificar se projeto aceita inscrições
    const verificacao = await verificarInscricoesAbertas(data.projetoId);
    if (!verificacao.aberto) {
      return { ok: false, error: verificacao.erro! };
    }

    // Verificar se já existe inscrição deste email neste projeto
    const existente = await prisma.inscricao.findFirst({
      where: {
        projeto_id: data.projetoId,
        email: data.email,
      },
    });

    if (existente) {
      return { ok: false, error: 'Você já está inscrito neste projeto' };
    }

    // Gerar protocolo único
    const protocolo = await gerarProtocolo();

    // Criar inscrição
    const inscricao = await prisma.inscricao.create({
      data: {
        protocolo,
        projeto_id: data.projetoId,
        user_id: data.userId || null,
        nome_completo: data.nome_completo,
        email: data.email,
        telefone: data.telefone || null,
        curso: data.curso || null,
        turma: data.turma || null,
        semestre: data.semestre || null,
        idade: data.idade || null,
        matricula: data.matricula || null,
        tipo_interesse: data.tipo_interesse,
        disponibilidade: data.disponibilidade || null,
        experiencia_previa: data.experiencia_previa || null,
        justificativa: data.justificativa || null,
        ciencia_regras: data.ciencia_regras,
        consentimento_lgpd: data.consentimento_lgpd,
        campos_extra: (data.campos_extra as Record<string, string>) || {},
        status: 'recebida',
      },
    });

    // Enviar e-mail de confirmação (não bloqueia a resposta)
    enviarConfirmacaoInscricao({
      protocolo: inscricao.protocolo,
      nomeCompleto: data.nome_completo,
      email: data.email,
      projetoNome: verificacao.projeto!.nome,
      tipoInteresse: data.tipo_interesse,
    }).catch(console.error);

    return { ok: true, data: { protocolo: inscricao.protocolo } };
  } catch (e) {
    console.error('Erro ao criar inscrição:', e);
    return { ok: false, error: 'Erro interno ao processar inscrição' };
  }
}
