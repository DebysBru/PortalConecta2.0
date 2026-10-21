/**
 * Limites de entrada e validadores das Server Actions.
 *
 * POR QUE UM ARQUIVO SÓ: até agora cada action tinha, no máximo, um "tem pelo
 * menos 2 caracteres". O resto passava direto para o banco — um título de projeto
 * com 5 mil caracteres, um `valorBolsa` negativo (ou 1e308), uma descrição de
 * 900 KB, um link `javascript:` que vira XSS armazenado quando alguém clica.
 * Com os números espalhados, cada tela acaba com um limite diferente; aqui eles
 * ficam num lugar só, e as actions só escolhem qual usar.
 *
 * REGRA: limite de cliente (`maxLength` no input) é conforto, não segurança —
 * quem chama a Server Action direto não passa pelo formulário. Tudo que importa
 * é conferido AQUI, no servidor.
 *
 * Os limites foram escolhidos pelo que o campo realmente precisa (não pelo que o
 * banco aguenta): título de projeto é uma linha; descrição é um texto de página;
 * conteúdo de post é maior porque tem HTML.
 */

// ── Catálogo de limites ───────────────────────────────────────────────────────

const ANO_ATUAL = new Date().getFullYear();

export const LIMITES = {
  /** Nome de pessoa, projeto, vaga, edital, post — sempre uma linha curta. */
  titulo: { min: 2, max: 120 },
  /** Título de post/edital aceita um pouco mais (aparece em listagem grande). */
  tituloLongo: { min: 2, max: 160 },
  /** Resumo/linha de apoio exibida em card. */
  resumo: { min: 0, max: 400 },
  /** Campo de uma linha: área, coordenador, local, instituição. */
  linha: { min: 0, max: 120 },
  /** Texto de página: descrição, objetivo, justificativa, observações. */
  texto: { min: 0, max: 4000 },
  /** HTML do editor rico (conteúdo de post). */
  html: { min: 0, max: 20000 },
  /** URL (http/https) — 500 cobre link de edital com query longa. */
  url: 500,
  email: 160,
  telefone: 20,
  matricula: 30,
  /** Itens por lista (áreas de interesse, habilidades, tags, categorias). */
  lista: { maxItens: 20, maxItem: 60 },
  /** Campos JSON (formulário extra, respostas extras): 32 KB é folgado. */
  jsonBytes: 32 * 1024,
  /** Resposta de uma pergunta extra do formulário do projeto. */
  respostaExtra: 2000,

  ano: { min: 2000, max: ANO_ATUAL + 1 },
  /** Valor de bolsa em reais: teto pedido pela coordenação. */
  valorBolsa: { min: 0, max: 9999.99, casasDecimais: 2 },
  /** Número de vagas de uma vaga específica. */
  quantidadeVagas: { min: 1, max: 999 },
  /** Vagas soltas no cadastro do projeto (campos legados). */
  vagasProjeto: { min: 0, max: 999 },
  /** Horas por semana: 168 é o total de horas de uma semana. */
  cargaHoraria: { min: 1, max: 168 },
  vigenciaMeses: { min: 1, max: 120 },
  idade: { min: 14, max: 100 },
  ordem: { min: 0, max: 999 },
  /** Aceita só #RGB ou #RRGGBB. */
  cor: 7,
} as const;

/** Valores aceitos em campos de opção (o cliente pode mandar qualquer coisa). */
export const OPCOES = {
  tipoInteresse: ['BOLSISTA', 'VOLUNTARIO', 'AMBOS'],
  genero: ['Masculino', 'Feminino', 'Outro'],
  experienciaPrevia: ['nenhuma', 'pouca', 'media', 'muita'],
  statusProjeto: ['ATIVO', 'EM_EXECUCAO', 'ENCERRADO', 'SUSPENSO', 'INSCRICOES_ABERTAS', 'SEM_VAGAS'],
  statusVaga: ['ABERTA', 'EM_SELECAO', 'ENCERRADA', 'CANCELADA'],
} as const;

// ── Resultado ─────────────────────────────────────────────────────────────────

export type Validado<T> = { ok: true; valor: T } | { ok: false; error: string };

function falha(campo: string, motivo: string): { ok: false; error: string } {
  return { ok: false, error: `${campo}: ${motivo}` };
}

// ── Texto ─────────────────────────────────────────────────────────────────────

export function tamanhoLegivel(texto: string): string {
  return texto.length === 1 ? '1 caractere' : `${texto.length} caracteres`;
}

/**
 * Texto de uma linha ou de um parágrafo, com tamanho mínimo e máximo.
 * O valor devolvido já vem sem espaços nas pontas (o que é gravado é ele).
 */
export function validarTexto(
  valor: unknown,
  campo: string,
  faixa: { min: number; max: number },
): Validado<string> {
  if (typeof valor !== 'string') return falha(campo, 'valor inválido.');
  const texto = valor.trim();

  if (texto.length < faixa.min) {
    return falha(campo, `precisa ter pelo menos ${faixa.min === 1 ? '1 caractere' : `${faixa.min} caracteres`}.`);
  }
  if (texto.length > faixa.max) {
    return falha(
      campo,
      `pode ter no máximo ${faixa.max} caracteres (você enviou ${tamanhoLegivel(texto)}). Resuma o texto.`,
    );
  }
  return { ok: true, valor: texto };
}

/** Igual ao anterior, mas devolve `null` quando vazio (campo opcional). */
export function validarTextoOpcional(
  valor: unknown,
  campo: string,
  faixa: { min: number; max: number },
): Validado<string | null> {
  if (valor === null || valor === undefined) return { ok: true, valor: null };
  if (typeof valor !== 'string') return falha(campo, 'valor inválido.');
  if (valor.trim() === '') return { ok: true, valor: null };

  return validarTexto(valor, campo, { min: 1, max: faixa.max });
}

/** Campo de opção: só aceita um dos valores previstos. */
export function validarOpcao<T extends string>(
  valor: unknown,
  campo: string,
  permitidos: readonly T[],
): Validado<T> {
  if (typeof valor === 'string' && (permitidos as readonly string[]).includes(valor)) {
    return { ok: true, valor: valor as T };
  }
  return falha(campo, `escolha uma das opções disponíveis.`);
}

/** Lista de textos (áreas, habilidades, tags): limita quantidade e tamanho. */
export function validarListaDeTextos(
  valor: unknown,
  campo: string,
  faixa: { maxItens: number; maxItem: number } = LIMITES.lista,
): Validado<string[]> {
  if (valor === null || valor === undefined) return { ok: true, valor: [] };
  if (!Array.isArray(valor)) return falha(campo, 'valor inválido.');

  const limpos = valor
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  if (limpos.length > faixa.maxItens) {
    return falha(campo, `pode ter no máximo ${faixa.maxItens} itens (você enviou ${limpos.length}).`);
  }

  const grande = limpos.find((item) => item.length > faixa.maxItem);
  if (grande) {
    return falha(campo, `cada item pode ter no máximo ${faixa.maxItem} caracteres.`);
  }

  // Sem repetição: a mesma área duas vezes não acrescenta nada e suja a exibição.
  return { ok: true, valor: [...new Set(limpos)] };
}

// ── Números ───────────────────────────────────────────────────────────────────

/**
 * Número com faixa e (opcionalmente) inteiro e casas decimais.
 * Recusa `NaN`, `Infinity`, `1e308` e texto não numérico — tudo isso chegaria
 * no banco como valor absurdo.
 */
export function validarNumero(
  valor: unknown,
  campo: string,
  faixa: { min: number; max: number; casasDecimais?: number },
  opcoes: { inteiro?: boolean; opcional?: boolean } = {},
): Validado<number | null> {
  if (valor === null || valor === undefined || valor === '') {
    if (opcoes.opcional) return { ok: true, valor: null };
    return falha(campo, 'é obrigatório.');
  }

  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return falha(campo, 'informe um número válido.');

  if (opcoes.inteiro && !Number.isInteger(numero)) {
    return falha(campo, 'informe um número inteiro.');
  }
  if (numero < faixa.min || numero > faixa.max) {
    const teto = faixa.casasDecimais !== undefined
      ? faixa.max.toFixed(faixa.casasDecimais).replace('.', ',')
      : String(faixa.max);
    return falha(campo, `precisa estar entre ${faixa.min} e ${teto}.`);
  }
  if (faixa.casasDecimais !== undefined) {
    const fator = 10 ** faixa.casasDecimais;
    if (Math.round(numero * fator) / fator !== numero) {
      return falha(campo, `use no máximo ${faixa.casasDecimais} casas decimais.`);
    }
  }

  return { ok: true, valor: numero };
}

/** Ano de 4 dígitos dentro de uma janela razoável (1999 ou 999999 não passam). */
export function validarAno(valor: unknown, campo: string, faixa = LIMITES.ano): Validado<number | null> {
  return validarNumero(valor, campo, faixa, { inteiro: true, opcional: true });
}

// ── URL, e-mail, cor e JSON ───────────────────────────────────────────────────

/**
 * URL aceita para campos que viram link (`href`) na página.
 *
 * SÓ http e https. `javascript:`, `data:`, `vbscript:` e `file:` viram **XSS
 * armazenado** quando alguém clica no link do projeto/edital/post — o React
 * renderiza o `href` como veio, então a checagem tem que acontecer antes de
 * gravar. Caminho relativo (`/files/...`) também é aceito, para os arquivos que o
 * próprio portal guarda.
 */
export function validarUrl(
  valor: unknown,
  campo: string,
  opcoes: { opcional?: boolean } = {},
): Validado<string | null> {
  if (valor === null || valor === undefined || valor === '') {
    return opcoes.opcional === false ? falha(campo, 'é obrigatório.') : { ok: true, valor: null };
  }
  if (typeof valor !== 'string') return falha(campo, 'valor inválido.');

  const url = valor.trim();
  if (url === '') return opcoes.opcional === false ? falha(campo, 'é obrigatório.') : { ok: true, valor: null };

  if (url.length > LIMITES.url) {
    return falha(campo, `pode ter no máximo ${LIMITES.url} caracteres.`);
  }

  // Caminho interno do portal (arquivos enviados): "/files/..."
  if (url.startsWith('/') && !url.startsWith('//')) {
    return { ok: true, valor: url };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return falha(campo, 'informe um endereço completo, começando com https://');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return falha(campo, 'só aceitamos endereços http:// ou https://.');
  }

  return { ok: true, valor: url };
}

/** E-mail: mesma checagem usada na inscrição, com teto de tamanho. */
export function validarEmail(valor: unknown, campo = 'E-mail'): Validado<string> {
  if (typeof valor !== 'string') return falha(campo, 'valor inválido.');
  const email = valor.trim();

  if (email.length > LIMITES.email) return falha(campo, `pode ter no máximo ${LIMITES.email} caracteres.`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return falha(campo, 'informe um e-mail válido, como nome@exemplo.com.');
  }
  return { ok: true, valor: email };
}

/** Telefone: dígitos, espaços, parênteses, hífen e "+", 8 a 15 dígitos. */
export function validarTelefone(valor: unknown, campo = 'Telefone'): Validado<string | null> {
  if (valor === null || valor === undefined || valor === '') return { ok: true, valor: null };
  if (typeof valor !== 'string') return falha(campo, 'valor inválido.');

  const telefone = valor.trim();
  if (telefone === '') return { ok: true, valor: null };
  if (telefone.length > LIMITES.telefone) return falha(campo, `pode ter no máximo ${LIMITES.telefone} caracteres.`);

  const digitos = telefone.replace(/\D/g, '');
  if (!/^[\d\s()+-]+$/.test(telefone) || digitos.length < 8 || digitos.length > 15) {
    return falha(campo, 'use o formato com DDD, por exemplo (43) 99999-0000.');
  }
  return { ok: true, valor: telefone };
}

/** Cor em hexadecimal (#RGB ou #RRGGBB) — vai direto para o CSS da página. */
export function validarCorHexadecimal(valor: unknown, campo = 'Cor'): Validado<string | null> {
  if (valor === null || valor === undefined || valor === '') return { ok: true, valor: null };
  if (typeof valor !== 'string') return falha(campo, 'valor inválido.');

  const cor = valor.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cor)) {
    return falha(campo, 'use uma cor no formato #RRGGBB.');
  }
  return { ok: true, valor: cor };
}

/**
 * Campo JSON (formulário extra, respostas extras): limita o tamanho SERIALIZADO.
 *
 * Sem isso, um `campos_extra` de 900 KB entra no JSONB sem reclamar — e como ele
 * é lido em toda listagem de inscrições, o custo é de todos.
 */
export function validarJsonPequeno(
  valor: unknown,
  campo: string,
  maxBytes = LIMITES.jsonBytes,
): Validado<unknown> {
  if (valor === null || valor === undefined) return { ok: true, valor: {} };

  let serializado: string;
  try {
    serializado = JSON.stringify(valor);
  } catch {
    return falha(campo, 'valor inválido.');
  }

  if (serializado === undefined) return falha(campo, 'valor inválido.');
  // `Buffer.byteLength` conta bytes de verdade (acento ocupa 2).
  if (Buffer.byteLength(serializado, 'utf8') > maxBytes) {
    return falha(campo, `é grande demais (limite de ${Math.round(maxBytes / 1024)} KB).`);
  }
  return { ok: true, valor };
}

/**
 * Mapa de respostas das perguntas extras do projeto.
 *
 * Cada resposta é texto curto (ou lista de opções) e o conjunto tem teto de
 * tamanho: o formulário do coordenador pode ter várias perguntas e cada uma
 * aceitava qualquer coisa até agora.
 */
export function validarMapaDeRespostas(
  valor: unknown,
  campo: string,
  maxPorResposta = LIMITES.respostaExtra,
): Validado<Record<string, unknown>> {
  if (valor === null || valor === undefined) return { ok: true, valor: {} };
  if (typeof valor !== 'object' || Array.isArray(valor)) return falha(campo, 'valor inválido.');

  const entradas = Object.entries(valor as Record<string, unknown>);
  if (entradas.length > 50) return falha(campo, 'tem respostas demais.');

  const limpo: Record<string, unknown> = {};

  for (const [chave, resposta] of entradas) {
    if (typeof resposta === 'string') {
      if (resposta.length > maxPorResposta) {
        return falha(`${campo} (${chave})`, `pode ter no máximo ${maxPorResposta} caracteres.`);
      }
      limpo[chave] = resposta.trim();
      continue;
    }
    if (typeof resposta === 'number' || typeof resposta === 'boolean' || resposta === null) {
      limpo[chave] = resposta;
      continue;
    }
    if (Array.isArray(resposta)) {
      // Múltipla escolha: lista de opções marcadas.
      const lista = resposta.filter((r): r is string => typeof r === 'string');
      if (lista.length !== resposta.length || lista.some((r) => r.length > maxPorResposta)) {
        return falha(`${campo} (${chave})`, 'resposta inválida.');
      }
      limpo[chave] = lista;
      continue;
    }
    return falha(`${campo} (${chave})`, 'resposta inválida.');
  }

  const tamanho = validarJsonPequeno(limpo, campo);
  if (!tamanho.ok) return tamanho;

  return { ok: true, valor: limpo };
}

/**
 * Valida vários campos de URL de uma vez.
 *
 * Atalho para o caso mais repetido do portal: formulários que têm `site`,
 * `instagram`, `linkOficial`, `linkExterno`, `arquivoPdfUrl`... Todos viram
 * `href` na página pública, então todos precisam da mesma checagem (só
 * http/https ou caminho interno) — e nenhum pode virar `javascript:`.
 *
 * ```ts
 * const urls = validarUrls({
 *   site: { valor: data.site, rotulo: 'Site' },
 *   linkExterno: { valor: data.linkExterno, rotulo: 'Link externo' },
 * });
 * if (!urls.ok) return urls;
 * // urls.valor.site, urls.valor.linkExterno (null quando vazio)
 * ```
 */
export function validarUrls(
  campos: Record<string, { valor: unknown; rotulo: string }>,
): Validado<Record<string, string | null>> {
  const limpos: Record<string, string | null> = {};

  for (const [chave, { valor, rotulo }] of Object.entries(campos)) {
    const resultado = validarUrl(valor, rotulo, { opcional: true });
    if (!resultado.ok) return resultado;
    limpos[chave] = resultado.valor;
  }

  return { ok: true, valor: limpos };
}

/**
 * Roda a validação só quando o campo VEIO na requisição (update parcial).
 *
 * Sem isto, um update que não manda `status` seria recusado por "escolha uma das
 * opções" — e, pior, um projeto vindo do SUAP (onde o servidor remove os campos
 * institucionais do payload) não poderia ser salvo de jeito nenhum.
 */
export function validarSePresente<T>(
  valor: unknown,
  validar: (valor: unknown) => Validado<T>,
): Validado<T | null> {
  if (valor === undefined) return { ok: true, valor: null };
  return validar(valor);
}

// ── Combinador ────────────────────────────────────────────────────────────────

/**
 * Roda várias validações e para na primeira que falhar.
 *
 * Uso nas actions:
 * ```ts
 * const v = validarCampos({
 *   titulo: () => validarTexto(data.titulo, 'Título', LIMITES.titulo),
 *   valorBolsa: () => validarNumero(data.valorBolsa, 'Valor da bolsa', LIMITES.valorBolsa),
 * });
 * if (!v.ok) return v;           // { ok: false, error: 'Valor da bolsa: ...' }
 * ```
 */
export function validarCampos<T extends Record<string, unknown>>(
  checagens: { [K in keyof T]: () => Validado<T[K]> },
): Validado<T> {
  const valores = {} as T;
  for (const chave of Object.keys(checagens) as Array<keyof T>) {
    const resultado = checagens[chave]();
    if (!resultado.ok) return resultado;
    valores[chave] = resultado.valor;
  }
  return { ok: true, valor: valores };
}
