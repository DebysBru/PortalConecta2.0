import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { processDocumentWithAI, generateChunkTags } from '@/lib/rag-processor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const titulo = formData.get('titulo') as string;
    const tipo = formData.get('tipo') as string;

    if (!file || !titulo) {
      return NextResponse.json({ error: 'Arquivo e título são obrigatórios' }, { status: 400 });
    }

    // Validar tipo de arquivo
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Apenas arquivos PDF são aceitos' }, { status: 400 });
    }

    // Ler o arquivo
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extrair texto do PDF usando pdf2json
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PDFParser = require('pdf2json');

    const conteudo = await new Promise<string>((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataError', (errData: unknown) => {
        reject(new Error('Erro ao parse PDF'));
      });

      pdfParser.on('pdfParser_dataReady', (pdfData: { Pages?: Array<{ Texts?: Array<{ R?: Array<{ T?: string }> }> }> }) => {
        const textParts: string[] = [];
        if (pdfData.Pages) {
          for (const page of pdfData.Pages) {
            if (page.Texts) {
              for (const text of page.Texts) {
                if (text.R) {
                  for (const r of text.R) {
                    if (r.T) {
                      // Decodificar URL encoding
                      textParts.push(decodeURIComponent(r.T));
                    }
                  }
                }
              }
              textParts.push('\n'); // Quebra de página
            }
          }
        }
        resolve(textParts.join(' '));
      });

      pdfParser.loadPDF(buffer);
    });

    const numPages = 1; // pdf2json não retorna easily, mas funciona

    if (!conteudo || conteudo.trim().length === 0) {
      return NextResponse.json({ error: 'Não foi possível extrair texto do PDF' }, { status: 400 });
    }

    // Gerar hash para idempotência
    const content_hash = createHash('md5').update(conteudo).digest('hex');

    // Verificar se já existe
    const existing = await prisma.ragDocumento.findFirst({ where: { content_hash } });
    if (existing) {
      return NextResponse.json({ error: 'Documento já existe (mesmo conteúdo)' }, { status: 409 });
    }

    // Processar com IA (organiza, gera tags, resume)
    const aiResult = await processDocumentWithAI(titulo, conteudo);

    // Criar documento com conteúdo processado
    const doc = await prisma.ragDocumento.create({
      data: {
        titulo,
        conteudo,
        resumo: aiResult.resumo,
        tags: aiResult.tags,
        links: aiResult.links,
        tipo: tipo || 'outro',
        content_hash,
        processado: true,
        metadata: JSON.stringify({
          source: 'pdf_upload',
          filename: file.name,
          pages: numPages,
          uploaded_at: new Date().toISOString(),
        }),
      },
    });

    // Criar chunks com tags específicas
    const chunks = chunkText(conteudo, 500);
    for (let i = 0; i < chunks.length; i++) {
      const chunkTags = generateChunkTags(chunks[i], aiResult.tags);

      // Tentar encontrar o título da seção para este chunk
      const sectionTitle = findSectionTitle(chunks[i], aiResult.sections);

      await prisma.ragChunk.create({
        data: {
          documento_id: doc.id,
          chunk_index: i,
          conteudo: chunks[i],
          titulo: sectionTitle,
          tags: chunkTags,
          metadata: JSON.stringify({
            chunk_total: chunks.length,
            page_hint: Math.floor((i / chunks.length) * numPages),
          }),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: doc.id,
        titulo: doc.titulo,
        resumo: aiResult.resumo,
        tags: aiResult.tags,
        links: aiResult.links.length,
        chunks: chunks.length,
        pages: numPages,
        processado: true,
      },
    });
  } catch (e) {
    console.error('RAG upload error:', e);
    return NextResponse.json({ error: 'Erro ao processar PDF' }, { status: 500 });
  }
}

function findSectionTitle(
  chunkContent: string,
  sections: Array<{ titulo: string; conteudo: string }>
): string | null {
  const chunkLower = chunkContent.toLowerCase().slice(0, 100);

  for (const section of sections) {
    const sectionLower = section.conteudo.toLowerCase().slice(0, 100);
    if (chunkLower.includes(sectionLower) || sectionLower.includes(chunkLower)) {
      return section.titulo;
    }
  }

  return null;
}

function chunkText(text: string, maxWords: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    if (currentLength + 1 > maxWords && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [word];
      currentLength = 1;
    } else {
      currentChunk.push(word);
      currentLength++;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks.length > 0 ? chunks : [text];
}
