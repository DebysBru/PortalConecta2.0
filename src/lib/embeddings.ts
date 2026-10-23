import { fetchAiJson } from '@/lib/ai-http';
import { reservarQuotaEmbedding } from '@/lib/embedding-quota';

export interface EmbeddingConfig {
  apiKey?: string; model: string; dimensions: number; maxBatchSize: number;
  timeoutMs?: number; attempts?: number; signal?: AbortSignal;
}
export function embeddingConfig(): EmbeddingConfig {
  return { apiKey: process.env.GEMINI_API_KEY, model: process.env.EMBEDDING_MODEL || 'gemini-embedding-2', dimensions: 1536, maxBatchSize: 64 };
}
export const EMBEDDING_INPUT_VERSION = 'section-text-v1';
export function embeddingSignature(model = embeddingConfig().model) { return `gemini:${model}:1536:${EMBEDDING_INPUT_VERSION}`; }
/** Texto original é a evidência; tabela reescrita por IA não substitui esse texto. */
export function textoParaEmbedding(chunk: { texto: string; secao?: string | null }) {
  return chunk.secao ? `${chunk.secao}: ${chunk.texto}` : chunk.texto;
}
export class EmbeddingNotConfigured extends Error {}
export function getEmbeddingProviderStatus() {
  const config = embeddingConfig();
  return { provider: config.apiKey ? 'gemini' : 'textual', model: config.model, dimensions: config.dimensions,
    semantico: !!config.apiKey, aviso: config.apiKey ? null : 'Sem chave do serviço de embeddings. A busca textual continua disponível; nenhum vetor simulado será gravado.' };
}
export async function generateEmbedding(text: string, config: Partial<EmbeddingConfig> = {}): Promise<number[]> {
  const [embedding] = await generateBatchEmbeddings([text], config);
  return embedding;
}
export async function generateBatchEmbeddings(texts: string[], customConfig: Partial<EmbeddingConfig> = {}): Promise<number[][]> {
  if (!texts.length) return [];
  const cfg = { ...embeddingConfig(), ...customConfig };
  if (!cfg.apiKey?.trim()) throw new EmbeddingNotConfigured('Serviço de embeddings não configurado');
  if (!Number.isInteger(cfg.maxBatchSize) || cfg.maxBatchSize < 1) throw new Error('Lote inválido');
  const results: number[][] = [];
  const batchSize = Math.min(cfg.maxBatchSize, 64, Math.max(1, Number(process.env.EMBEDDING_RPM) || 95));
  for (let i = 0; i < texts.length; i += batchSize) {
    const inputs = texts.slice(i, i + batchSize).map(text => text.replace(/\s+/g, ' ').trim());
    if (inputs.some(text => !text)) throw new Error('Texto vazio para embedding');
    const data = await fetchAiJson(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:batchEmbedContents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
      body: JSON.stringify({ requests: inputs.map(text => ({ model: `models/${cfg.model}`, content: { parts: [{ text }] }, output_dimensionality: cfg.dimensions })) }),
    }, { timeoutMs: cfg.timeoutMs ?? 90_000, attempts: cfg.attempts ?? 3, signal: cfg.signal,
      beforeAttempt: signal => reservarQuotaEmbedding(cfg.apiKey!, inputs.length, signal) });
    if (!Array.isArray(data.embeddings) || data.embeddings.length !== inputs.length) throw new Error('Quantidade inesperada de embeddings');
    for (const item of data.embeddings) { validateEmbedding(item.values, cfg.dimensions); results.push(item.values); }
  }
  return results;
}
export function validateEmbedding(vec: number[], expectedDim = 1536): boolean {
  if (!Array.isArray(vec) || vec.length !== expectedDim || !vec.every(Number.isFinite) || !vec.some(v => v !== 0)) throw new Error('Embedding inválido: dimensão, valores ou norma incorretos');
  return true;
}
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}
