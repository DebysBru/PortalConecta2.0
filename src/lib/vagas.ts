/**
 * Regras de ocupação de VAGA (quantas pessoas podem ficar com `status =
 * 'selecionado'` em cada vaga do projeto).
 *
 * POR QUE ESTE ARQUIVO EXISTE: o bloqueio de "vaga cheia" recusava a seleção com
 * uma mensagem que só dizia *que* estava cheia ("já está com todas as 1
 * posições preenchidas"). Quem coordena tinha acabado de mudar alguém para
 * "desistente" e concluía, com razão, que a vaga tinha vagado — sem saber que
 * OUTRA inscrição daquela mesma vaga continuava marcada como "selecionado"
 * (estado que veio de antes desta checagem existir: 2 selecionados numa vaga de
 * 1 posição). A mensagem agora NOMEIA quem está ocupando, que é a informação
 * que faltava para resolver.
 *
 * É puro (sem Prisma) para poder ser testado e reaproveitado na tela.
 */

export type OcupanteDaVaga = {
  nome: string;
  protocolo: string;
};

/** Quantos ocupantes a mensagem lista antes de resumir com "e mais N". */
export const MAX_OCUPANTES_NA_MENSAGEM = 3;

/** A vaga está com mais gente selecionada do que posições (estado inconsistente antigo). */
export function vagaExcedeCota(selecionados: number, quantidade: number): boolean {
  return selecionados > quantidade;
}

/** "Felipe Andrade Rocha (PRJ-2026-000005)" */
export function descreverOcupante(ocupante: OcupanteDaVaga): string {
  const nome = ocupante.nome?.trim() || 'Inscrito(a) sem nome';
  return ocupante.protocolo ? `${nome} (${ocupante.protocolo})` : nome;
}

/** Lista legível: "A (P1), B (P2) e mais 2". */
export function listarOcupantes(
  ocupantes: readonly OcupanteDaVaga[],
  max: number = MAX_OCUPANTES_NA_MENSAGEM,
): string {
  const visiveis = ocupantes.slice(0, max).map(descreverOcupante);
  const restantes = ocupantes.length - visiveis.length;
  return restantes > 0 ? `${visiveis.join(', ')} e mais ${restantes}` : visiveis.join(', ');
}

function posicoes(quantidade: number): string {
  return quantidade === 1 ? 'A única posição' : `As ${quantidade} posições`;
}

/**
 * Mensagem do bloqueio, já com quem ocupa a vaga e o que fazer.
 *
 * Regra que NÃO pode regredir: a mensagem sempre diz **quem** está ocupando.
 * Sem isso, quem coordena fica sem saber de quem é a vaga que ele acha que
 * liberou — foi exatamente o relato que originou esta mudança.
 */
export function mensagemVagaLotada(input: {
  titulo: string;
  quantidade: number;
  ocupantes: readonly OcupanteDaVaga[];
}): string {
  const { titulo, quantidade, ocupantes } = input;
  const quem = listarOcupantes(ocupantes);

  const saida =
    'Para dar esta vaga a outra pessoa, mude o status de quem está selecionado (por exemplo, para "lista de espera") ou aumente a quantidade de posições da vaga.';

  if (vagaExcedeCota(ocupantes.length, quantidade)) {
    return (
      `A vaga "${titulo}" está com ${ocupantes.length} selecionados para ${quantidade} posição(ões) — ` +
      `mais do que ela oferece (isso veio de antes de o portal limitar a seleção por vaga). ` +
      `Quem está marcado como selecionado agora: ${quem}. ${saida}`
    );
  }

  return `${posicoes(quantidade)} da vaga "${titulo}" já ${quantidade === 1 ? 'está preenchida' : 'estão preenchidas'} por ${quem}. ${saida}`;
}
