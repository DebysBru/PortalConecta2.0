/**
 * Regras do estudante sobre a PRÓPRIA inscrição: quando pode desistir e quando
 * pode responder a uma convocação.
 *
 * Fica aqui (puro, sem Prisma) porque as mesmas regras decidem duas coisas
 * diferentes: quais botões aparecem em "Suas Inscrições" (client) e o que a
 * Server Action de fato aceita (server). Duplicar isso é como se cria o clássico
 * "o botão aparece, mas o servidor recusa" — os testes deste arquivo travam a
 * regra, e a action só chama as funções.
 */

export type RespostaConvocacao = 'aceito' | 'recusado';

/**
 * Status de inscrição que já são um ponto final. Mudar qualquer um deles para
 * "desistente" só perderia informação ("não selecionado" viraria "desistente"),
 * então não oferecemos a ação.
 */
export const STATUS_ENCERRADOS = ['desistente', 'nao_selecionado'] as const;

/** Convocações pendentes de resposta só existem enquanto o status é `selecionado`. */
export const STATUS_CONVOCADO = 'selecionado';

export function podeDesistir(status: string): boolean {
  return !(STATUS_ENCERRADOS as readonly string[]).includes(status);
}

/** O aluno foi convocado e ainda não respondeu. */
export function podeResponderConvocacao(
  status: string,
  respostaAluno: string | null | undefined,
): boolean {
  return status === STATUS_CONVOCADO && !respostaAluno;
}

export function ehRespostaConvocacao(valor: unknown): valor is RespostaConvocacao {
  return valor === 'aceito' || valor === 'recusado';
}

export const ROTULO_RESPOSTA_ALUNO: Record<RespostaConvocacao, string> = {
  aceito: 'Convocação aceita',
  recusado: 'Convite recusado',
};

export function rotuloRespostaAluno(resposta: string | null | undefined): string | null {
  return ehRespostaConvocacao(resposta) ? ROTULO_RESPOSTA_ALUNO[resposta] : null;
}
