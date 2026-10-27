import { NextRequest, NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/admin-auth';
import { detectFileType, extractDocument } from '@/lib/document-extract';
import { salvarOriginalRag, removerOriginalRag } from '@/lib/rag-storage';
import { ingerirDocumentoRag } from '@/lib/rag-publicacao';
import { mensagemAmigavel } from '@/lib/mensagens';

export async function POST(request: NextRequest) {
  const auth = await exigirAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let originalKey: string | undefined;
  try {
    const form = await request.formData();
    const file = form.get('file');
    const titulo = form.get('titulo');
    if (!(file instanceof File) || typeof titulo !== 'string' || !titulo.trim()) return NextResponse.json({ error: 'Informe arquivo e título.' }, { status: 400 });
    if (file.size > 20 * 1024 * 1024 || !file.size) return NextResponse.json({ error: 'Arquivo vazio ou maior que 20 MB.' }, { status: 413 });
    const type = detectFileType(file);
    if (!type) return NextResponse.json({ error: 'Formato de arquivo não aceito.' }, { status: 415 });
    const buffer = Buffer.from(await file.arrayBuffer());
    originalKey = await salvarOriginalRag(buffer, type);
    const extracted = await extractDocument(buffer, type);
    if (!extracted.text.trim()) throw new Error('Não foi encontrado texto. Para PDF escaneado, envie uma versão pesquisável.');
    const previous = form.get('anteriorId');
    const data = await ingerirDocumentoRag({ titulo, conteudo: extracted.text, tipo: String(form.get('tipo') || 'documento_livre').slice(0, 80),
      anteriorId: typeof previous === 'string' && previous ? previous : undefined,
      permitirTextual: form.get('permitirTextual') === 'true',
      originalKey, pages: extracted.pages, metadata: { source: 'upload', filename: file.name.slice(0, 255), fileType: type, autor: auth.email } });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    // Falha de ingestão nunca publica o arquivo; sua cópia privada pode ser removida.
    if (originalKey) await removerOriginalRag(originalKey);
    return NextResponse.json({ error: mensagemAmigavel(error, 'Não foi possível preparar o documento. A versão anterior foi preservada.') }, { status: 422 });
  }
}
