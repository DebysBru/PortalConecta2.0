import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

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

    // Extrair texto do PDF
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      return NextResponse.json({ error: 'Não foi possível extrair texto do PDF' }, { status: 400 });
    }

    const conteudo = pdfData.text;

    // Gerar hash para idempotência
    const content_hash = createHash('md5').update(conteudo).digest('hex');

    // Verificar se já existe
    const existing = await prisma.ragDocumento.findFirst({ where: { content_hash } });
    if (existing) {
      return NextResponse.json({ error: 'Documento já existe (mesmo conteúdo)' }, { status: 409 });
    }

    // Criar documento
    const doc = await prisma.ragDocumento.create({
      data: {
        titulo,
        conteudo,
        tipo: tipo || 'outro',
        content_hash,
        metadata: JSON.stringify({
          source: 'pdf_upload',
          filename: file.name,
          pages: pdfData.numpages,
          uploaded_at: new Date().toISOString(),
        }),
      },
    });

    // Criar chunks (~500 palavras)
    const chunks = chunkText(conteudo, 500);
    for (let i = 0; i < chunks.length; i++) {
      await prisma.ragChunk.create({
        data: {
          documento_id: doc.id,
          chunk_index: i,
          conteudo: chunks[i],
          metadata: JSON.stringify({
            chunk_total: chunks.length,
            page_hint: Math.floor((i / chunks.length) * (pdfData.numpages || 1)),
          }),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: doc.id,
        titulo: doc.titulo,
        chunks: chunks.length,
        pages: pdfData.numpages,
      },
    });
  } catch (e) {
    console.error('RAG upload error:', e);
    return NextResponse.json({ error: 'Erro ao processar PDF' }, { status: 500 });
  }
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
