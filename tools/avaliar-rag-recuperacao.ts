/** Avaliação de recuperação real, sem geração. As respostas ainda exigem revisão humana. */
import '../prisma/_env';
import { buscarContextoChat } from '../src/lib/chat-context';
import { prisma } from '../src/lib/prisma';
import { writeFile } from 'fs/promises';
const questions = [
  ['exato', 'Qual a carga horária do curso Técnico em Eletrotécnica?'],
  ['exato', 'O que diz o regulamento de monitoria?'],
  ['exato', 'Quais são os projetos de robótica?'],
  ['exato', 'Quais editais de bolsas estão abertos?'],
  ['exato', 'Quais projetos de agroecologia existem?'],
  ['parafrase', 'Posso conseguir ajuda para alimentação?'],
  ['parafrase', 'Como estudar programação no campus?'],
  ['parafrase', 'Quem pode participar de atividades de extensão?'],
  ['parafrase', 'Quero trabalhar como monitor, como funciona?'],
  ['parafrase', 'Que apoio existe para continuar estudando?'],
  ['continuacao-base', 'Fale sobre o curso Técnico em Eletrotécnica.'],
  ['continuacao-base', 'Fale sobre projetos de robótica.'],
  ['continuacao-base', 'Fale sobre o regulamento de monitoria.'],
  ['continuacao-base', 'Fale sobre auxílio estudantil.'],
  ['continuacao-base', 'Fale sobre projetos de extensão.'],
  ['filtro', 'Quantos projetos de pesquisa existem?'],
  ['filtro', 'Quantos projetos de robótica existem?'],
  ['filtro', 'Quais projetos estão com inscrições abertas?'],
  ['filtro', 'Quais editais estão encerrados?'],
  ['filtro', 'Quais projetos de informática e pesquisa existem?'],
  ['ausencia', 'O que diz o edital 99999/2099?'],
  ['ausencia', 'Existem projetos de teletransporte quântico interplanetário?'],
  ['ausencia', 'Qual o resultado do torneio de xadrez de Marte?'],
  ['ausencia', 'Quem ganhou o edital "INEXISTENTE-IFIZINHA-2099"?'],
  ['ausencia', 'Qual o prazo do projeto "INEXISTENTE-IFIZINHA-2099"?'],
  ['vigencia', 'Quais editais estão abertos hoje?'],
  ['vigencia', 'Quais projetos não estão encerrados?'],
  ['vigencia', 'Qual é o calendário acadêmico de 2026?'],
  ['vigencia', 'Como conferir retificações de editais?'],
  ['vigencia', 'Onde encontro prazos de inscrição para bolsas?'],
];
async function main() {
  const db = new URL(process.env.DATABASE_URL!);
  if (!['localhost', '127.0.0.1'].includes(db.hostname)) throw new Error('Esta avaliação exige banco local');
  const results = [];
  for (const [category, query] of questions) {
    const started = Date.now();
    try {
      const r = await buscarContextoChat(query);
      results.push({ category, query, elapsedMs: Date.now() - started, mode: r.mode, contextBytes: r.bytes, omitted: r.omitted, sources: r.fontes.map(f => ({ id: f.documentoId, title: f.titulo, url: f.url })), structuredSummary: r.contexto.match(/(?:PROJETOS|EDITAIS):[^\n]+/g), manualReview: 'pendente' });
    } catch (error) { results.push({ category, query, elapsedMs: Date.now() - started, error: error instanceof Error ? error.message : 'erro' }); }
  }
  const report = { generatedAt: new Date().toISOString(), generation: 'não executada', results };
  await writeFile('.local-test/rag-recuperacao-real.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ queries: results.length, errors: results.filter(r => 'error' in r).length, withSources: results.filter(r => 'sources' in r && r.sources?.length).length, report: '.local-test/rag-recuperacao-real.json' }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
