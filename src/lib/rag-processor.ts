/**
 * Processador de documentos RAG com IA
 * Organiza texto, extrai links, gera tags - economico em tokens
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

interface ProcessedDocument {
  resumo: string;
  tags: string[];
  links: string[];
  sections: Array<{
    titulo: string;
    conteudo: string;
    tags: string[];
  }>;
}

/**
 * Processa um documento com IA para organizar conteúdo e gerar tags
 * Usa ~500 tokens por documento (muito economico)
 */
export async function processDocumentWithAI(
  titulo: string,
  conteudoRaw: string
): Promise<ProcessedDocument> {
  if (!DEEPSEEK_API_KEY) {
    // Fallback: processamento sem IA
    return processWithoutAI(titulo, conteudoRaw);
  }

  // Limitar input para economizar tokens (max ~2000 palavras)
  const palavras = conteudoRaw.split(/\s+/);
  const conteudoLimitado = palavras.slice(0, 2000).join(' ');

  const prompt = `Analise este documento institucional do IFPR Campus Ivaiporã e retorne um JSON com:

1. "resumo": Resumo em 2-3 frases do conteudo principal
2. "tags": Array de 5-10 tags relevantes (minusculas, sem acento, ex: "edital", "bolsa", "inscricao")
3. "links": Array de URLs encontradas no texto (se houver)
4. "sections": Array de secoes com titulo, conteudo resumido (2-3 frases) e tags especificas

IMPORTANTE: Retorne APENAS o JSON valido, sem texto adicional.

Documento: ${titulo}

Conteudo:
${conteudoLimitado}`;

  try {
    const response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Baixo para respostas consistentes
        max_tokens: 500, // Limitado para economia
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('DeepSeek API error:', response.status);
      return processWithoutAI(titulo, conteudoRaw);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return processWithoutAI(titulo, conteudoRaw);
    }

    const parsed = JSON.parse(content);
    return {
      resumo: parsed.resumo || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      links: Array.isArray(parsed.links) ? parsed.links : [],
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    };
  } catch (e) {
    console.error('Erro ao processar com IA:', e);
    return processWithoutAI(titulo, conteudoRaw);
  }
}

/**
 * Processamento sem IA - extrai tags e links por regex
 */
function processWithoutAI(titulo: string, conteudo: string): ProcessedDocument {
  // Extrair links
  const urlRegex = /https?:\/\/[^\s]+/g;
  const links = [...new Set(conteudo.match(urlRegex) || [])];

  // Gerar tags por palavras-chave
  const palavrasChave = [
    'edital', 'projeto', 'inscricao', 'bolsa', 'auxilio', 'estagio',
    'monitoria', 'extensao', 'pesquisa', 'ensino', 'inovacao',
    'prazo', 'requisito', 'documentacao', 'selecao', 'resultado',
    'ifpr', 'ivaipora', 'campus', 'aluno', 'professor',
  ];

  const conteudoLower = conteudo.toLowerCase();
  const tags = palavrasChave.filter(tag => conteudoLower.includes(tag));

  // Adicionar tags do título
  const tituloLower = titulo.toLowerCase();
  if (tituloLower.includes('edital')) tags.push('edital');
  if (tituloLower.includes('projeto')) tags.push('projeto');
  if (tituloLower.includes('bolsa')) tags.push('bolsa');

  // Criar seções básicas por parágrafos
  const paragrafos = conteudo.split(/\n\n+/).filter(p => p.trim().length > 50);
  const sections = paragrafos.slice(0, 5).map((p, i) => ({
    titulo: `Seção ${i + 1}`,
    conteudo: p.slice(0, 200),
    tags: [],
  }));

  return {
    resumo: paragrafos[0]?.slice(0, 200) || titulo,
    tags: [...new Set(tags)].slice(0, 10),
    links,
    sections,
  };
}

/**
 * Processa chunks com tags específicas
 */
export function generateChunkTags(
  chunkContent: string,
  documentTags: string[]
): string[] {
  const contentLower = chunkContent.toLowerCase();
  const chunkTags: string[] = [];

  // Tags do documento que aparecem no chunk
  for (const tag of documentTags) {
    if (contentLower.includes(tag)) {
      chunkTags.push(tag);
    }
  }

  // Tags específicas do chunk
  const specificKeywords = [
    'prazo', 'data', 'valor', 'vaga', 'requisito', 'documento',
    'inscricao', 'selecao', 'resultado', 'contato', 'email', 'telefone',
  ];

  for (const keyword of specificKeywords) {
    if (contentLower.includes(keyword) && !chunkTags.includes(keyword)) {
      chunkTags.push(keyword);
    }
  }

  return chunkTags.slice(0, 5);
}
