import { NextRequest, NextResponse } from 'next/server';
import { generateCompletion, parseJsonResponse } from '@/lib/llm';
import { exigirAdmin } from '@/lib/admin-auth';
import { reservarAtendimento, AiLimitError } from '@/lib/ai-guard';
import { MENSAGENS } from '@/lib/mensagens';

const SYSTEM_PROMPT = `Você é a IFizinha, assistente virtual do Portal Conecta do IFPR Campus Ivaiporã.
Sua tarefa é traduzir editais institucionais para linguagem simples e acessível para estudantes.

REGRAS:
1. Use linguagem jovem, amigável e direta
2. Trate o estudante por "você"
3. Explique termos difíceis
4. Seja específica sobre prazos e documentos
5. Nunca invente informações — use apenas o que foi fornecido
6. Mantenha o tom acolhedor mas institucional
7. Responda APENAS com JSON válido, sem texto fora do JSON

FORMATO DE SAÍDA (JSON estrito):
{
  "oquee": "Explicação simples do que é o edital",
  "quempode": "Quem pode participar",
  "beneficios": "Quais os benefícios",
  "documentos": "Documentos necessários",
  "comoinscrever": "Como se inscrever",
  "prazo": "Prazos importantes",
  "observacoes": "Observações adicionais (pode ser vazio)"
}`;

export async function POST(request: NextRequest) {
  const auth = await exigirAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let release: (() => Promise<unknown>) | undefined;
  try {
    const body = await request.json();
    if (!body || typeof body.titulo !== 'string' || typeof body.resumo !== 'string' || !body.titulo.trim() || !body.resumo.trim() || body.titulo.length > 500 || body.resumo.length > 20000) {
      return NextResponse.json({ error: 'Informe título e resumo válidos (até 500 e 20000 caracteres).' }, { status: 400 });
    }
    release = await reservarAtendimento(request, 'traducao', auth.email);
    const raw = await generateCompletion([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ titulo: body.titulo, resumo: body.resumo, categoria: String(body.categoria ?? '').slice(0, 100), dataEncerramento: String(body.dataEncerramento ?? '').slice(0, 40) }) },
    ], { jsonMode: true, temperature: 0.2, maxTokens: 2000, signal: request.signal });
    const traducao = parseJsonResponse<Record<string, unknown>>(raw);
    const fields = ['oquee', 'quempode', 'beneficios', 'documentos', 'comoinscrever', 'prazo', 'observacoes'];
    if (!fields.every((field) => typeof traducao[field] === 'string' && (traducao[field] as string).length <= 8000)) throw new Error('Resposta estruturada inválida');
    return NextResponse.json({ traducao: Object.fromEntries(fields.map((field) => [field, traducao[field]])) });
  } catch (error) {
    if (error instanceof AiLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    return NextResponse.json({ error: error instanceof SyntaxError ? 'Dados inválidos.' : MENSAGENS.iaErro }, { status: error instanceof SyntaxError ? 400 : 503 });
  } finally { await release?.(); }
}
