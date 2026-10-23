import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
export default async function FonteRag({ params }: { params: { id: string } }) {
  const doc = await prisma.documentoKb.findFirst({ where: { id: params.id, ativo: true }, include: { chunks: { where: { ativo: true }, orderBy: { chunkIndex: 'asc' } } } });
  if (!doc) notFound();
  if (doc.tipo === 'projeto_sintetico' && !await prisma.projeto.findFirst({ where: { id: doc.refId || '', review_status: 'PUBLICADO', deleted_at: null }, select: { id: true } })) notFound();
  const metadata = doc.metadata as Record<string, unknown>;
  const text = typeof metadata.originalText === 'string' ? metadata.originalText : doc.chunks.map(c => `${c.secao || ''}\n${c.texto}`).join('\n\n');
  return <main className="mx-auto max-w-4xl p-6"><h1 className="text-2xl font-bold">{doc.titulo}</h1>
    <p>Versão {doc.versao} · Atualizado em {doc.updatedAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
    {typeof metadata.originalKey === 'string' && <a className="text-blue-700 underline" href={`/api/rag/fontes/${doc.id}/original`}>Baixar documento original</a>}
    <div className="mt-6 whitespace-pre-wrap break-words">{text}</div></main>;
}
