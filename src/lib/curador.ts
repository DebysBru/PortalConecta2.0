/**
 * Curador — enriquece chunks já criados (rule-based, Etapa 2) com metadados de IA:
 * resumo/categoria/tags do documento, título de seção quando a regra não achou um,
 * e reformulação de trechos que parecem tabela. A IA NÃO decide onde cortar os
 * chunks — isso já foi feito de forma determinística antes desta etapa.
 */

import { generateCompletion, parseJsonResponse, isLlmConfigured } from '@/lib/llm';

const MIN_QUALITY_WORDS = 15;
const MAX_INPUT_CHARS = 16000;

export interface ChunkInput {
  chunkIndex: number;
  texto: string;
  secao: string | null;
}

export interface ChunkCuradoria {
  chunkIndex: number;
  secao?: string | null;
  tabelaReformatada?: string;
  qualidade: 'ok' | 'curto';
}

export interface DocumentoCuradoria {
  resumo: string;
  categoria: string;
  tags: string[];
  chunks: ChunkCuradoria[];
}

const CATEGORIAS_VALIDAS = ['Ensino', 'Pesquisa', 'Extensão', 'Inovação', 'Institucional'];

/** Heurística leve (sem IA) para sinalizar trechos que provavelmente são tabelas. */
function pareceTabela(texto: string): boolean {
  const linhas = texto.split('\n').filter((l) => l.trim());
  if (linhas.length < 3) return false;

  const linhasComPadraoTabular = linhas.filter((l) =>
    /\t/.test(l) || // tab
    (l.match(/ {2,}/g)?.length ?? 0) >= 2 || // múltiplos espaços alinhando colunas
    /,.*,.*,/.test(l) || // csv-like
    /\d{1,2}\/\d{1,2}(\/\d{2,4})?/.test(l) // datas
  );

  return linhasComPadraoTabular.length / linhas.length > 0.5;
}

/** Validação determinística de qualidade — não precisa de IA. */
function avaliarQualidade(texto: string): 'ok' | 'curto' {
  const palavras = texto.split(/\s+/).filter(Boolean).length;
  return palavras < MIN_QUALITY_WORDS ? 'curto' : 'ok';
}

/**
 * Roda a curadoria de um documento inteiro em UMA chamada de LLM (não uma por
 * chunk — controle de custo). Se a IA não estiver configurada ou a chamada
 * falhar, degrada graciosamente: retorna resumo/tags vazios e cada chunk mantém
 * a seção detectada por regra (Etapa 2) — nunca lança erro para o chamador.
 */
export async function curarDocumento(
  titulo: string,
  tipo: string,
  chunks: ChunkInput[]
): Promise<DocumentoCuradoria> {
  const qualidadePorChunk = new Map(chunks.map((c) => [c.chunkIndex, avaliarQualidade(c.texto)]));
  const tabelaPorChunk = new Map(chunks.map((c) => [c.chunkIndex, pareceTabela(c.texto)]));

  if (!isLlmConfigured()) {
    return {
      resumo: '',
      categoria: 'Institucional',
      tags: [],
      chunks: chunks.map((c) => ({
        chunkIndex: c.chunkIndex,
        qualidade: qualidadePorChunk.get(c.chunkIndex) ?? 'ok',
      })),
    };
  }

  let corpo = '';
  for (const c of chunks) {
    const marcador = tabelaPorChunk.get(c.chunkIndex) ? ' [PARECE TABELA]' : '';
    const secaoInfo = c.secao ? ` (seção detectada: ${c.secao})` : '';
    corpo += `[Chunk ${c.chunkIndex}]${secaoInfo}${marcador}\n${c.texto}\n\n`;
    if (corpo.length > MAX_INPUT_CHARS) break;
  }
  corpo = corpo.slice(0, MAX_INPUT_CHARS);

  const systemPrompt = `Você processa documentos institucionais do IFPR Campus Ivaiporã para alimentar uma base de conhecimento (RAG).
Analise os trechos (chunks) abaixo e retorne APENAS um JSON válido, sem texto fora do JSON, com esta estrutura exata:
{
  "resumo": "resumo do documento inteiro em 2-3 frases, sem inventar informação",
  "categoria": "Ensino" | "Pesquisa" | "Extensão" | "Inovação" | "Institucional",
  "tags": ["tag1", "tag2", ...] (5 a 10 palavras-chave em minúsculas, sem acento, úteis para busca),
  "chunks": [
    { "index": 0, "secao": "título curto da seção deste trecho, ou null se não houver um claro", "tabela_reformatada": "texto corrido descrevendo os dados da tabela de forma clara — SÓ incluir este campo se o trecho for de fato uma tabela" }
  ]
}
Regras: não invente dados. "tabela_reformatada" só para trechos marcados [PARECE TABELA] e que sejam mesmo tabelas. Se um trecho já tem seção detectada e ela está correta, repita-a em "secao".`;

  const userPrompt = `Documento: ${titulo} (tipo: ${tipo})\n\n${corpo}`;

  try {
    const raw = await generateCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 2000, jsonMode: true }
    );

    const parsed = parseJsonResponse<{
      resumo?: string;
      categoria?: string;
      tags?: string[];
      chunks?: Array<{ index: number; secao?: string | null; tabela_reformatada?: string }>;
    }>(raw);

    const chunksPorIndex = new Map((parsed.chunks ?? []).map((c) => [c.index, c]));

    return {
      resumo: parsed.resumo ?? '',
      categoria: CATEGORIAS_VALIDAS.includes(parsed.categoria ?? '') ? parsed.categoria! : 'Institucional',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10) : [],
      chunks: chunks.map((c) => {
        const sugestao = chunksPorIndex.get(c.chunkIndex);
        return {
          chunkIndex: c.chunkIndex,
          secao: sugestao?.secao ?? c.secao ?? undefined,
          tabelaReformatada: sugestao?.tabela_reformatada,
          qualidade: qualidadePorChunk.get(c.chunkIndex) ?? 'ok',
        };
      }),
    };
  } catch {
    // Degrada graciosamente: chunks seguem com o enriquecimento determinístico,
    // documento não fica bloqueado por indisponibilidade da IA.
    return {
      resumo: '',
      categoria: 'Institucional',
      tags: [],
      chunks: chunks.map((c) => ({
        chunkIndex: c.chunkIndex,
        qualidade: qualidadePorChunk.get(c.chunkIndex) ?? 'ok',
      })),
    };
  }
}
