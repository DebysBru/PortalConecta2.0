import { NextRequest, NextResponse } from 'next/server';
import { detectFileType, extractDocument, ALLOWED_EXTENSIONS } from '@/lib/document-extract';
import { CategoriaEdital } from '@prisma/client';
import { generateCompletion, LlmRespostaTruncadaError, tokensParaResposta } from '@/lib/llm';
import { exigirAdmin } from '@/lib/admin-auth';
import { reservarAtendimento, AiLimitError } from '@/lib/ai-guard';
import { MENSAGENS, mensagemAmigavel } from '@/lib/mensagens';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_WORDS = 6000;

const CATEGORIAS_VALIDAS = new Set<string>(Object.values(CategoriaEdital));

const SYSTEM_PROMPT = `Você é um assistente que extrai dados estruturados de editais institucionais do IFPR Campus Ivaiporã, a partir do texto bruto extraído de um PDF.

Analise o texto do edital e retorne APENAS um JSON válido com exatamente esta estrutura:

{
  "titulo": "Título oficial do edital (ex: EDITAL Nº 01/2025 - PROGRAMA DE MONITORIA)",
  "categoria": "uma destas opções: BOLSAS | AUXILIOS | EXTENSAO | PESQUISA | ENSINO | EVENTOS | ESTAGIOS | RESULTADOS",
  "resumo": "Resumo objetivo do edital em 2-4 frases, para exibição na listagem pública",
  "dataEncerramento": "Data final das inscrições no formato YYYY-MM-DD, ou null se não encontrada",
  "linkOficial": "URL oficial do edital/instituição encontrada no texto, ou string vazia se não houver",
  "traducaoIFizinha": {
    "oquee": "Explicação simples do que é o edital, em linguagem acessível para estudantes",
    "quempode": "Quem pode participar/se inscrever",
    "beneficios": "Quais os benefícios (valores de bolsa, auxílio, carga horária etc.)",
    "documentos": "Documentos necessários para inscrição",
    "comoinscrever": "Como e onde se inscrever",
    "prazo": "Prazos importantes (inscrição, resultado, recurso)",
    "observacoes": "Observações adicionais relevantes (pode ser string vazia)"
  }
}

REGRAS:
1. Use APENAS informações presentes no texto — nunca invente dados
2. Se um campo não for encontrado no texto, retorne string vazia ("") ou null (para dataEncerramento)
3. Use linguagem jovem, amigável e direta nos campos de "traducaoIFizinha", tratando o estudante por "você"
4. "categoria" deve ser exatamente um dos valores da lista, em maiúsculas
5. Responda APENAS com o JSON, sem texto antes ou depois`;



function truncateWords(text: string, maxWords: number): string {
  const palavras = text.split(/\s+/);
  return palavras.slice(0, maxWords).join(' ');
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

type TraducaoIFizinha = {
  oquee: string; quempode: string; beneficios: string; documentos: string;
  comoinscrever: string; prazo: string; observacoes: string;
};

function sanitizeTraducao(raw: unknown): TraducaoIFizinha {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const field = (key: string) => (typeof obj[key] === 'string' ? (obj[key] as string).trim() : '');
  return {
    oquee: field('oquee'),
    quempode: field('quempode'),
    beneficios: field('beneficios'),
    documentos: field('documentos'),
    comoinscrever: field('comoinscrever'),
    prazo: field('prazo'),
    observacoes: field('observacoes'),
  };
}

export async function POST(request: NextRequest) {
  const auth = await exigirAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let file: File | null;
  try {
    const formData = await request.formData();
    file = formData.get('file') as File | null;
  } catch (e) {
    console.error('Falha ao ler o upload do PDF:', e);
    return NextResponse.json({ error: MENSAGENS.dadosInvalidosGenerico }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: MENSAGENS.arquivoNaoEnviado }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: MENSAGENS.arquivoGrande(`${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`) },
      { status: 400 }
    );
  }

  const fileType = detectFileType(file);
  if (!fileType) {
    return NextResponse.json(
      {
        error: `Este formato de arquivo não é aceito. Formatos aceitos: ${ALLOWED_EXTENSIONS.join(', ')}.`,
        allowed: ALLOWED_EXTENSIONS.join(', '),
      },
      { status: 400 }
    );
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: MENSAGENS.iaNaoConfigurada }, { status: 500 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let extracted;
  try {
    extracted = await extractDocument(buffer, fileType);
  } catch (e) {
    console.error('Falha ao extrair texto do documento:', e);
    return NextResponse.json(
      { error: mensagemAmigavel(e, 'Não conseguimos ler o conteúdo deste arquivo. Tente enviar em outro formato.') },
      { status: 400 }
    );
  }

  if (!extracted.text.trim()) {
    const msg = extracted.hasTextLayer === false
      ? 'Este PDF parece ser uma imagem digitalizada (escaneada), então não conseguimos ler o texto. Converta para PDF pesquisável ou preencha os campos manualmente.'
      : 'Não conseguimos encontrar texto neste arquivo. Verifique se o documento não está vazio ou protegido e tente novamente.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const conteudo = truncateWords(extracted.text, MAX_WORDS);

  let content: string;
  let release: (() => Promise<unknown>) | undefined;
  try {
    release = await reservarAtendimento(request, 'extracao-edital', auth.email);
    content = await generateCompletion([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Texto extraído do edital:\n\n${conteudo}` },
    ], { temperature: 0.2, maxTokens: tokensParaResposta(4000), jsonMode: true, signal: request.signal });
  } catch (error) {
    if (error instanceof AiLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    // ATENÇÃO: truncamento NÃO é "IA fora do ar". O JSON do edital é grande (título
    // longo + resumo + 7 campos da tradução) e o raciocínio do modelo divide o
    // orçamento de `max_tokens`; quando o teto era 2000, a resposta era cortada e o
    // usuário via "a IA encontrou um problema" — que sugere tentar de novo, mas
    // repetir igual falha igual. O orçamento agora vem de `tokensParaResposta`;
    // se ainda assim truncar, a mensagem diz o que fazer.
    if (error instanceof LlmRespostaTruncadaError) {
      return NextResponse.json({ error: MENSAGENS.iaRespostaTruncada }, { status: 422 });
    }
    return NextResponse.json({ error: MENSAGENS.iaErro }, { status: 503 });
  } finally { await release?.(); }

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    console.error('IA não retornou JSON válido:', content.slice(0, 300));
    return NextResponse.json({ error: MENSAGENS.iaRespostaInvalida }, { status: 500 });
  }

  const titulo = typeof parsed.titulo === 'string' ? parsed.titulo.trim().slice(0, 300) : '';
  const resumo = typeof parsed.resumo === 'string' ? parsed.resumo.trim().slice(0, 2000) : '';
  const categoria = typeof parsed.categoria === 'string' && CATEGORIAS_VALIDAS.has(parsed.categoria)
    ? (parsed.categoria as CategoriaEdital)
    : undefined;
  const dataEncerramento = isValidIsoDate(parsed.dataEncerramento) ? parsed.dataEncerramento : undefined;
  const linkOficial = typeof parsed.linkOficial === 'string' && /^https?:\/\//.test(parsed.linkOficial.trim())
    ? parsed.linkOficial.trim()
    : undefined;
  const traducaoIFizinha = sanitizeTraducao(parsed.traducaoIFizinha);

  return NextResponse.json({
    ok: true,
    data: {
      titulo, resumo, categoria, dataEncerramento, linkOficial, traducaoIFizinha,
      totalPaginas: extracted.pages,
    },
  });
}
