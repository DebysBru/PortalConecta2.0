'use server';

import { prisma } from '@/lib/prisma';
import { generateCompletion, tokensParaResposta } from '@/lib/llm';
import { MENSAGENS, mensagemAmigavel } from '@/lib/mensagens';
import { getVerifiedServerSession } from '@/lib/session';

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/** Sem checagem nenhuma antes (achado S19) — não chamadas por nenhuma página hoje, mas
 *  continuam invocáveis diretamente como Server Actions. Agora exigem, além do papel,
 *  que o e-mail seja o da SESSÃO verificada (o e-mail sozinho não prova identidade). */
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

/**
 * Lista todas as tags do sistema
 */
export async function listTags() {
  return prisma.projetoTag.groupBy({
    by: ['tag'],
    _count: { tag: true },
    orderBy: { _count: { tag: 'desc' } },
  });
}

/**
 * Sugere tags para um projeto/baseado no resumo
 */
export async function sugerirTags(
  nome: string,
  resumo: string,
  area: string
): Promise<ActionResult<string[]>> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { ok: false, error: MENSAGENS.iaNaoConfigurada };
  }

  const TAGS_DISPONIVEIS = [
    'Tecnologia', 'Informática', 'Robótica', 'Agronomia', 'Ecologia',
    'Meio Ambiente', 'Eletrônica', 'Educação', 'Arte', 'Música',
    'Ed. Física', 'Jogos', 'Saúde', 'Direito', 'Comunicação',
    'Administração', 'Economia', 'Alimentos', 'Veterinária', 'Física',
    'Química', 'Biologia', 'Matemática', 'Letras', 'História',
    'Geografia', 'Filosofia', 'Sociologia', 'Psicologia', 'Pedagogia',
  ];

  const prompt = `Analise o projeto abaixo e sugira as tags mais relevantes da lista disponível.

PROJETO: ${nome}
ÁREA: ${area}
RESUMO: ${resumo}

TAGS DISPONÍVEIS: ${TAGS_DISPONIVEIS.join(', ')}

Responda APENAS com as tags separadas por vírgula (máximo 5 tags). Exemplo: Tecnologia, Robótica, Educação`;

  let content: string;
  const session = await getVerifiedServerSession();
  const auth = await requireAdminEmail(session?.email);
  if (!auth.ok) return auth;
  try {
    content = await generateCompletion([
      { role: 'system', content: 'Você é um classificador de projetos acadêmicos. Responda apenas com tags separadas por vírgula.' },
      { role: 'user', content: prompt.slice(0, 16000) },
    // A resposta são 5 tags curtas, mas o raciocínio do modelo divide o orçamento
    // de `max_tokens` — com o teto antigo de 100 o conteúdo voltava vazio e a
    // sugestão falhava sempre (ver tokensParaResposta em lib/llm).
    ], { temperature: 0.3, maxTokens: tokensParaResposta(200) });
  } catch { return { ok: false, error: 'A IA não conseguiu sugerir tags agora. Escolha manualmente ou tente novamente.' }; }

  // Extrair tags da resposta
  const tags = content
    .split(',')
    .map((t: string) => t.trim())
    .filter((t: string) => TAGS_DISPONIVEIS.includes(t));

  return { ok: true, data: tags.slice(0, 5) };
}

/**
 * Adiciona tags a um projeto
 */
export async function adicionarTagsProjeto(
  projetoId: string,
  tags: string[],
  origem: 'MANUAL' | 'IA',
  callerEmail: string
): Promise<ActionResult> {
  try {
    const auth = await requireAdminEmail(callerEmail);
    if (!auth.ok) return auth;

    // Remover tags existentes
    await prisma.projetoTag.deleteMany({
      where: { projeto_id: projetoId },
    });

    // Adicionar novas tags
    if (tags.length > 0) {
      await prisma.projetoTag.createMany({
        data: tags.map((tag) => ({
          projeto_id: projetoId,
          tag,
          origem,
          aprovada: origem === 'MANUAL',
        })),
      });
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensagemAmigavel(e, MENSAGENS.operacaoNaoConcluida) };
  }
}

/**
 * Aprova tags sugeridas por IA
 */
export async function aprovarTag(
  projetoId: string,
  tag: string,
  callerEmail: string
): Promise<ActionResult> {
  try {
    const auth = await requireAdminEmail(callerEmail);
    if (!auth.ok) return auth;

    await prisma.projetoTag.update({
      where: {
        projeto_id_tag: { projeto_id: projetoId, tag },
      },
      data: { aprovada: true },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensagemAmigavel(e, MENSAGENS.operacaoNaoConcluida) };
  }
}

/**
 * Remove uma tag de um projeto
 */
export async function removerTag(
  projetoId: string,
  tag: string,
  callerEmail: string
): Promise<ActionResult> {
  try {
    const auth = await requireAdminEmail(callerEmail);
    if (!auth.ok) return auth;

    await prisma.projetoTag.delete({
      where: {
        projeto_id_tag: { projeto_id: projetoId, tag },
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensagemAmigavel(e, MENSAGENS.operacaoNaoConcluida) };
  }
}
