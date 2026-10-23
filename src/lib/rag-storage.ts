import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile, unlink } from 'fs/promises';
import { resolve, relative, isAbsolute } from 'path';
import { STORAGE_ROOT } from '@/lib/file-storage';

const ROOT = resolve(process.env.RAG_PRIVATE_ROOT || 'storage/rag-originals');
function validarRaiz() {
  const rel = relative(STORAGE_ROOT, ROOT);
  if (!rel.startsWith('..') && !isAbsolute(rel)) throw new Error('Originais do RAG devem ficar fora da pasta pública de arquivos');
}
export function caminhoOriginal(key: string) {
  validarRaiz();
  if (!/^[a-f0-9-]{36}\.(pdf|docx|doc|txt|md|csv|xlsx|xls)$/.test(key)) throw new Error('Caminho de original inválido');
  return resolve(ROOT, key);
}
export async function salvarOriginalRag(buffer: Buffer, type: string) {
  if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw new Error('Arquivo vazio ou maior que 20 MB');
  if (type === 'pdf' && buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('PDF inválido');
  if (['docx', 'xlsx'].includes(type) && buffer.subarray(0, 2).toString() !== 'PK') throw new Error('Arquivo Office inválido');
  if (['doc', 'xls'].includes(type) && buffer.subarray(0, 8).toString('hex') !== 'd0cf11e0a1b11e1') throw new Error('Arquivo Office inválido');
  if (['txt', 'md', 'csv'].includes(type) && buffer.includes(0)) throw new Error('Texto com conteúdo binário');
  const key = `${randomUUID()}.${type}`;
  const path = caminhoOriginal(key);
  await mkdir(ROOT, { recursive: true });
  await writeFile(path, buffer, { flag: 'wx', mode: 0o600 });
  return key;
}
export const lerOriginalRag = (key: string) => readFile(caminhoOriginal(key));
export const removerOriginalRag = async (key: string) => { await unlink(caminhoOriginal(key)).catch(() => undefined); };
