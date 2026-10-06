import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { detectFileType, extractDocument, ALLOWED_EXTENSIONS } from '@/lib/document-extract';
import { chunkDocument } from '@/lib/chunking';
import { deactivateOldDocumentVersions } from '@/lib/busca-vetorial';
import { curarDocumentoKb } from '@/lib/kb-worker';
import { indexarDocumentoKb } from '@/lib/indexador';
import { MENSAGENS, mensagemAmigavel } from '@/lib/mensagens';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

async function isAdmin(email: string | null): Promise<boolean> {
  if (!email) return false;
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  return user?.role === 'ADMIN';
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const titulo = (formData.get('titulo') as string | null)?.trim();
  const tipo = (formData.get('tipo') as string | null) || 'documento_livre';
  const adminEmail = formData.get('adminEmail') as string | null;

  if (!(await isAdmin(adminEmail))) {
    return NextResponse.json({ error: MENSAGENS.semPermissaoAdmin }, { status: 403 });
  }

  if (!file || !titulo) {
    return NextResponse.json(
      { error: `Para cadastrar um documento, informe ${!file ? 'o arquivo' : 'o título'}.` },
      { status: 400 }
    );
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const hashArquivo = createHash('sha256').update(buffer).digest('hex');

  const existenteAtivo = await prisma.documentoKb.findFirst({ where: { hashArquivo, ativo: true } });
  if (existenteAtivo) {
    return NextResponse.json(
      {
        error: 'Este mesmo arquivo já está disponível na base de conhecimento. Se quiser substituí-lo, desative o documento atual antes de enviar de novo.',
        docId: existenteAtivo.id,
      },
      { status: 409 }
    );
  }

  const versaoAnterior = await prisma.documentoKb.findFirst({
    where: { titulo },
    orderBy: { versao: 'desc' },
    select: { versao: true },
  });
  const versao = (versaoAnterior?.versao ?? 0) + 1;

  const doc = await prisma.documentoKb.create({
    data: {
      titulo,
      tipo,
      hashArquivo,
      versao,
      status: 'extracting',
      metadata: { fileType, filename: file.name, sizeBytes: file.size, uploaded_at: new Date().toISOString() },
    },
  });

  await prisma.ragUploadLog.create({ data: { filename: file.name, docId: doc.id, status: 'processing' } });

  try {
    const extracted = await extractDocument(buffer, fileType);

    if (!extracted.text.trim()) {
      const msg = extracted.hasTextLayer === false
        ? 'Este PDF parece ser uma imagem digitalizada (escaneada), então não conseguimos ler o texto. Converta para PDF pesquisável ou envie o conteúdo em DOCX ou TXT.'
        : 'Não conseguimos encontrar texto neste arquivo. Verifique se o documento não está vazio ou protegido e tente novamente.';
      await prisma.documentoKb.update({ where: { id: doc.id }, data: { status: 'failed', erro: msg } });
      await prisma.ragUploadLog.updateMany({ where: { docId: doc.id }, data: { status: 'error', error: msg } });
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const chunks = chunkDocument(extracted.text);

    await prisma.chunkKb.createMany({
      data: chunks.map((c, i) => ({
        documentoId: doc.id,
        documentoVersao: versao,
        chunkIndex: i,
        texto: c.texto,
        secao: c.secao,
        metadata: { chunk_total: chunks.length },
      })),
    });

    await prisma.documentoKb.update({
      where: { id: doc.id },
      data: { status: 'chunking', totalPaginas: extracted.pages, totalChunks: chunks.length },
    });

    await prisma.ragUploadLog.updateMany({ where: { docId: doc.id }, data: { status: 'done', chunks: chunks.length } });

    if (versao > 1) {
      await deactivateOldDocumentVersions(titulo, doc.id);
    }

    await curarDocumentoKb(doc.id);
    await indexarDocumentoKb(doc.id);

    const final = await prisma.documentoKb.findUnique({ where: { id: doc.id }, select: { status: true } });

    return NextResponse.json({
      ok: true,
      data: {
        id: doc.id,
        titulo: doc.titulo,
        versao,
        chunks: chunks.length,
        pages: extracted.pages,
        fileType,
        status: final?.status ?? 'chunking',
      },
    });
  } catch (e) {
    // O texto cru do erro (Prisma/infra) fica no log e no registro do
    // documento; a resposta ao painel recebe a versão amigável.
    console.error('Falha ao processar documento do RAG:', e);
    const msg = mensagemAmigavel(
      e,
      'Não conseguimos processar este documento. Tente enviar novamente — se o problema continuar, tente outro formato de arquivo.'
    );
    await prisma.documentoKb.update({ where: { id: doc.id }, data: { status: 'failed', erro: msg } });
    await prisma.ragUploadLog.updateMany({ where: { docId: doc.id }, data: { status: 'error', error: msg } });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
