import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateEmbedding } from '@/lib/embeddings';
import { searchSimilarChunks, extrairUrlDaFonte } from '@/lib/busca-vetorial';
import { montarFontesDeChunks, montarFontesDeRegistros, type FonteResposta } from '@/lib/fontes-resposta';
import { detectarPessoaCitada } from '@/lib/pessoa-na-pergunta';
import { trechoParaContexto } from '@/lib/trecho-contexto';
import { normalizarPergunta, dataCivilAtual, limitarEvidencias } from '@/lib/chat-policy';
import { createLogger } from '@/lib/logger';
const log = createLogger('chat-context');

const THEMES: Array<[RegExp, string[]]> = [
  [/\b(tecnologia|informatica|computacao|programacao|software|redes)\b/, ['informática', 'computação', 'software', 'programação', 'tecnologia', 'redes', 'digital', 'maker', 'robótica']],
  [/\b(agronomia|agricultura|agroecologia|rural)\b/, ['agronomia', 'agrícola', 'agroecologia', 'agricultura', 'solo', 'rural']],
  [/\b(educacao|pedagogia|escola)\b/, ['educação', 'pedagógico', 'pedagogia', 'escolar']],
  [/\b(arte|musica|cultura|cultural)\b/, ['arte', 'música', 'cultura']],
  [/meio ambiente|\b(ecologia|sustentabilidade|ambiental)\b/, ['ambiente', 'ecologia', 'sustentabilidade', 'ambiental']],
  [/\b(saude|enfermagem|nutricao)\b/, ['saúde', 'enfermagem', 'nutrição']],
  [/\b(eletronica|robotica|automacao|arduino)\b/, ['eletrônica', 'robótica', 'automação', 'arduino', 'maker']],
];
export function interpretarConsulta(query: string) {
  const p = normalizarPergunta(query);
  const edital = /\b(edita[il]s?|bolsas?|auxilios?|oportunidades?|estagios?)\b/.test(p);
  const project = /\b(projetos?)\b/.test(p) || (!edital && /\b(extensao|pesquisa|ensino|inovacao)\b/.test(p));
  const notOpen = /\b(nao|sem)\s+(estao\s+)?abert/.test(p);
  const notClosed = /\b(nao|sem)\s+(estao\s+)?encerrad/.test(p);
  const closed = !notClosed && /\b(encerrad[oa]s?|finalizad[oa]s?|fechad[oa]s?)\b/.test(p);
  const open = !notOpen && !closed && /\b(abert[oa]s?|inscricoes|inscrever)\b/.test(p) && !/\b(nao|sem)\s+(estao\s+)?abert/.test(p);
  const exact = query.match(/["“]([^"”]{3,160})["”]/)?.[1];
  const number = p.match(/\bedital\s*(?:n[ºo°.]?\s*)?(\d{1,5})(?:\s*\/\s*(\d{4}))?/);
  const themes = THEMES.filter(([regex]) => regex.test(p)).flatMap(([, words]) => words);
  const subject = query.match(/(?:projetos?|editais?)\s+(?:de|sobre|do|chamado|denominado)\s+(.+?)(?:[?!.]|$)/i)?.[1]?.replace(/\s+\b(existem|existentes|estao|estão|ativos|abertos|encerrados|disponiveis|disponíveis)\b.*$/i, '').trim();
  const specificSubject = subject && !themes.length && !/^(prof|coordenador)/i.test(subject) && !['pesquisa', 'extensao', 'ensino', 'inovacao', 'bolsas', 'auxilios', 'estagios'].includes(normalizarPergunta(subject)) ? subject : undefined;
  const type = ['extensao', 'pesquisa', 'ensino', 'inovacao'].find(t => new RegExp(`\\b${t}\\b`).test(p));
  return { edital, project, closed, open, notOpen, notClosed, exact, specificSubject, number: number ? `${number[1]}${number[2] ? `/${number[2]}` : ''}` : undefined, themes, type, count: /\b(quantos|quantas|total|quantidade)\b/.test(p) };
}

/** Nunca cachear o contexto público em memória: outro processo pode ocultar uma fonte. */
export async function buscarContextoChat(query: string, signal?: AbortSignal, anchoredIds: string[] = []) {
  const started = Date.now();
  const intent = interpretarConsulta(query);
  let queryEmbedding: number[] | undefined;
  const embeddingTask = generateEmbedding(query, { timeoutMs: 10_000, attempts: 1, signal }).then(v => { queryEmbedding = v; }).catch(() => {
    log.warn('Consulta segue com busca textual (embedding indisponível)');
  });
  // Começar texto antes do serviço externo. A busca híbrida posterior só consulta vetor.
  const textTask = searchSimilarChunks({ queryText: query, matchCount: 16 });
  const [textResult, embeddingResult] = await Promise.allSettled([textTask, embeddingTask]);
  if (embeddingResult.status === 'rejected') throw embeddingResult.reason;
  const vectorResult = queryEmbedding ? await Promise.allSettled([searchSimilarChunks({ queryEmbedding, matchCount: 16, minSimilarity: 0.2 })]) : [];
  const textual = textResult.status === 'fulfilled' ? textResult.value : [];
  const vector = vectorResult[0]?.status === 'fulfilled' ? vectorResult[0].value : [];
  if (textResult.status === 'rejected' && !vector.length) throw new Error('Recuperação indisponível', { cause: textResult.reason });
  const ranked = new Map<string, { chunk: (typeof textual)[number]; score: number }>();
  for (const list of [textual, vector]) list.forEach((chunk, i) => {
    const current = ranked.get(chunk.id);
    ranked.set(chunk.id, { chunk, score: (current?.score || 0) + 1 / (60 + i + 1) });
  });
  const results = [...ranked.values()].sort((a, b) => b.score - a.score);
  const perDoc = new Map<string, number>();
  const chunks = results.filter(({ chunk }) => {
    const identityText = normalizarPergunta(`${chunk.documento_titulo}\n${chunk.texto}`);
    if (intent.exact && !identityText.includes(normalizarPergunta(intent.exact))) return false;
    if (intent.specificSubject && !identityText.includes(normalizarPergunta(intent.specificSubject))) return false;
    if (intent.number) {
      const [number, year] = intent.number.split('/');
      const pattern = `\\bedital\\s*(?:n[ºo°.]?\\s*)?0*${Number(number)}${year ? `\\s*/\\s*${year}` : '\\b'}`;
      if (!new RegExp(pattern).test(identityText)) return false;
    }
    const used = perDoc.get(chunk.documento_id) || 0;
    perDoc.set(chunk.documento_id, used + 1);
    return used < 2;
  }).slice(0, 8).map(({ chunk, score }) => ({ ...chunk, similarity: score }));
  if (/o que (voce )?(sabe|conhece|aprendeu)|base de conhecimento|quais (conteudos|documentos|assuntos)/.test(normalizarPergunta(query)) && !anchoredIds.length) {
    const index = await prisma.documentoKb.findFirst({ where: { refId: 'ifpr-md:indice', ativo: true }, include: { chunks: { where: { ativo: true }, orderBy: { chunkIndex: 'asc' }, take: 4 } } });
    if (index) chunks.unshift(...index.chunks.map(c => ({ id: c.id, documento_id: index.id, chunk_index: c.chunkIndex, texto: c.texto, secao: c.secao, categoria: c.categoria, pagina_inicial: c.paginaInicial, pagina_final: c.paginaFinal, metadata: c.metadata as Record<string, unknown>, documento_titulo: index.titulo, documento_tipo: index.tipo, similarity: 2 })));
  }
  const docIds = [...new Set([...chunks.map(c => c.documento_id), ...anchoredIds.slice(0, 8)])];
  const docs = docIds.length ? await prisma.documentoKb.findMany({ where: { id: { in: docIds }, ativo: true }, select: { id: true, titulo: true, tipo: true, refId: true, metadata: true, storagePath: true } }) : [];
  const urls = new Map<string, string | null>();
  for (const doc of docs) {
    const meta = (doc.metadata || {}) as Record<string, unknown>;
    let url = extrairUrlDaFonte(meta);
    if (doc.tipo === 'indice_kb') url = '/ifizinha/conteudos';
    if (doc.tipo === 'projeto_sintetico') {
      const project = await prisma.projeto.findFirst({ where: { id: doc.refId || '', review_status: 'PUBLICADO', deleted_at: null }, select: { slug: true } });
      url = project?.slug ? `/projetos/${project.slug}` : null;
    } else if (!url) url = doc.storagePath && !meta.originalKey ? `${(process.env.STORAGE_PUBLIC_PREFIX || '/files').replace(/\/+$/, '')}/${doc.storagePath}` : `/ifizinha/fontes/${doc.id}`;
    urls.set(doc.id, url);
  }
  // Âncoras são apenas IDs assinados; a visibilidade é novamente validada acima.
  const visible = new Set(docs.filter(d => urls.get(d.id)).map(d => d.id));
  const selectedChunks = chunks.filter(c => visible.has(c.documento_id) && (anchoredIds.length !== 1 || c.documento_id === anchoredIds[0]));
  const sources = montarFontesDeChunks(selectedChunks, urls);
  const blocks: Array<{ text: string; source: number | null }> = [];
  for (const chunk of selectedChunks) {
    const source = sources.find(s => s.documentoId === chunk.documento_id);
    if (source) blocks.push({ text: `\n[fonte ${source.numero}] ${source.titulo}\nSeção: ${chunk.secao || 'não informada'}\n${chunk.texto}`, source: source.numero });
  }
  // Documento da conversa que não apareceu na recuperação é consultado com termos atuais.
  if (anchoredIds.length && !docs.some(d => anchoredIds.includes(d.id))) {
    return { contexto: '', fontes: [] as FonteResposta[], mode: 'fonte-indisponivel', bytes: 0, omitted: 0 };
  }
  const today = new Date(`${dataCivilAtual()}T00:00:00.000Z`);
  if (intent.project) {
    const where: Prisma.ProjetoWhereInput = { review_status: 'PUBLICADO', deleted_at: null };
    const and: Prisma.ProjetoWhereInput[] = [];
    if (intent.type) where.tipo = { contains: intent.type, mode: 'insensitive' };
    if (intent.notOpen) where.status = { not: 'INSCRICOES_ABERTAS' };
    else if (intent.notClosed) where.status = { not: 'ENCERRADO' };
    else if (intent.closed) where.status = 'ENCERRADO';
    else if (intent.open) { where.status = 'INSCRICOES_ABERTAS'; where.inscricoes_abertas = true; and.push({ OR: [{ inscricao_fim: null }, { inscricao_fim: { gte: today } }] }); }
    else if (/\b(ativos?|em andamento|execucao)\b/.test(normalizarPergunta(query))) where.status = { in: ['ATIVO', 'EM_EXECUCAO', 'INSCRICOES_ABERTAS'] };
    const names = await prisma.projeto.findMany({ where: { review_status: 'PUBLICADO', deleted_at: null }, select: { coordenador: true, viceCoordenadorNome: true }, distinct: ['coordenador', 'viceCoordenadorNome'] });
    const person = detectarPessoaCitada(query, names.flatMap(p => [p.coordenador, p.viceCoordenadorNome]));
    if (person) and.push({ OR: [{ coordenador: { contains: person, mode: 'insensitive' } }, { viceCoordenadorNome: { contains: person, mode: 'insensitive' } }] });
    if (intent.themes.length) and.push({ OR: intent.themes.flatMap(term => [{ nome: { contains: term, mode: 'insensitive' } }, { resumoCurto: { contains: term, mode: 'insensitive' } }, { descricao: { contains: term, mode: 'insensitive' } }, { tags: { some: { tag: { contains: term, mode: 'insensitive' } } } }]) });
    if (!person && intent.specificSubject) and.push({ OR: [{ nome: { contains: intent.specificSubject, mode: 'insensitive' } }, { descricao: { contains: intent.specificSubject, mode: 'insensitive' } }] });
    if (intent.exact) and.push({ nome: { contains: intent.exact, mode: 'insensitive' } });
    if (and.length) where.AND = and;
    const [total, projects] = await Promise.all([
      prisma.projeto.count({ where }),
      prisma.projeto.findMany({ where, take: 8, orderBy: [{ destaque: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }], select: { id: true, nome: true, slug: true, tipo: true, resumoCurto: true, descricao: true, coordenador: true, status: true, inscricao_fim: true, vagasBolsista: true, vagasVoluntario: true } }),
    ]);
    blocks.push({ text: `PROJETOS: ${total} correspondem aos filtros. Mostrando ${projects.length} de ${total}. ${total > projects.length ? 'Há mais resultados em /projetos. Não declare lista completa.' : 'Este recorte inclui todos os resultados do filtro.'}`, source: null });
    for (const project of projects) {
      const [source] = montarFontesDeRegistros(sources.length + 1, [project]);
      if (!source?.url) continue;
      sources.push(source);
      blocks.push({ text: `\n[fonte ${source.numero}] PROJETO: ${project.nome}\nTipo: ${project.tipo}\nCoordenador: ${project.coordenador}\nStatus: ${project.status}\nPrazo: ${project.inscricao_fim?.toISOString().slice(0, 10) || 'não informado'}\nVagas: ${project.vagasBolsista} bolsistas e ${project.vagasVoluntario} voluntários\n${trechoParaContexto(project.resumoCurto || project.descricao, 900)}`, source: source.numero });
    }
  }
  if (intent.edital) {
    const where: Prisma.EditalWhereInput = { review_status: 'PUBLICADO', deleted_at: null };
    if (intent.notOpen) where.status = { not: 'ABERTO' };
    else if (intent.notClosed) where.status = { not: 'ENCERRADO' };
    else if (intent.closed) where.status = 'ENCERRADO';
    else if (intent.open) { where.status = 'ABERTO'; where.OR = [{ dataEncerramento: null }, { dataEncerramento: { gte: today } }]; }
    if (/bolsa/.test(normalizarPergunta(query))) where.categoria = 'BOLSAS';
    else if (/auxilio/.test(normalizarPergunta(query))) where.categoria = 'AUXILIOS';
    else if (/estagio/.test(normalizarPergunta(query))) where.categoria = 'ESTAGIOS';
    if (intent.specificSubject && !intent.exact && !intent.number) where.AND = [{ OR: [{ titulo: { contains: intent.specificSubject, mode: 'insensitive' } }, { resumo: { contains: intent.specificSubject, mode: 'insensitive' } }] }];
    if (intent.exact) where.titulo = { contains: intent.exact, mode: 'insensitive' };
    if (intent.number) {
      const [number, year] = intent.number.split('/');
      const pattern = `(^|[^0-9])0*${Number(number)}${year ? `[[:space:]]*/[[:space:]]*${year}` : ''}([^0-9]|$)`;
      const matching = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Edital" WHERE titulo ~* ${pattern}`;
      where.id = { in: matching.map(record => record.id) };
    }
    const [total, records] = await Promise.all([
      prisma.edital.count({ where }),
      prisma.edital.findMany({ where, take: 5, orderBy: [{ destaque: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }], select: { titulo: true, slug: true, categoria: true, status: true, resumoSimples: true, resumo: true, quemPode: true, beneficios: true, dataEncerramento: true } }),
    ]);
    blocks.push({ text: `EDITAIS: ${total} correspondem aos filtros. Mostrando ${records.length} de ${total}. ${total > records.length ? 'Mais resultados em /editais. Não declare lista completa.' : ''}`, source: null });
    for (const record of records) {
      const [source] = montarFontesDeRegistros(sources.length + 1, [], [record]);
      if (!source?.url) continue;
      sources.push(source);
      blocks.push({ text: `\n[fonte ${source.numero}] EDITAL: ${record.titulo}\nStatus: ${record.status}\nPrazo: ${record.dataEncerramento?.toISOString().slice(0, 10) || 'não informado'}\nResumo: ${trechoParaContexto(record.resumoSimples || record.resumo, 700)}\nQuem pode: ${trechoParaContexto(record.quemPode, 400)}\nBenefícios: ${trechoParaContexto(record.beneficios, 400)}`, source: source.numero });
    }
  }
  // Reservar primeiro contagens e registros filtrados; depois trechos documentais.
  const ordered = [...blocks.filter(b => b.source === null || /PROJETO:|EDITAL:/.test(b.text)), ...blocks.filter(b => b.source !== null && !/PROJETO:|EDITAL:/.test(b.text))];
  const budget = limitarEvidencias(ordered, 15600);
  if (budget.omitted) budget.selected.unshift({ text: 'RECORTE POR ORÇAMENTO: parte dos trechos foi omitida. Não declare que todos os itens do recorte inicial foram apresentados; use o total filtrado e ofereça a listagem do portal.', source: null });
  const used = new Set(budget.selected.map(b => b.source));
  const fontes = sources.filter(s => used.has(s.numero));
  const mode = textual.length && vector.length ? 'hibrido' : vector.length ? 'vetorial' : 'textual';
  log.info('Contexto recuperado', { mode, elapsedMs: Date.now() - started, chunks: chunks.length, sources: fontes.length, bytes: budget.bytes, omitted: budget.omitted });
  return { contexto: budget.selected.map(b => b.text).join('\n'), fontes, mode, bytes: budget.bytes, omitted: budget.omitted };
}
