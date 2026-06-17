import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

/**
 * Busca conteúdo relevante de projetos e editais
 */
async function buscarContexto(pergunta: string): Promise<string> {
  const termos = pergunta
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  // Buscar projetos relevantes
  const projetos = await prisma.projeto.findMany({
    where: {
      review_status: 'PUBLICADO',
      deleted_at: null,
      OR: termos.flatMap((t) => [
        { nome: { contains: t, mode: 'insensitive' as const } },
        { descricao: { contains: t, mode: 'insensitive' as const } },
        { area: { contains: t, mode: 'insensitive' as const } },
        { coordenador: { contains: t, mode: 'insensitive' as const } },
      ]),
    },
    take: 5,
    select: {
      nome: true,
      descricao: true,
      area: true,
      coordenador: true,
      status: true,
      inscricoes_abertas: true,
      vagasBolsista: true,
      vagasVoluntario: true,
    },
  });

  // Buscar editais relevantes
  const editais = await prisma.edital.findMany({
    where: {
      review_status: 'PUBLICADO',
      deleted_at: null,
      OR: termos.flatMap((t) => [
        { titulo: { contains: t, mode: 'insensitive' as const } },
        { resumo: { contains: t, mode: 'insensitive' as const } },
        { resumoSimples: { contains: t, mode: 'insensitive' as const } },
      ]),
    },
    take: 5,
    select: {
      titulo: true,
      resumoSimples: true,
      resumo: true,
      categoria: true,
      status: true,
      inscricao_fim: true,
    },
  });

  // Montar contexto
  const partes: string[] = [];

  if (projetos.length > 0) {
    partes.push('=== PROJETOS ENCONTRADOS ===');
    projetos.forEach((p, i) => {
      partes.push(`Projeto ${i + 1}: ${p.nome}`);
      partes.push(`  Área: ${p.area}`);
      partes.push(`  Coordenador: ${p.coordenador}`);
      partes.push(`  Status: ${p.status}`);
      if (p.descricao) partes.push(`  Descrição: ${p.descricao.slice(0, 300)}`);
      if (p.inscricoes_abertas) partes.push(`  Inscrições: ABERTAS (${p.vagasBolsista} bolsista, ${p.vagasVoluntario} voluntário)`);
    });
  }

  if (editais.length > 0) {
    partes.push('=== EDITAIS ENCONTRADOS ===');
    editais.forEach((e, i) => {
      partes.push(`Edital ${i + 1}: ${e.titulo}`);
      partes.push(`  Categoria: ${e.categoria}`);
      partes.push(`  Status: ${e.status}`);
      if (e.resumoSimples) partes.push(`  Resumo: ${e.resumoSimples.slice(0, 300)}`);
      else if (e.resumo) partes.push(`  Resumo: ${e.resumo.slice(0, 300)}`);
      if (e.inscricao_fim) partes.push(`  Inscrições até: ${e.inscricao_fim.toLocaleDateString('pt-BR')}`);
    });
  }

  if (partes.length === 0) {
    // Busca genérica: retornar projetos e editais em destaque
    const destaque = await prisma.projeto.findMany({
      where: { review_status: 'PUBLICADO', deleted_at: null, destaque: true },
      take: 3,
      select: { nome: true, area: true, coordenador: true, status: true },
    });

    const editaisDestaque = await prisma.edital.findMany({
      where: { review_status: 'PUBLICADO', deleted_at: null, status: 'ABERTO' },
      take: 3,
      select: { titulo: true, categoria: true, status: true },
    });

    if (destaque.length > 0) {
      partes.push('=== PROJETOS EM DESTAQUE ===');
      destaque.forEach((p) => partes.push(`- ${p.nome} (${p.area}) — ${p.status}`));
    }
    if (editaisDestaque.length > 0) {
      partes.push('=== EDITAIS ABERTOS ===');
      editaisDestaque.forEach((e) => partes.push(`- ${e.titulo} (${e.categoria}) — ${e.status}`));
    }
  }

  return partes.join('\n');
}

export async function POST(request: Request) {
  const body: ChatRequest = await request.json();
  const { message, history = [] } = body;

  if (!message) {
    return NextResponse.json({ error: 'Mensagem não fornecida' }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPSEEK_API_KEY não configurada' }, { status: 500 });
  }

  // Buscar contexto relevante
  const contexto = await buscarContexto(message);

  const systemPrompt = `Você é a IFizinha, assistente virtual do Portal Conecta do IFPR Campus Ivaiporã.

REGRAS INEGOCIÁVEIS:
1. Responda SOMENTE com base no CONTEXTO fornecido abaixo (projetos e editais do portal).
2. Se a resposta não estiver no contexto, diga que não encontrou essa informação no portal e sugira acessar as páginas de projetos ou editais.
3. NUNCA invente informações sobre projetos ou editais que não estão no contexto.
4. Use linguagem jovem, amigável e direta. Trate o estudante por "você".
5. Seja útil e ofereça links quando apropriado.
6. Para inscrições, oriente a acessar a página do projeto.
7. Para editais, oriente a acessar a página do edital.
8. Nunca responda sobre assuntos fora do portal (política, notícias externas, etc).

FORMATO:
- Respostas curtas e diretas (máximo 3-4 parágrafos)
- Use bullet points quando apropriado
- Cite o nome do projeto/edital quando mencionar

CONTEXTO:
${contexto || 'Nenhum conteúdo encontrado no portal para esta busca.'}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.slice(-6), // Últimas 6 mensagens para contexto
    { role: 'user' as const, content: message },
  ];

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('DeepSeek error:', errorData);
    return NextResponse.json({ error: 'Erro ao processar mensagem' }, { status: 500 });
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    return NextResponse.json({ error: 'Resposta vazia da IA' }, { status: 500 });
  }

  return NextResponse.json({ reply });
}
