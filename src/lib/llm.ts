import { fetchAiJson } from '@/lib/ai-http';
/**
 * Camada de LLM desacoplada de provider — hoje usa DeepSeek (chave já configurada).
 * Trocar para Claude API no futuro é mudar só este arquivo; nenhum call site muda.
 *
 * ─── SOBRE O NOME DO MODELO ───────────────────────────────────────────────────
 * Este arquivo é a FONTE ÚNICA do nome do modelo e do endpoint do DeepSeek.
 * Antes, `'deepseek-chat'` estava repetido em 6 arquivos (aqui, em
 * /api/chat, /api/ai/ifizinha, /api/admin/editais/extract-pdf, actions/tags e
 * lib/rag-processor), então trocar de modelo exigia caçar strings pelo projeto
 * inteiro — e esquecer uma significava um call site usando um modelo diferente.
 *
 * Os modelos oficiais hoje são `deepseek-flash` (V4.1-Flash) e
 * `deepseek-v4-pro`. O nome `deepseek-chat` continua funcionando como ALIAS
 * (verificado por chamada real à API: a resposta trouxe `model: "deepseek-flash"`),
 * mas depender de um alias legado é risco desnecessário — se ele for aposentado,
 * todo o chat para de funcionar sem aviso.
 *
 * Configure com `DEEPSEEK_MODEL` no .env para trocar sem tocar em código.
 */
export const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

/** Modelo oficial. `deepseek-chat` é alias legado; `deepseek-flash` é o nome atual. */
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-flash';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  attempts?: number;
  signal?: AbortSignal;
  onResult?: (info: { usage: unknown; finishReason: string | null }) => void;
}

/**
 * Tokens reservados para o RACIOCÍNIO do modelo, além do tamanho da resposta.
 *
 * O `deepseek-flash` é um modelo de raciocínio: os `reasoning_tokens` são gerados
 * ANTES da resposta e dividem o MESMO orçamento de `max_tokens`. Medido numa
 * chamada real de extração de edital (PDF de 4 páginas): 2.196 tokens de
 * raciocínio para apenas 736 de JSON — 2.932 no total.
 *
 * Ignorar isso causou um bug real: o `extract-pdf` pedia `maxTokens: 2000`, o
 * modelo gastava ~1.700 só raciocinando, o JSON era cortado no meio e a tela
 * dizia "a IA encontrou um problema". O teto maior NÃO custa mais caro —
 * `max_tokens` é um limite, não um consumo; só se paga o que é gerado.
 */
const TOKENS_RACIOCINIO_RESERVADOS = 4000;

/** Teto de saída aceito pelo DeepSeek — pedir mais que isso a API recusa. */
const MAX_TOKENS_SAIDA = 8000;

/**
 * Orçamento de `max_tokens` para uma resposta de `tokensDeResposta` tokens.
 *
 * Use SEMPRE que o número representar o tamanho da RESPOSTA esperada — nunca
 * passe o tamanho da resposta direto, porque o raciocínio divide o orçamento.
 */
export function tokensParaResposta(tokensDeResposta: number): number {
  return Math.min(MAX_TOKENS_SAIDA, tokensDeResposta + TOKENS_RACIOCINIO_RESERVADOS);
}

/**
 * Resposta truncada: o modelo atingiu `max_tokens` antes de terminar
 * (`finish_reason: "length"`).
 *
 * É diferente de "IA fora do ar": repetir a mesma chamada do mesmo jeito vai
 * falhar de novo. O chamador deve aumentar o orçamento (`tokensParaResposta`)
 * ou reduzir o pedido, e a mensagem ao usuário precisa refletir isso.
 */
export class LlmRespostaTruncadaError extends Error {
  readonly finishReason = 'length';
  readonly usage: unknown;

  constructor(usage: unknown = null) {
    super('A resposta da IA foi truncada: o limite de tokens de saída foi atingido antes do fim.');
    this.name = 'LlmRespostaTruncadaError';
    this.usage = usage;
  }
}

export function isLlmConfigured(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

/**
 * Gera uma completion de texto. Lança erro se a chamada falhar após as retentativas
 * — o chamador decide como degradar (ex.: seguir sem enriquecimento de IA).
 */
export async function generateCompletion(
  messages: LlmMessage[],
  options: LlmCompletionOptions = {}
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY não configurada');
  }

  const { temperature = 0.3, maxTokens = tokensParaResposta(1500), jsonMode = false } = options;
  const data = await fetchAiJson(DEEPSEEK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: DEEPSEEK_MODEL, messages, temperature, max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}) }),
  }, options);
  const choice = data.choices?.[0];
  options.onResult?.({ usage: data.usage ?? null, finishReason: choice?.finish_reason ?? null });
  if (choice?.finish_reason === 'length') throw new LlmRespostaTruncadaError(data.usage ?? null);
  if (typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) throw new Error('LLM retornou resposta vazia');
  return choice.message.content;
}

/**
 * Extrai o primeiro objeto JSON válido de uma resposta de texto (tolera texto
 * extra antes/depois, que alguns modelos inserem mesmo em modo JSON).
 */
export function parseJsonResponse<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Resposta da IA não contém um JSON válido');
  return JSON.parse(match[0]) as T;
}
