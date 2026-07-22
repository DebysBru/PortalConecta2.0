import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

function getCacheKey(pergunta: string): string {
  return `chat:${pergunta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()}`;
}

function detectarIntencao(pergunta: string): {
  tipo: 'projeto' | 'edital' | 'ambos' | 'geral';
  filtros: {
    area?: string;
    tipo_projeto?: string;
    status?: string;
    categoria?: string;
  };
} {
  const p = pergunta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let tipo: 'projeto' | 'edital' | 'ambos' | 'geral' = 'ambos';
  if (p.includes('projeto') || p.includes('extensao') || p.includes('pesquisa') || p.includes('ensino') || p.includes('inovacao')) {
    tipo = 'projeto';
  } else if (p.includes('edital') || p.includes('bolsa') || p.includes('auxilio') || p.includes('oportunidade')) {
    tipo = 'edital';
  }

  const filtros: ReturnType<typeof detectarIntencao>['filtros'] = {};

  if (p.includes('tecnologia') || p.includes('informatica') || p.includes('computacao')) {
    filtros.area = 'Tecnologia';
  } else if (p.includes('agronomia') || p.includes('agricultura') || p.includes('agroecologia')) {
    filtros.area = 'Agronomia';
  } else if (p.includes('educacao') || p.includes('ensino') || p.includes('pedagogia')) {
    filtros.area = 'Educação';
  } else if (p.includes('arte') || p.includes('musica') || p.includes('cultura')) {
    filtros.area = 'Arte';
  } else if (p.includes('meio ambiente') || p.includes('ecologia') || p.includes('sustentabilidade')) {
    filtros.area = 'Meio Ambiente';
  } else if (p.includes('saude') || p.includes('enfermagem') || p.includes('nutricao')) {
    filtros.area = 'Saúde';
  } else if (p.includes('direito') || p.includes('juridico')) {
    filtros.area = 'Direito';
  } else if (p.includes('eletronica') || p.includes('robotica') || p.includes('automacao')) {
    filtros.area = 'Eletrônica';
  }

  if (p.includes('extensao') || p.includes('extensão')) {
    filtros.tipo_projeto = 'extensao';
  } else if (p.includes('pesquisa')) {
    filtros.tipo_projeto = 'pesquisa';
  } else if (p.includes('ensino')) {
    filtros.tipo_projeto = 'ensino';
  } else if (p.includes('inovacao') || p.includes('inovação')) {
    filtros.tipo_projeto = 'inovacao';
  }

  if (p.includes('aberto') || p.includes('inscricao') || p.includes('inscrever')) {
    filtros.status = 'INSCRICOES_ABERTAS';
  } else if (p.includes('ativo') || p.includes('em andamento') || p.includes('execucao')) {
    filtros.status = 'EM_EXECUCAO';
  } else if (p.includes('encerrado') || p.includes('finalizado')) {
    filtros.status = 'ENCERRADO';
  }

  if (p.includes('bolsa')) {
    filtros.categoria = 'BOLSAS';
  } else if (p.includes('auxilio') || p.includes('auxílio')) {
    filtros.categoria = 'AUXILIOS';
  } else if (p.includes('estagio') || p.includes('estágio')) {
    filtros.categoria = 'ESTAGIOS';
  }

  return { tipo, filtros };
}

async function buscarRagChunks(pergunta: string): Promise<Array<{
  conteudo: string;
  documento: { titulo: string; tipo: string };
}>> {
  // Buscar chunks de documentos ativos
  const chunks = await prisma.ragChunk.findMany({
    where: {
      documento: {
        ativo: true,
      },
    },
    include: {
      documento: {
        select: {
          titulo: true,
          tipo: true,
          conteudo: true,
        },
      },
    },
    take: 20,
  });

  if (chunks.length === 0) return [];

  // Busca por palavras-chave simples (melhorar com pgvector no futuro)
  const palavrasChave = pergunta
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter((p) => p.length > 3);

  // Pontuação por relevância
  const scored = chunks.map((chunk) => {
    const conteudoLower = chunk.conteudo.toLowerCase();
    let score = 0;

    for (const palavra of palavrasChave) {
      if (conteudoLower.includes(palavra)) {
        score += 1;
      }
    }

    // Bonus para títulos que contenham palavras-chave
    const tituloLower = chunk.documento.titulo.toLowerCase();
    for (const palavra of palavrasChave) {
      if (tituloLower.includes(palavra)) {
        score += 2;
      }
    }

    return { ...chunk, score };
  });

  // Retornar os mais relevantes (score > 0, top 5)
  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function buscarResumoPortal(): Promise<string> {
  const [totalProjetos, projetosAtivos, projetosAbertos, totalEditais, editaisAbertos] = await Promise.all([
    prisma.projeto.count({ where: { review_status: 'PUBLICADO', deleted_at: null } }),
    prisma.projeto.count({ where: { review_status: 'PUBLICADO', deleted_at: null, status: 'EM_EXECUCAO' } }),
    prisma.projeto.count({ where: { review_status: 'PUBLICADO', deleted_at: null, status: 'INSCRICOES_ABERTAS' } }),
    prisma.edital.count({ where: { review_status: 'PUBLICADO', deleted_at: null } }),
    prisma.edital.count({ where: { review_status: 'PUBLICADO', deleted_at: null, status: 'ABERTO' } }),
  ]);

  return [
    `\n=== RESUMO DO PORTAL ===`,
    `- Total de projetos: ${totalProjetos}`,
    `- Projetos em execução: ${projetosAtivos}`,
    `- Projetos com inscrições abertas: ${projetosAbertos}`,
    `- Total de editais: ${totalEditais}`,
    `- Editais abertos: ${editaisAbertos}`,
  ].join('\n');
}

async function buscarContexto(pergunta: string): Promise<string> {
  const cacheKey = getCacheKey(pergunta);
  const cached = cache.get<string>(cacheKey);
  const resumoPortal = await buscarResumoPortal();

  if (cached) return cached + resumoPortal;

  const { tipo, filtros } = detectarIntencao(pergunta);

  const partes: string[] = [];

  // Buscar documentos RAG relevantes
  const ragChunks = await buscarRagChunks(pergunta);
  if (ragChunks.length > 0) {
    partes.push('=== DOCUMENTOS INSTITUCIONAIS ===');
    ragChunks.forEach((chunk, i) => {
      partes.push(`\n[Fonte: ${chunk.documento.titulo} (${chunk.documento.tipo})]`);
      partes.push(chunk.conteudo);
    });
  }

  if (tipo === 'projeto' || tipo === 'ambos' || tipo === 'geral') {
    const where: any = {
      review_status: 'PUBLICADO',
      deleted_at: null,
    };

    if (filtros.area) {
      where.area = { contains: filtros.area, mode: 'insensitive' };
    }
    if (filtros.tipo_projeto) {
      where.tipo = { contains: filtros.tipo_projeto, mode: 'insensitive' };
    }
    if (filtros.status) {
      where.status = filtros.status;
    }

    const projetos = await prisma.projeto.findMany({
      where,
      take: 10,
      orderBy: [
        { destaque: 'desc' },
        { status: 'asc' },
        { updatedAt: 'desc' },
      ],
      select: {
        nome: true,
        tipo: true,
        area: true,
        descricao: true,
        resumoCurto: true,
        coordenador: true,
        status: true,
        vagasBolsista: true,
        vagasVoluntario: true,
        inscricao_fim: true,
        tags: { select: { tag: true } },
      },
    });

    if (projetos.length > 0) {
      partes.push('=== PROJETOS ENCONTRADOS ===');
      projetos.forEach((p, i) => {
        partes.push(`\nProjeto ${i + 1}: ${p.nome}`);
        partes.push(`- Tipo: ${p.tipo || 'Não definido'}`);
        partes.push(`- Área: ${p.area}`);
        partes.push(`- Coordenador: ${p.coordenador}`);
        partes.push(`- Status: ${p.status}`);
        if (p.tags.length > 0) {
          partes.push(`- Tags: ${p.tags.map((t) => t.tag).join(', ')}`);
        }
        if (p.resumoCurto) {
          partes.push(`- Resumo: ${p.resumoCurto}`);
        } else if (p.descricao) {
          partes.push(`- Descrição: ${p.descricao.slice(0, 200)}`);
        }
        if (p.status === 'INSCRICOES_ABERTAS') {
          partes.push(`- **INSCRIÇÕES ABERTAS** (${p.vagasBolsista} bolsista, ${p.vagasVoluntario} voluntário)`);
          if (p.inscricao_fim) {
            partes.push(`- Prazo: ${p.inscricao_fim.toLocaleDateString('pt-BR')}`);
          }
        }
      });
    }
  }

  if (tipo === 'edital' || tipo === 'ambos' || tipo === 'geral') {
    const where: any = {
      review_status: 'PUBLICADO',
      deleted_at: null,
    };

    if (filtros.categoria) {
      where.categoria = filtros.categoria;
    }

    const editais = await prisma.edital.findMany({
      where,
      take: 5,
      orderBy: [
        { destaque: 'desc' },
        { updatedAt: 'desc' },
      ],
      select: {
        titulo: true,
        categoria: true,
        status: true,
        resumoSimples: true,
        resumo: true,
        dataEncerramento: true,
        quemPode: true,
        beneficios: true,
      },
    });

    if (editais.length > 0) {
      partes.push('\n=== EDITAIS ENCONTRADOS ===');
      editais.forEach((e, i) => {
        partes.push(`\nEdital ${i + 1}: ${e.titulo}`);
        partes.push(`- Categoria: ${e.categoria}`);
        partes.push(`- Status: ${e.status}`);
        if (e.resumoSimples) {
          partes.push(`- Resumo: ${e.resumoSimples.slice(0, 200)}`);
        } else if (e.resumo) {
          partes.push(`- Resumo: ${e.resumo.slice(0, 200)}`);
        }
        if (e.quemPode) {
          partes.push(`- Quem pode: ${e.quemPode.slice(0, 150)}`);
        }
        if (e.beneficios) {
          partes.push(`- Benefícios: ${e.beneficios.slice(0, 150)}`);
        }
        if (e.dataEncerramento) {
          partes.push(`- Inscrições até: ${e.dataEncerramento.toLocaleDateString('pt-BR')}`);
        }
      });
    }
  }

  if (partes.length === 0) {
    const projetosDestaque = await prisma.projeto.findMany({
      where: { review_status: 'PUBLICADO', deleted_at: null, destaque: true },
      take: 5,
      select: { nome: true, area: true, tipo: true, status: true },
    });

    const editaisAbertos = await prisma.edital.findMany({
      where: { review_status: 'PUBLICADO', deleted_at: null, status: 'ABERTO' },
      take: 5,
      select: { titulo: true, categoria: true, status: true },
    });

    const projetosAbertos = await prisma.projeto.findMany({
      where: { review_status: 'PUBLICADO', deleted_at: null, status: 'INSCRICOES_ABERTAS' },
      take: 5,
      select: { nome: true, area: true, tipo: true, status: true },
    });

    if (projetosDestaque.length > 0) {
      partes.push('=== PROJETOS EM DESTAQUE ===');
      projetosDestaque.forEach((p) => {
        partes.push(`- **${p.nome}** (${p.area}, ${p.tipo || 'Não definido'}) — ${p.status}${p.status === 'INSCRICOES_ABERTAS' ? ' ✅ INSCRIÇÕES ABERTAS' : ''}`);
      });
    }

    if (projetosAbertos.length > 0) {
      partes.push('\n=== PROJETOS COM INSCRIÇÕES ABERTAS ===');
      projetosAbertos.forEach((p) => {
        partes.push(`- **${p.nome}** (${p.area}) — ${p.status}`);
      });
    }

    if (editaisAbertos.length > 0) {
      partes.push('\n=== EDITAIS ABERTOS ===');
      editaisAbertos.forEach((e) => {
        partes.push(`- **${e.titulo}** (${e.categoria}) — ${e.status}`);
      });
    }
  }

  const resultado = partes.join('\n');

  cache.set(cacheKey, resultado, 2 * 60 * 1000);

  return resultado;
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

  const contexto = await buscarContexto(message);

  const systemPrompt = `Você é a IFizinha, assistente virtual do Portal Conecta do IFPR Campus Ivaiporã.

SOBRE VOCÊ:
- Nome: IFizinha
- Personality: Jovem, acolhedora, simpática e prestativa
- Função: Ajudar estudantes, professores e servidores com informações do portal
- Fale na primeira pessoa do singular ("Eu posso te ajudar...")
- Use linguagem informal mas educada
- Trate o estudante por "você"

REGRAS INEGOCIÁVEIS:
1. Responda SOMENTE com base no CONTEXTO fornecido abaixo (projetos, editais e documentos institucionais).
2. Se a resposta não estiver no contexto, diga que não encontrou essa informação no portal e sugira acessar as páginas de projetos ou editais.
3. NUNCA invente informações sobre projetos, editais ou documentos que não estão no contexto.
4. Use linguagem jovem, amigável e direta.
5. Seja útil e ofereça links quando apropriado.
6. Para inscrições, oriente a acessar a página do projeto.
7. Para editais, oriente a acessar a página do edital.
8. Nunca responda sobre assuntos fora do portal (política, notícias externas, etc).
9. Quando perguntarem sobre "quantos projetos" ou "quais projetos", use os dados do RESUMO DO PORTAL.
10. Quando houver DOCUMENTOS INSTITUCIONAIS no contexto, cite a fonte ao responder.

TIPOS DE PROJETO:
- **Extensão**: Projetos que levam conhecimento para a comunidade
- **Pesquisa**: Projetos de investigação científica
- **Ensino**: Projetos voltados para o processo de ensino-aprendizagem
- **Inovação**: Projetos de desenvolvimento de novas soluções

FORMATAÇÃO:
- Use **negrito** para termos importantes e nomes de projetos/editais
- Use listas com - ou * para múltiplos itens
- Use parágrafos curtos separados por linha em branco
- Seja visualmente organizado e fácil de ler

CONTEXTO:
${contexto}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.slice(-6),
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
      max_tokens: 1500,
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
