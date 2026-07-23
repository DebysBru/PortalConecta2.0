import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { processDocumentWithAI, generateChunkTags } from '@/lib/rag-processor';

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/plain': 'txt',
  'text/markdown': 'md',
};

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const titulo = formData.get('titulo') as string;
    const tipo = formData.get('tipo') as string;

    if (!file || !titulo) {
      return NextResponse.json({ error: 'Arquivo e título são obrigatórios' }, { status: 400 });
    }

    // Detectar tipo pelo MIME ou extensão
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const fileType = ALLOWED_TYPES[file.type] || (ALLOWED_EXTENSIONS.includes(ext) ? ext.slice(1) : null);

    if (!fileType) {
      return NextResponse.json({
        error: 'Tipo de arquivo não suportado',
        allowed: ALLOWED_EXTENSIONS.join(', '),
      }, { status: 400 });
    }

    // Ler o arquivo
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extrair texto baseado no tipo
    let conteudo = '';
    let numPages = 1;

    switch (fileType) {
      case 'pdf':
        const pdfResult = await extractPdfText(buffer);
        conteudo = pdfResult.text;
        numPages = pdfResult.pages;
        break;

      case 'docx':
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mammoth = require('mammoth');
        const docxResult = await mammoth.extractRawText({ buffer });
        conteudo = docxResult.value || '';
        break;

      case 'doc':
        // DOC legado - tentar com mammoth (pode não funcionar perfeitamente)
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mammothDoc = require('mammoth');
          const docResult = await mammothDoc.extractRawText({ buffer });
          conteudo = docResult.value || '';
        } catch {
          return NextResponse.json({ error: 'Formato .doc não suportado. Converta para .docx' }, { status: 400 });
        }
        break;

      case 'txt':
      case 'md':
        conteudo = buffer.toString('utf-8');
        break;
    }

    if (!conteudo || conteudo.trim().length === 0) {
      return NextResponse.json({
        error: 'Não foi possível extrair texto do arquivo. O documento pode ser apenas uma imagem.',
        debug: { fileType, length: conteudo.length },
      }, { status: 400 });
    }

    console.log('Text extracted:', { fileType, length: conteudo.length, pages: numPages });

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
          source: 'upload',
          fileType,
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
            page_hint: numPages > 1 ? Math.floor((i / chunks.length) * numPages) : null,
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
        fileType,
        processado: true,
      },
    });
  } catch (e) {
    console.error('RAG upload error:', e);
    return NextResponse.json({ error: 'Erro ao processar arquivo' }, { status: 500 });
  }
}

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PDFParser = require('pdf2json');

    const text = await new Promise<string>((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataError', (errData: unknown) => {
        console.error('PDF parse error:', errData);
        reject(new Error('Erro ao parse PDF'));
      });

      pdfParser.on('pdfParser_dataReady', () => {
        const rawText = pdfParser.getRawTextContent();
        resolve(rawText || '');
      });

      pdfParser.parseBuffer(buffer);
    });

    // Contar páginas aproximado
    const pageMarkers = text.match(/-- \d+ of \d+ --/g);
    const pages = pageMarkers ? parseInt(pageMarkers[pageMarkers.length - 1]?.match(/\d+ of (\d+)/)?.[1] || '1') : 1;

    return { text, pages };
  } catch (e) {
    console.error('PDF extraction failed:', e);
    return { text: '', pages: 0 };
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
  // Limpar texto: remover múltiplos espaços/quebras
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const words = cleanText.split(/\s+/);
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

  return chunks.length > 0 ? chunks : [cleanText];
}
