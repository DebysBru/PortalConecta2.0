import { validarListaDeTextos, type Validado } from './validacao';

/**
 * Equipe de estudantes e financiamento do projeto.
 *
 * Por que existe: a sugestão recebida pela coordenação foi que, junto ao resumo
 * do projeto, a página pública mostre quem já atua nele (bolsistas e
 * voluntários) — ver gente no projeto motiva os demais a se inscrever — e de
 * onde vem o dinheiro (IFPR, CNPq, Fundação Araucária, emenda parlamentar...).
 * Antes disso o resumo só falava do projeto, nunca das pessoas nem do
 * financiamento.
 *
 * O campo legado `Projeto.alunos` é texto livre, sem papel e sem exibição
 * pública; por isso a equipe ganhou campos próprios, um por papel. É a
 * coordenação quem digita os nomes (e é ela quem responde pelo consentimento
 * dos estudantes em aparecer — o portal não lista inscritos automaticamente).
 *
 * REGRA: quem chama a Server Action direto não passa pelo formulário, então o
 * limite é aplicado AQUI, no servidor. O `maxLength` do input é só conforto.
 */

/** Fontes de financiamento mais comuns no IFPR — botões de atalho no formulário. */
export const FINANCIAMENTOS_SUGERIDOS = [
  'IFPR',
  'CNPq',
  'Fundação Araucária',
  'Emenda Parlamentar',
] as const;

/**
 * Tetos das listas. Nome de estudante é curto e o projeto tem dezenas, não
 * centenas; financiamento é um punhado de fontes (e o campo aceita "afins").
 */
export const LIMITES_EQUIPE = {
  estudantes: { maxItens: 30, maxItem: 80 },
  financiamento: { maxItens: 8, maxItem: 60 },
} as const;

/** Lista de estudantes (bolsistas OU voluntários) pronta para gravar. */
export function normalizarEstudantes(
  valor: unknown,
  rotulo: 'Estudantes bolsistas' | 'Estudantes voluntários',
): Validado<string[]> {
  return validarListaDeTextos(valor, rotulo, LIMITES_EQUIPE.estudantes);
}

/** Fontes de financiamento prontas para gravar. */
export function normalizarFinanciamento(valor: unknown): Validado<string[]> {
  return validarListaDeTextos(valor, 'Financiamento', LIMITES_EQUIPE.financiamento);
}

export type EquipeDoProjeto = {
  bolsistas: string[];
  voluntarios: string[];
  /** Bolsistas + voluntários (para o "N estudante(s)" do cartão público). */
  total: number;
};

type ProjetoComEquipe = {
  estudantesBolsistas?: string[] | null;
  estudantesVoluntarios?: string[] | null;
};

function limparNomes(nomes: string[] | null | undefined): string[] {
  return (nomes ?? []).map((nome) => nome.trim()).filter(Boolean);
}

/**
 * Separa a equipe em bolsistas e voluntários, descartando vazio/espaço.
 * A página pública não renderiza o cartão quando `total` é 0.
 */
export function equipeDoProjeto(projeto: ProjetoComEquipe): EquipeDoProjeto {
  const bolsistas = limparNomes(projeto.estudantesBolsistas);
  const voluntarios = limparNomes(projeto.estudantesVoluntarios);
  return { bolsistas, voluntarios, total: bolsistas.length + voluntarios.length };
}

/** Fontes de financiamento exibíveis (sem vazio nem repetição). */
export function financiamentoDoProjeto(projeto: {
  financiamento?: string[] | null;
}): string[] {
  const vistos = new Set<string>();
  for (const fonte of limparNomes(projeto.financiamento)) {
    vistos.add(fonte);
  }
  return [...vistos];
}
