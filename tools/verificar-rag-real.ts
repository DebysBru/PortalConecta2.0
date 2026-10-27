/** Smoke test local: API real + Firebase real + PostgreSQL, com limpeza das fixtures. */
import '../prisma/_env';
import { PrismaClient } from '@prisma/client';
import { getAdminAuth } from '../src/lib/firebase-admin';
import { removerOriginalRag } from '../src/lib/rag-storage';
import { randomUUID } from 'crypto';
import { generateEmbedding } from '../src/lib/embeddings';
import { searchSimilarChunks } from '../src/lib/busca-vetorial';
const db = new PrismaClient();
const base = process.env.RAG_TEST_BASE || 'http://127.0.0.1:3002';
const marker = `IFIZINHA-TEST-${randomUUID()}`;
const results: Array<{ scenario: string; status: string; detail?: unknown }> = [];
const created: string[] = [];
let lastQuestionAt = 0;
let chatBearer = '';
async function chatRequest(message: string, state?: string) {
  const wait = 5100 - (Date.now() - lastQuestionAt);
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  lastQuestionAt = Date.now();
  // O guard abaixo restringe o teste a loopback; o chat exige a conta real de teste.
  return fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chatBearer}` }, body: JSON.stringify({ message, state }), signal: AbortSignal.timeout(50_000) });
}
const assert = (condition: unknown, label: string, detail?: unknown) => {
  results.push({ scenario: label, status: condition ? 'PASS' : 'FAIL', detail });
  if (!condition) throw new Error(`Falhou: ${label}`);
};
async function token(email: string) {
  const user = await getAdminAuth().getUserByEmail(email);
  const custom = await getAdminAuth().createCustomToken(user.uid);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }), signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json();
  if (!res.ok || !data.idToken) throw new Error('Não foi possível obter identidade de teste');
  return data.idToken as string;
}
async function upload(bearer?: string, previous?: string, version = 1) {
  const form = new FormData();
  form.set('titulo', `${marker} Manual de teste`);
  form.set('adminEmail', 'email-forjado@example.org');
  form.set('file', new Blob([`# Manual de verificação\nO código de verificação ${marker} na versão ${version} é ALFA-${version}.\nO prazo de teste é 30/12/2026. Este documento é uma fixture de teste, não um edital real.`], { type: 'text/plain' }), 'teste-rag.txt');
  if (previous) form.set('anteriorId', previous);
  return fetch(`${base}/api/admin/rag/upload`, { method: 'POST', headers: bearer ? { Authorization: `Bearer ${bearer}` } : {}, body: form, signal: AbortSignal.timeout(120_000) });
}
async function main() {
  const url = new URL(base), dbUrl = new URL(process.env.DATABASE_URL!);
  const local = dbUrl.port === '5433';
  const vpsClone = dbUrl.port === '5432' && /^\/portal_conecta_rag_validation_\d+$/.test(dbUrl.pathname) && url.port === '3003';
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !['127.0.0.1', 'localhost'].includes(dbUrl.hostname) || !(local || vpsClone)) throw new Error('Este smoke test exige banco local ou clone de validação da VPS na porta 3003');
  assert((await upload()).status === 401, 'Upload sem token é recusado');
  assert((await upload('invalido')).status === 401, 'Upload com token inválido é recusado');
  const admin = await db.user.findFirst({ where: { role: 'ADMIN' }, select: { email: true } });
  if (!admin) throw new Error('Não há admin local para testar');
  const bearer = await token(admin.email);
  chatBearer = bearer;
  const student = await db.user.findFirst({ where: { role: 'ESTUDANTE' }, select: { email: true } });
  if (student) {
    try {
      const studentToken = await token(student.email);
      assert((await upload(studentToken)).status === 403, 'Conta não administrativa real é recusada');
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Falhou:')) throw error;
      results.push({ scenario: 'Conta não administrativa real', status: 'PENDENTE', detail: 'Conta local sem identidade Firebase utilizável' });
    }
  }
  const res = await upload(bearer); const body = await res.json();
  if (body.data?.id) created.push(body.data.id);
  assert(res.ok && body.ok, 'Upload administrativo real', { http: res.status, state: body.data?.status });
  const id = body.data.id;
  const original = await fetch(`${base}/api/rag/fontes/${id}/original`);
  assert(original.status === 200 && (await original.text()).includes('ALFA-1'), 'Original privado é servido pelo gate público');
  const page = await fetch(`${base}/ifizinha/fontes/${id}`);
  assert(page.status === 200 && (await page.text()).includes('ALFA-1'), 'Página da fonte contém o conteúdo');
  const replacement = await upload(bearer, id, 2); const replacementBody = await replacement.json();
  if (replacementBody.data?.id) created.push(replacementBody.data.id);
  assert(replacement.ok && replacementBody.ok, 'Publicação de V2', { http: replacement.status, state: replacementBody.data?.status });
  assert((await fetch(`${base}/api/rag/fontes/${id}/original`)).status === 404, 'Original de V1 não é público após substituição');
  assert((await fetch(`${base}/ifizinha/fontes/${id}`)).status === 404, 'Página de V1 oculta após substituição');
  const current = await db.documentoKb.findUniqueOrThrow({ where: { id: replacementBody.data.id } });
  assert(current.ativo && current.versao === 2, 'Banco confirma V2 ativa');
  if (process.env.DEEPSEEK_API_KEY && process.env.GEMINI_API_KEY) {
    assert(current.status === 'indexed', 'V2 indexada com Gemini real');
    const vector = await generateEmbedding(`O código de verificação ${marker} na versão 2 é ALFA-2.`);
    const matches = await searchSimilarChunks({ queryEmbedding: vector, matchCount: 5, minSimilarity: 0.5 });
    assert(matches.some(chunk => chunk.documento_id === current.id), 'Busca exclusivamente vetorial encontra V2');
    // Três repetições: presença de reply sozinha não comprova que o RAG respondeu certo.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const ask = async (message: string, state?: string) => {
        const response = await chatRequest(message, state);
        if (!response.ok) throw new Error('Atendimento real falhou durante a avaliação semântica');
        return response.json();
      };
      const answer = await ask(`Qual é o código de verificação do manual "${marker} Manual de teste"?`);
      assert(answer.reply.includes('ALFA-2') && answer.fontes.some((f: { documentoId?: string }) => f.documentoId === current.id), `Resposta fundamentada em V2, repetição ${attempt}`);
      const follow = await ask('E o prazo?', answer.state);
      assert(/30/.test(follow.reply) && /2026/.test(follow.reply) && follow.fontes.some((f: { documentoId?: string }) => f.documentoId === current.id), `Continuação mantém a fonte, repetição ${attempt}`);
    }
  } else results.push({ scenario: 'Geração e continuidade com os dois provedores reais (3 repetições)', status: 'PENDENTE', detail: 'Requer chaves e infraestrutura pgvector' });
  const toggle = await fetch(`${base}/api/admin/rag/docs`, { method: 'PUT', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: current.id, ativo: false }) });
  assert(toggle.ok, 'Ocultação autenticada');
  assert((await fetch(`${base}/ifizinha/fontes/${current.id}`)).status === 404, 'Fonte oculta não permanece acessível');
  const reactivate = await fetch(`${base}/api/admin/rag/docs`, { method: 'PUT', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: current.id, ativo: true }) });
  assert(reactivate.ok, 'Versão já publicada pode ser reativada');
  assert((await fetch(`${base}/ifizinha/fontes/${current.id}`)).status === 200, 'Fonte reativada volta a abrir');
  const chat = await chatRequest('Qual a carga horária de Eletrotécnica?');
  const chatBody = await chat.json();
  assert(process.env.DEEPSEEK_API_KEY ? chat.ok && chatBody.reply : chat.status === 503 && chatBody.error, 'Chat real responde ou informa ausência de configuração corretamente', { http: chat.status });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  // IDs descobertos também pelo marcador: limpa uma fixture que falhou após criar o documento.
  const docs = await db.documentoKb.findMany({ where: { titulo: { startsWith: marker } } });
  const ids = docs.map(d => d.id);
  await db.job.deleteMany({ where: { OR: ids.map(documentoId => ({ payload: { path: ['documentoId'], equals: documentoId } })) } });
  await db.documentoKb.deleteMany({ where: { id: { in: ids } } });
  for (const doc of docs) {
    const key = (doc.metadata as Record<string, unknown>).originalKey;
    if (typeof key === 'string') await removerOriginalRag(key);
  }
  console.log(JSON.stringify({ environment: base, marker, results, cleanedFixtures: ids.length }, null, 2));
  await db.$disconnect();
});
