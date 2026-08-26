/**
 * EmbeddingService — Camada Isolada de Embeddings para RAG
 *
 * Provedor: Google Gemini (`gemini-embedding-2`), tier gratuito — sem custo e
 * sem cartão de crédito, só a API key do Google AI Studio. Saída forçada para
 * 1536 dimensões via `output_dimensionality` para casar com a coluna
 * `vector(1536)` do pgvector (schema não muda ao trocar de provedor).
 */

import { createHash } from 'crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger('embeddings');

export interface EmbeddingConfig {
  apiKey?: string;
  model: string;
  dimensions: number;
  maxBatchSize: number;
}

const DEFAULT_CONFIG: EmbeddingConfig = {
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.EMBEDDING_MODEL || 'gemini-embedding-2',
  dimensions: 1536,
  maxBatchSize: 64,
};

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gera embedding para um único texto.
 */
export async function generateEmbedding(
  text: string,
  config: Partial<EmbeddingConfig> = {}
): Promise<number[]> {
  const [embedding] = await generateBatchEmbeddings([text], config);
  return embedding;
}

/**
 * Gera embeddings para múltiplos textos em lotes (batching) com retentativa.
 */
export async function generateBatchEmbeddings(
  texts: string[],
  customConfig: Partial<EmbeddingConfig> = {}
): Promise<number[][]> {
  const cfg: EmbeddingConfig = { ...DEFAULT_CONFIG, ...customConfig };

  if (texts.length === 0) return [];

  // Sanitizar textos (remover quebras excessivas)
  const cleanedTexts = texts.map((t) => (t || '').replace(/\r\n|\r|\n/g, ' ').trim() || ' ');

  // Se não houver chave de API configurada, utiliza fallback determinístico (evita quebra em dev/testes)
  if (!cfg.apiKey) {
    log.warn('GEMINI_API_KEY não configurada — usando embeddings determinísticos de fallback (sem busca semântica real)', {
      totalTextos: cleanedTexts.length,
    });
    return cleanedTexts.map((t) => generateDeterministicMockVector(t, cfg.dimensions));
  }

  const results: number[][] = [];
  const batchSize = Math.min(cfg.maxBatchSize, 64);

  for (let i = 0; i < cleanedTexts.length; i += batchSize) {
    const batch = cleanedTexts.slice(i, i + batchSize);
    const batchEmbeddings = await requestGeminiEmbeddingsWithRetry(batch, cfg);
    results.push(...batchEmbeddings);
  }

  return results;
}

/**
 * Chamada à API de Embeddings do Gemini (batchEmbedContents) com retry exponencial.
 */
async function requestGeminiEmbeddingsWithRetry(
  inputs: string[],
  cfg: EmbeddingConfig,
  retries = 3
): Promise<number[][]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${GEMINI_BASE_URL}/${cfg.model}:batchEmbedContents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cfg.apiKey!,
        },
        body: JSON.stringify({
          requests: inputs.map((text) => ({
            model: `models/${cfg.model}`,
            content: { parts: [{ text }] },
            output_dimensionality: cfg.dimensions,
          })),
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`Gemini Embedding API error (${response.status}): ${errBody.slice(0, 300)}`);
      }

      const data = await response.json();
      if (!data.embeddings || !Array.isArray(data.embeddings)) {
        throw new Error('Formato inesperado retornado pela API de embeddings');
      }

      // A API do Gemini não retorna um índice — a ordem da resposta corresponde
      // à ordem das requisições enviadas em `requests`.
      return data.embeddings.map((item: { values: number[] }) => {
        validateEmbedding(item.values, cfg.dimensions);
        return item.values;
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn('Tentativa de embedding falhou', { tentativa: attempt, totalTentativas: retries, erro: lastError.message });
      if (attempt < retries) {
        // Backoff exponencial: 500ms, 1000ms, 2000ms
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 500));
      }
    }
  }

  throw lastError || new Error('Falha ao gerar embeddings após retentativas.');
}

/**
 * Valida a dimensão e formato do vetor gerado.
 */
export function validateEmbedding(vec: number[], expectedDim = 1536): boolean {
  if (!Array.isArray(vec) || vec.length !== expectedDim) {
    throw new Error(`Embedding inválido: esperado vetor de ${expectedDim} dimensões, recebido ${vec?.length}`);
  }
  for (let i = 0; i < Math.min(vec.length, 5); i++) {
    if (typeof vec[i] !== 'number' || isNaN(vec[i])) {
      throw new Error(`Embedding contém valores numéricos inválidos na posição ${i}`);
    }
  }
  return true;
}

/**
 * Calcula a similaridade por cosseno entre dois vetores normalizados.
 */
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

/**
 * Fallback determinístico de vetor normalizado para modo de desenvolvimento sem API key.
 * Gera vetor pseudo-aleatório baseado no hash SHA-256 do texto.
 */
function generateDeterministicMockVector(text: string, dimensions = 1536): number[] {
  const vector = new Array(dimensions).fill(0);
  const hash = createHash('sha256').update(text).digest();

  for (let i = 0; i < dimensions; i++) {
    const byte = hash[i % hash.length];
    const pseudoRand = ((byte * (i + 1) * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    vector[i] = (pseudoRand - 0.5) * 2;
  }

  // Normalizar para norma unitária (L2 = 1.0)
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) sumSq += vector[i] * vector[i];
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < dimensions; i++) vector[i] = vector[i] / norm;

  return vector;
}
