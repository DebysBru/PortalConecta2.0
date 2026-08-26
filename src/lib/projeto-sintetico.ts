/**
 * Projeto sintético — Etapa 5 do plano RAG. Gera um `DocumentoKb` (tipo
 * `projeto_sintetico`) a partir dos dados estruturados de um `Projeto`, para
 * que a IFizinha encontre projetos pela mesma busca vetorial usada em
 * documentos institucionais, em vez de só pela busca por campos em
 * `buscarContexto` (`/api/chat`). Chamado depois de qualquer criação/edição de
 * projeto (admin, professor, sync SUAP) — nunca lança erro para o chamador,
 * já que é enriquecimento, não uma operação crítica do CRUD do projeto.
 *
 * Gate de visibilidade: só entra na base um projeto com
 * `review_status = 'PUBLICADO'` e não deletado — mesmo critério que a
 * home/`/projetos`/`/api/chat` já usam para decidir o que é público. Hoje
 * (2026-08-26) nada no app ainda seta `review_status` para `PUBLICADO`
 * automaticamente (lacuna pré-existente, fora do escopo desta etapa) — então,
 * até isso ser resolvido, nenhum projeto vai de fato aparecer na base. É o
 * comportamento certo (não vaza rascunho), só documentando a causa.
 */

import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { chunkDocument } from '@/lib/chunking';
import { curarDocumentoKb } from '@/lib/kb-worker';
import { indexarDocumentoKb } from '@/lib/indexador';
import { getStatusLabel } from '@/lib/utils';
import { Prisma } from '@prisma/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('projeto-sintetico');

const projetoComRelacoes = Prisma.validator<Prisma.ProjetoDefaultArgs>()({
  include: {
    tags: true,
    cursos: true,
    faq: { orderBy: { ordem: 'asc' } },
  },
});
type ProjetoComRelacoes = Prisma.ProjetoGetPayload<typeof projetoComRelacoes>;

function gerarTextoSintetico(projeto: ProjetoComRelacoes): string {
  const linhas: string[] = [];

  linhas.push(`Projeto: ${projeto.nome}`);
  if (projeto.tipo) linhas.push(`Tipo: ${projeto.tipo}`);
  linhas.push(`Área: ${projeto.area}`);
  linhas.push(`Status: ${getStatusLabel(projeto.status)}`);
  linhas.push(`Coordenador: ${projeto.coordenador}${projeto.coordenadorEmail ? ` (${projeto.coordenadorEmail})` : ''}`);
  if (projeto.viceCoordenadorNome) {
    linhas.push(`Vice-coordenador: ${projeto.viceCoordenadorNome}${projeto.viceCoordenadorEmail ? ` (${projeto.viceCoordenadorEmail})` : ''}`);
  }

  if (projeto.resumoCurto) linhas.push(`\nResumo: ${projeto.resumoCurto}`);
  if (projeto.descricao) linhas.push(`\nDescrição: ${projeto.descricao}`);
  if (projeto.objetivo) linhas.push(`\nObjetivo: ${projeto.objetivo}`);
  if (projeto.metodologia) linhas.push(`\nMetodologia: ${projeto.metodologia}`);
  if (projeto.resultadoEsperado) linhas.push(`\nResultado esperado: ${projeto.resultadoEsperado}`);
  if (projeto.publicoAlvo) linhas.push(`Público-alvo: ${projeto.publicoAlvo}`);
  if (projeto.localRealizacao) linhas.push(`Local de realização: ${projeto.localRealizacao}`);
  if (projeto.cargaHorariaSemanal) linhas.push(`Carga horária semanal: ${projeto.cargaHorariaSemanal}h`);
  if (projeto.dataInicio) linhas.push(`Início: ${projeto.dataInicio.toLocaleDateString('pt-BR')}`);
  if (projeto.dataConclusao) linhas.push(`Conclusão prevista: ${projeto.dataConclusao.toLocaleDateString('pt-BR')}`);

  linhas.push(`\nInscrições: ${projeto.inscricoes_abertas ? 'ABERTAS' : 'fechadas no momento'}`);
  if (projeto.inscricoes_abertas) {
    linhas.push(`Vagas bolsista: ${projeto.vagasBolsista}`);
    linhas.push(`Vagas voluntário: ${projeto.vagasVoluntario}`);
    if (projeto.inscricao_fim) linhas.push(`Prazo de inscrição: ${projeto.inscricao_fim.toLocaleDateString('pt-BR')}`);
  }

  if (projeto.tags.length > 0) linhas.push(`\nTags: ${projeto.tags.map((t) => t.tag).join(', ')}`);
  if (projeto.cursos.length > 0) linhas.push(`Cursos relacionados: ${projeto.cursos.map((c) => c.curso).join(', ')}`);

  if (projeto.faq.length > 0) {
    linhas.push('\nPerguntas frequentes:');
    for (const f of projeto.faq) {
      linhas.push(`P: ${f.pergunta}\nR: ${f.resposta}`);
    }
  }

  const contatos: string[] = [];
  if (projeto.email) contatos.push(`e-mail: ${projeto.email}`);
  if (projeto.instagram) contatos.push(`Instagram: ${projeto.instagram}`);
  if (projeto.site) contatos.push(`site: ${projeto.site}`);
  if (contatos.length > 0) linhas.push(`\nContato: ${contatos.join(' | ')}`);

  return linhas.join('\n');
}

async function desativarDocumento(documentoId: string): Promise<void> {
  await prisma.documentoKb.update({ where: { id: documentoId }, data: { ativo: false } });
  await prisma.chunkKb.updateMany({ where: { documentoId }, data: { ativo: false } });
}

/**
 * Sincroniza o `DocumentoKb` sintético de um projeto com o estado atual dele
 * no banco. Chame depois de qualquer create/update em `Projeto` (admin,
 * professor, sync SUAP). Idempotente: se o texto gerado não mudou desde a
 * última sincronização, não gasta chamada nenhuma de IA/embedding.
 */
export async function sincronizarProjetoSintetico(projetoId: string): Promise<void> {
  try {
    const projeto = await prisma.projeto.findUnique({
      where: { id: projetoId },
      ...projetoComRelacoes,
    });
    if (!projeto) return;

    const existente = await prisma.documentoKb.findFirst({
      where: { tipo: 'projeto_sintetico', refId: projetoId },
    });

    const devEstarNaBase = projeto.review_status === 'PUBLICADO' && !projeto.deleted_at;

    if (!devEstarNaBase) {
      if (existente?.ativo) {
        await desativarDocumento(existente.id);
        log.info('Documento sintético desativado (projeto não está mais publicado)', { projetoId, documentoId: existente.id });
      }
      return;
    }

    const texto = gerarTextoSintetico(projeto);
    const hash = createHash('sha256').update(texto).digest('hex');

    if (existente && existente.hashArquivo === hash && existente.ativo && existente.status === 'indexed') {
      log.debug('Documento sintético sem mudanças, sincronização ignorada', { projetoId, documentoId: existente.id });
      return; // nada relevante mudou desde a última sincronização
    }

    const docId = existente
      ? (
          await prisma.documentoKb.update({
            where: { id: existente.id },
            data: {
              titulo: projeto.nome,
              hashArquivo: hash,
              ativo: true,
              status: 'extracting',
              erro: null,
              metadata: { source: 'projeto_sintetico', projetoId, projetoSlug: projeto.slug },
            },
          })
        ).id
      : (
          await prisma.documentoKb.create({
            data: {
              titulo: projeto.nome,
              tipo: 'projeto_sintetico',
              refId: projetoId,
              hashArquivo: hash,
              status: 'extracting',
              metadata: { source: 'projeto_sintetico', projetoId, projetoSlug: projeto.slug },
            },
          })
        ).id;

    // Rechunk completo — mais simples e correto do que tentar casar chunk a
    // chunk com a versão anterior quando o texto sintético muda de tamanho.
    await prisma.chunkKb.deleteMany({ where: { documentoId: docId } });

    const chunks = chunkDocument(texto);
    await prisma.chunkKb.createMany({
      data: chunks.map((c, i) => ({
        documentoId: docId,
        chunkIndex: i,
        texto: c.texto,
        secao: c.secao,
        metadata: { chunk_total: chunks.length },
      })),
    });

    await prisma.documentoKb.update({
      where: { id: docId },
      data: { status: 'chunking', totalChunks: chunks.length },
    });

    await curarDocumentoKb(docId);
    await indexarDocumentoKb(docId);

    log.info('Projeto sintético sincronizado', { projetoId, documentoId: docId, totalChunks: chunks.length });
  } catch (err) {
    log.error('Falha ao sincronizar projeto sintético', {
      projetoId,
      erro: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Remove o documento sintético de um projeto — chame quando o projeto for excluído de vez. */
export async function removerProjetoSintetico(projetoId: string): Promise<void> {
  await prisma.documentoKb
    .deleteMany({ where: { tipo: 'projeto_sintetico', refId: projetoId } })
    .catch((err) =>
      log.error('Falha ao remover documento do projeto', {
        projetoId,
        erro: err instanceof Error ? err.message : String(err),
      })
    );
}
