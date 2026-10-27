/**
 * ==============================================================================
 * QUEM A PERGUNTA ESTÁ CITANDO?
 * ==============================================================================
 *
 * "Quais projetos o prof. Ronan está envolvido?" não é uma pergunta sobre
 * projetos em geral — é sobre UMA pessoa. Sem reconhecer isso, o chat pegava os
 * "10 projetos mais recentes/em destaque do portal" e o modelo listava só os que
 * por acaso eram daquela pessoa. Medido no portal: o prof. Ronan coordena 6
 * projetos, mas só 1 aparecia nesse recorte; os outros 5 vinham (incompletos) da
 * busca semântica, e o do "TV Box" ficou de fora até alguém citar o nome dele.
 *
 * Detectar o nome sem um modelo de NLP: comparamos a pergunta com a LISTA REAL
 * de coordenadores que já existe no banco. É barato (dezenas de nomes), não
 * erra nomes próprios e não precisa de biblioteca nova.
 *
 * Regras:
 *  - token de nome com 5+ letras conta (ignora "dos", "da", "de"...);
 *  - casa por palavra inteira, sem acento e sem diferenciar maiúsculas;
 *  - ganha quem tiver mais tokens casados; empate fica com quem casou o
 *    PRIMEIRO nome (é o mais distintivo: "Ronan" vale mais que "Silva").
 */

const PARTICULAS = new Set([
  'dos', 'das', 'de', 'da', 'do', 'e', 'di', 'du', 'del', 'della', 'van', 'von',
]);

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Tokens "com nome": 5+ letras e que não são partícula. */
function tokensDeNome(nome: string): string[] {
  return normalizar(nome)
    .split(/[^a-z]+/)
    .filter((token) => token.length >= 5 && !PARTICULAS.has(token));
}

/**
 * Devolve o nome do coordenador citado na pergunta, ou null.
 *
 * `nomesConhecidos` é a lista de coordenadores que existe no banco — a função é
 * pura para poder ser testada sem tocar no Prisma.
 */
export function detectarPessoaCitada(
  pergunta: string,
  nomesConhecidos: Array<string | null | undefined>
): string | null {
  const alvo = ` ${normalizar(pergunta).replace(/[^a-z]+/g, ' ')} `;
  const candidatos: Array<{ nome: string; pontos: number; primeiroNomeCasou: boolean }> = [];

  for (const nome of nomesConhecidos) {
    if (!nome || !nome.trim()) continue;

    const tokens = tokensDeNome(nome);
    if (tokens.length === 0) continue;

    const casados = tokens.filter((token) => alvo.includes(` ${token} `));
    if (casados.length === 0) continue;

    candidatos.push({
      nome: nome.trim(),
      pontos: casados.length,
      primeiroNomeCasou: casados.includes(tokens[0]),
    });
  }

  if (candidatos.length === 0) return null;

  candidatos.sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (Number(b.primeiroNomeCasou) !== Number(a.primeiroNomeCasou)) {
      return Number(b.primeiroNomeCasou) - Number(a.primeiroNomeCasou);
    }
    return b.nome.length - a.nome.length;
  });

  return candidatos[0].nome;
}
