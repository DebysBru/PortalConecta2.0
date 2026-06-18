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

/**
 * Detecta a intenção do usuário
 */
function detectarIntencao(pergunta: string): {
  tipo: 'projeto' | 'edital' | 'ambos' | 'geral';
  filtros: {
    area?: string;
    tipo_projeto?: string;
    status?: string;
    inscricoes_abertas?: boolean;
    categoria?: string;
  };
} {
  const p = pergunta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Detectar tipo de busca
  let tipo: 'projeto' | 'edital' | 'ambos' | 'geral' = 'ambos';
  if (p.includes('projeto') || p.includes('extensao') || p.includes('pesquisa') || p.includes('ensino') || p.includes('inovacao')) {
    tipo = 'projeto';
  } else if (p.includes('edital') || p.includes('bolsa') || p.includes('auxilio') || p.includes('oportunidade')) {
    tipo = 'edital';
  }

  // Detectar filtros
  const filtros: ReturnType<typeof detectarIntencao>['filtros'] = {};

  // Área
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

  // Tipo de projeto
  if (p.includes('extensao') || p.includes('extensão')) {
    filtros.tipo_projeto = 'extensao';
  } else if (p.includes('pesquisa')) {
    filtros.tipo_projeto = 'pesquisa';
  } else if (p.includes('ensino')) {
    filtros.tipo_projeto = 'ensino';
  } else if (p.includes('inovacao') || p.includes('inovação')) {
    filtros.tipo_projeto = 'inovacao';
  }

  // Status
  if (p.includes('aberto') || p.includes('inscricao') || p.includes('inscrever')) {
    filtros.inscricoes_abertas = true;
    filtros.status = 'INSCRICOES_ABERTAS';
  } else if (p.includes('ativo') || p.includes('em andamento') || p.includes('execucao')) {
    filtros.status = 'EM_EXECUCAO';
  } else if (p.includes('encerrado') || p.includes('finalizado')) {
    filtros.status = 'ENCERRADO';
  }

  // Categoria de edital
  if (p.includes('bolsa')) {
    filtros.categoria = 'BOLSAS';
  } else if (p.includes('auxilio') || p.includes('auxílio')) {
    filtros.categoria = 'AUXILIOS';
  } else if (p.includes('estagio') || p.includes('estágio')) {
    filtros.categoria = 'ESTAGIOS';
  }

  return { tipo, filtros };
}

/**
 * Busca conteúdo relevante de projetos e editais
 */
async function buscarContexto(pergunta: string): Promise<string> {
  // Verificar cache compartilhado
  const cacheKey = getCacheKey(pergunta);
  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  const { tipo, filtros } = detectarIntencao(pergunta);

  const partes: string[] = [];

  // Buscar projetos
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
    if (filtros.inscricoes_abertas) {
      where.inscricoes_abertas = true;
    }
    if (filtros.status) {
      where.status = filtros.status;
    }

    const projetos = await prisma.projeto.findMany({
      where,
      take: 10,
      orderBy: [
        { destaque: 'desc' },
        { inscricoes_abertas: 'desc' },
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
        inscricoes_abertas: true,
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
        if (p.inscricoes_abertas) {
          partes.push(`- **INSCRIÇÕES ABERTAS** (${p.vagasBolsista} bolsista, ${p.vagasVoluntario} voluntário)`);
          if (p.inscricao_fim) {
            partes.push(`- Prazo: ${p.inscricao_fim.toLocaleDateString('pt-BR')}`);
          }
        }
      });
    }
  }

  // Buscar editais
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
        inscricao_fim: true,
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
        if (e.inscricao_fim) {
          partes.push(`- Inscrições até: ${e.inscricao_fim.toLocaleDateString('pt-BR')}`);
        }
      });
    }
  }

  // Se não encontrou nada, buscar destaques
  if (partes.length === 0) {
    const projetosDestaque = await prisma.projeto.findMany({
      where: { review_status: 'PUBLICADO', deleted_at: null, destaque: true },
      take: 5,
      select: { nome: true, area: true, tipo: true, status: true, inscricoes_abertas: true },
    });

    const editaisAbertos = await prisma.edital.findMany({
      where: { review_status: 'PUBLICADO', deleted_at: null, status: 'ABERTO' },
      take: 5,
      select: { titulo: true, categoria: true, status: true },
    });

    const projetosAbertos = await prisma.projeto.findMany({
      where: { review_status: 'PUBLICADO', deleted_at: null, inscricoes_abertas: true },
      take: 5,
      select: { nome: true, area: true, tipo: true, status: true, inscricoes_abertas: true },
    });

    if (projetosDestaque.length > 0) {
      partes.push('=== PROJETOS EM DESTAQUE ===');
      projetosDestaque.forEach((p) => {
        partes.push(`- **${p.nome}** (${p.area}, ${p.tipo || 'Não definido'}) — ${p.status}${p.inscricoes_abertas ? ' ✅ INSCRIÇÕES ABERTAS' : ''}`);
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

  // Adicionar estatísticas gerais
  const [totalProjetos, projetosAtivos, projetosAbertos, totalEditais, editaisAbertos] = await Promise.all([
    prisma.projeto.count({ where: { review_status: 'PUBLICADO', deleted_at: null } }),
    prisma.projeto.count({ where: { review_status: 'PUBLICADO', deleted_at: null, status: 'EM_EXECUCAO' } }),
    prisma.projeto.count({ where: { review_status: 'PUBLICADO', deleted_at: null, inscricoes_abertas: true } }),
    prisma.edital.count({ where: { review_status: 'PUBLICADO', deleted_at: null } }),
    prisma.edital.count({ where: { review_status: 'PUBLICADO', deleted_at: null, status: 'ABERTO' } }),
  ]);

  partes.push(`\n=== RESUMO DO PORTAL ===`);
  partes.push(`- Total de projetos: ${totalProjetos}`);
  partes.push(`- Projetos em execução: ${projetosAtivos}`);
  partes.push(`- Projetos com inscrições abertas: ${projetosAbertos}`);
  partes.push(`- Total de editais: ${totalEditais}`);
  partes.push(`- Editais abertos: ${editaisAbertos}`);

  const resultado = partes.join('\n');

  // Salvar no cache compartilhado (5 min TTL)
  cache.set(cacheKey, resultado, 5 * 60 * 1000);

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
9. Quando perguntarem sobre "quantos projetos" ou "quais projetos", use os dados do RESUMO DO PORTAL.

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
