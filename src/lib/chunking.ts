/**
 * Chunking determinístico (baseado em regras, sem LLM) — camada Curador da
 * pipeline RAG. Prioridade de separação: seções/títulos detectados > parágrafos
 * > limite de tokens (com overlap). A IA entra depois (Etapa 3) para enriquecer
 * metadados, não para decidir onde cortar.
 */

export interface ChunkingConfig {
  maxTokens: number;
  overlapTokens: number;
  preserveSections: boolean;
}

export interface StructuredChunk {
  texto: string;
  secao: string | null;
}

const DEFAULT_CONFIG: ChunkingConfig = {
  maxTokens: 700,
  overlapTokens: 100,
  preserveSections: true,
};

// Aproximação sem tokenizer real (nenhuma lib de tokenização está instalada) —
// ~0.75 palavras por token é uma estimativa razoável para português.
const WORDS_PER_TOKEN = 0.75;

function detectHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (/^#{1,6}\s/.test(t)) return true;
  if (/^(art(igo)?\.?\s*\d+|cap[ií]tulo\s+\w+|se[cç][aã]o\s+\w+|\d+(\.\d+)*[).]\s+\S)/i.test(t)) return true;
  if (t === t.toUpperCase() && /[A-ZÀ-Ú]/.test(t) && t.split(/\s+/).length <= 10 && !/[.,;:]$/.test(t)) return true;
  return false;
}

function splitIntoSections(text: string): Array<{ titulo: string | null; conteudo: string }> {
  const lines = text.split('\n');
  const sections: Array<{ titulo: string | null; conteudo: string[] }> = [{ titulo: null, conteudo: [] }];

  for (const line of lines) {
    if (detectHeading(line)) {
      sections.push({ titulo: line.trim().replace(/^#{1,6}\s*/, ''), conteudo: [] });
    } else {
      sections[sections.length - 1].conteudo.push(line);
    }
  }

  return sections
    .map((s) => ({ titulo: s.titulo, conteudo: s.conteudo.join('\n').trim() }))
    .filter((s) => s.conteudo.length > 0);
}

export function chunkDocument(text: string, config: Partial<ChunkingConfig> = {}): StructuredChunk[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const maxWords = Math.max(50, Math.round(cfg.maxTokens * WORDS_PER_TOKEN));
  const overlapWords = Math.max(0, Math.round(cfg.overlapTokens * WORDS_PER_TOKEN));

  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!cleaned) return [];

  const sections = cfg.preserveSections ? splitIntoSections(cleaned) : [{ titulo: null, conteudo: cleaned }];
  const chunks: StructuredChunk[] = [];

  for (const section of sections) {
    const paragraphs = section.conteudo.split(/\n\s*\n/).filter((p) => p.trim());
    let current: string[] = [];
    let currentWords = 0;

    const flush = () => {
      if (current.length === 0) return;
      chunks.push({ texto: current.join('\n\n').trim(), secao: section.titulo });
      current = [];
      currentWords = 0;
    };

    for (const para of paragraphs) {
      const paraWords = para.split(/\s+/).filter(Boolean).length;

      if (paraWords > maxWords) {
        // Parágrafo sozinho já estoura o limite — quebra por palavras com overlap
        flush();
        const words = para.split(/\s+/).filter(Boolean);
        const step = Math.max(1, maxWords - overlapWords);
        for (let i = 0; i < words.length; i += step) {
          chunks.push({ texto: words.slice(i, i + maxWords).join(' '), secao: section.titulo });
        }
        continue;
      }

      if (currentWords + paraWords > maxWords && current.length > 0) {
        flush();
        if (overlapWords > 0 && chunks.length > 0) {
          const prevWords = chunks[chunks.length - 1].texto.split(/\s+/);
          const tail = prevWords.slice(-overlapWords).join(' ');
          if (tail) {
            current.push(tail);
            currentWords += Math.min(overlapWords, prevWords.length);
          }
        }
      }

      current.push(para);
      currentWords += paraWords;
    }

    flush();
  }

  return chunks.length > 0 ? chunks : [{ texto: cleaned, secao: null }];
}
