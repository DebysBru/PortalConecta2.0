import { prisma } from '@/lib/prisma';

/**
 * PRODUTOR de notificações internas (ROADMAP 6.2).
 *
 * Fica fora de `src/actions/notificacoes.ts` de propósito: tudo que é exportado
 * de um arquivo `'use server'` vira endpoint público — um "criar notificação
 * para qualquer usuário" seria um vetor de spam/phishing dentro do portal.
 *
 * Segue o padrão dos envios de e-mail: nunca lança. Um aviso que falha não pode
 * derrubar a ação de negócio que o disparou (mudar status de inscrição etc.).
 */

export type NovaNotificacao = {
  userId: string;
  titulo: string;
  texto?: string | null;
  link?: string | null;
};

export async function criarNotificacao(input: NovaNotificacao): Promise<boolean> {
  if (!input.userId) return false;

  try {
    await prisma.notificacao.create({
      data: {
        user_id: input.userId,
        titulo: input.titulo,
        texto: input.texto ?? null,
        link: input.link ?? null,
      },
    });
    return true;
  } catch (error) {
    console.warn('[notificacoes] falha ao criar notificação:', error);
    return false;
  }
}

/** Rótulos usados na notificação de mudança de status de inscrição. */
export const ROTULO_STATUS_INSCRICAO: Record<string, string> = {
  recebida: 'Recebida',
  em_analise: 'Em análise',
  selecionado: 'Selecionado',
  lista_espera: 'Lista de espera',
  nao_selecionado: 'Não selecionado',
  desistente: 'Desistente',
};

export function rotuloStatusInscricao(status: string): string {
  return ROTULO_STATUS_INSCRICAO[status] ?? status;
}

/**
 * Avisa o estudante (no portal) que a inscrição dele mudou de status.
 * Espelha o e-mail `enviarAtualizacaoStatus` — quem não acompanha e-mail acaba
 * sabendo pelo sino.
 *
 * O destino é "Meus Dados", e não a página do projeto: é lá que ficam os botões
 * de aceitar/recusar a convocação e de desistir. Mandar o aluno para a página do
 * projeto (como era antes) fazia ele ler "você foi selecionado" e não ter o que
 * fazer com a informação.
 */
export async function notificarMudancaStatusInscricao(input: {
  userId?: string | null;
  protocolo: string;
  projetoNome: string;
  novoStatus: string;
}): Promise<boolean> {
  if (!input.userId) return false;

  return criarNotificacao({
    userId: input.userId,
    titulo: `Sua inscrição em "${input.projetoNome}" foi atualizada`,
    texto: `Protocolo ${input.protocolo} — novo status: ${rotuloStatusInscricao(input.novoStatus)}.`,
    link: '/meus-dados',
  });
}

/**
 * Avisa QUEM coordena o projeto (admins + coordenadores) de algo que o
 * estudante fez na inscrição — aceitou/recusou uma convocação ou desistiu.
 *
 * Espelha o que `notificarMudancaStatusInscricao` faz para o estudante: é o
 * caminho inverso, e sem ele o coordenador só descobriria uma desistência
 * abrindo a lista de inscrições do projeto por acaso. Nunca lança (um aviso que
 * falha não pode desfazer a ação do estudante) e devolve quantos foram avisados.
 */
export async function notificarCoordenadoresDoProjeto(input: {
  projetoId: string;
  titulo: string;
  texto?: string | null;
  link?: string | null;
}): Promise<number> {
  try {
    const projeto = await prisma.projeto.findUnique({
      where: { id: input.projetoId },
      select: {
        admins: { select: { id: true } },
        coordenadores: { select: { user_id: true } },
      },
    });
    if (!projeto) return 0;

    const destinatarios = new Set<string>([
      ...projeto.admins.map((a) => a.id),
      ...projeto.coordenadores.map((c) => c.user_id),
    ]);
    if (destinatarios.size === 0) return 0;

    const envios = await Promise.all(
      [...destinatarios].map((userId) =>
        criarNotificacao({
          userId,
          titulo: input.titulo,
          texto: input.texto ?? null,
          link: input.link ?? null,
        }),
      ),
    );

    return envios.filter(Boolean).length;
  } catch (error) {
    console.warn('[notificacoes] falha ao avisar coordenadores:', error);
    return 0;
  }
}
