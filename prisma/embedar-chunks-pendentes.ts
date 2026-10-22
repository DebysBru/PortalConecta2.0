/**
 * ==============================================================================
 * GERA OS EMBEDDINGS FALTANTES DOS CHUNKS (JOB RETOMÁVEL)
 * ==============================================================================
 *
 * Por que existe separado da importação:
 *
 * A importação do corpus (`importar-markdown-ifpr.ts`) cria 3 mil documentos e
 * ~31 mil trechos. Se ela tentasse embeddar tudo de uma vez, esbarraria no
 * limite de uso do Gemini (o tier gratuito limita requisições e tokens por
 * minuto) e cada documento viraria uma chamada — 3 mil chamadas para 31 mil
 * trechos, o pior desperdício possível.
 *
 * Este job faz o caminho inverso: varre os chunks que estão SEM vetor (em
 * lotes de 64, independente do documento), embedda, grava e dorme um pouco
 * antes do próximo lote. Assim ele:
 *
 *   - gasta o mínimo de requisições (31 mil trechos ≈ 500 lotes);
 *   - respeita o limite por minuto (a pausa é ajustável);
 *   - é RETOMÁVEL: se parar no meio (queda, 429, reboot), a próxima execução
 *     continua de onde parou, porque só olha para `embedding IS NULL`;
 *   - pode rodar em segundo plano por horas sem atrapalhar o site.
 *
 * Enquanto não termina, o chat continua funcionando: a busca textual
 * (prisma/busca-textual-setup.sql) responde pelos trechos sem vetor.
 *
 * Uso:
 *   npm run rag:embedar
 *   npm run rag:embedar -- --lote=32 --pausa=2000
 *   npm run rag:embedar -- --limite=5000      # processa até 5 mil trechos
 *
 * Variáveis: RAG_LOTE (padrão 64), RAG_PAUSA (padrão 1500 ms), RAG_LIMITE.
 * ==============================================================================
 */

import './_env';

import { PrismaClient } from '@prisma/client';
import { generateBatchEmbeddings, validateEmbedding } from '@/lib/embeddings';
import { saveChunksWithEmbeddings } from '@/lib/busca-vetorial';

interface ChunkPendente {
  id: string;
  documento_id: string;
  documento_versao: number;
  chunk_index: number;
  texto: string;
  secao: string | null;
  categoria: string | null;
  pagina_inicial: number | null;
  pagina_final: number | null;
  metadata: Record<string, unknown>;
}

function lerNumeroDaFlag(nome: string, padrao: number, env: string): number {
  const args = process.argv.slice(2);
  const comIgual = args.find((a) => a.startsWith(`--${nome}=`));
  const bruto = comIgual ? comIgual.split('=')[1] : process.env[env] ?? null;
  const valor = bruto ? Number(bruto) : NaN;
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

const lote = Math.min(lerNumeroDaFlag('lote', 100, 'RAG_LOTE'), 100);
const pausaMs = lerNumeroDaFlag('pausa', 1500, 'RAG_PAUSA');
const limite = lerNumeroDaFlag('limite', Number.POSITIVE_INFINITY, 'RAG_LIMITE');
/**
 * Teto de trechos por minuto.
 *
 * O tier gratuito do Gemini limita `embed_content_free_tier_requests` a **100
 * por minuto**, e CADA TRECHO do lote conta como uma requisição (medido: um
 * lote de 64 passa, o segundo lote seguido já recebe 429). Ou seja: o teto real
 * é 100 trechos/minuto, o que dá ~5 h para os 31 mil trechos do campus.
 *
 * Por isso o job envia lotes de 100 e espera o resto do minuto. Sem esse
 * controle ele bateria 429 o tempo todo, gastaria as 5 tentativas e marcaria
 * lotes como falha sem necessidade.
 *
 * Quem tiver chave paga (limite bem maior) pode subir: RAG_RPM=1000.
 */
const rpm = lerNumeroDaFlag('rpm', 95, 'RAG_RPM');

async function main(): Promise<void> {
  const chave = process.env.GEMINI_API_KEY?.trim();
  if (!chave) {
    console.error('\nERRO: GEMINI_API_KEY não configurada — sem ela não há como gerar vetores.');
    console.error('Defina a chave no .env e rode de novo.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const inicio = Date.now();
  let processados = 0;
  let falhas = 0;

  try {
    const [pendentes] = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT count(*)::int AS total FROM "chunks_kb" c
       JOIN "documentos_kb" d ON d.id = c."documento_id"
       WHERE c."ativo" = true AND d."ativo" = true AND c."embedding" IS NULL`
    );
    const totalPendente = pendentes?.total ?? 0;

    console.log('\n=== Geração de embeddings pendentes ===\n');
    console.log(`Pendentes: ${totalPendente.toLocaleString('pt-BR')} trechos`);
    console.log(`Lote: ${lote} · pausa: ${pausaMs} ms · limite desta execução: ${limite === Infinity ? 'sem limite' : limite.toLocaleString('pt-BR')}\n`);

    if (totalPendente === 0) {
      console.log('Nada a fazer: todos os trechos ativos já têm vetor.');
      return;
    }

    const alvo = Math.min(totalPendente, limite);

    while (processados < alvo) {
      const tamanho = Math.min(lote, alvo - processados);

      const chunks = await prisma.$queryRawUnsafe<ChunkPendente[]>(
        `SELECT c."id", c."documento_id", c."documento_versao", c."chunk_index",
                c."texto", c."secao", c."categoria", c."pagina_inicial", c."pagina_final",
                c."metadata"
         FROM "chunks_kb" c
         JOIN "documentos_kb" d ON d.id = c."documento_id"
         WHERE c."ativo" = true AND d."ativo" = true AND c."embedding" IS NULL
         ORDER BY c."documento_id", c."chunk_index"
         LIMIT $1`,
        tamanho
      );

      if (chunks.length === 0) break;

      try {
        // Mesma composição usada pelo indexador: a seção entra junto porque
        // "Carga horária: ..." é mais informativo para a busca que o texto solto.
        const textos = chunks.map((chunk) =>
          chunk.secao ? `${chunk.secao}: ${chunk.texto}` : chunk.texto
        );

        const tokensDoLote = textos.reduce((soma, texto) => soma + Math.ceil(texto.length / 4), 0);
        const inicioDoLote = Date.now();

        const vetores = await generateBatchEmbeddings(textos, { apiKey: chave });
        vetores.forEach((vetor) => validateEmbedding(vetor));

        await saveChunksWithEmbeddings(
          chunks.map((chunk, indice) => ({
            id: chunk.id,
            documentoId: chunk.documento_id,
            documentoVersao: chunk.documento_versao,
            chunkIndex: chunk.chunk_index,
            texto: chunk.texto,
            secao: chunk.secao,
            categoria: chunk.categoria,
            paginaInicial: chunk.pagina_inicial,
            paginaFinal: chunk.pagina_final,
            metadata: chunk.metadata ?? {},
            ativo: true,
            embedding: vetores[indice],
          })),
          prisma
        );

        processados += chunks.length;

        const decorrido = (Date.now() - inicio) / 1000;
        const porSegundo = processados / Math.max(decorrido, 1);
        const restantes = alvo - processados;
        const etaMin = porSegundo > 0 ? Math.round(restantes / porSegundo / 60) : 0;

        console.log(
          `[${processados.toLocaleString('pt-BR')}/${alvo.toLocaleString('pt-BR')}] ` +
            `${tokensDoLote.toLocaleString('pt-BR')} tokens em ${((Date.now() - inicioDoLote) / 1000).toFixed(0)}s · ` +
            `${porSegundo.toFixed(1)} trechos/s · faltam ~${etaMin} min`
        );

        // Vazão controlada: N trechos consomem N/RPM minutos da cota (cada
        // trecho conta como uma requisição). Esperar o resto do minuto mantém o
        // job abaixo do teto, em vez de viver de 429.
        const esperaDaCota = Math.ceil((chunks.length / rpm) * 60_000) - (Date.now() - inicioDoLote);
        await new Promise((r) => setTimeout(r, Math.max(pausaMs, esperaDaCota)));
        continue;
      } catch (erro) {
        falhas += chunks.length;
        const mensagem = erro instanceof Error ? erro.message : String(erro);
        console.error(`Falha no lote de ${chunks.length} trechos: ${mensagem.slice(0, 200)}`);

        // Deixa a cota do provedor respirar antes de tentar o próximo lote.
        // O lote que falhou continua pendente e será retomado na próxima rodada.
        await new Promise((r) => setTimeout(r, Math.max(pausaMs, 20_000)));
        continue;
      }
    }

    const segundos = ((Date.now() - inicio) / 1000).toFixed(0);
    console.log('\n=== Resumo ===');
    console.log(`Trechos com vetor gerado: ${processados.toLocaleString('pt-BR')}`);
    console.log(`Trechos que falharam:     ${falhas.toLocaleString('pt-BR')}`);
    console.log(`Tempo:                    ${segundos}s`);

    const [resta] = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT count(*)::int AS total FROM "chunks_kb" c
       JOIN "documentos_kb" d ON d.id = c."documento_id"
       WHERE c."ativo" = true AND d."ativo" = true AND c."embedding" IS NULL`
    );

    console.log(`Ainda pendentes:          ${(resta?.total ?? 0).toLocaleString('pt-BR')}`);
    if ((resta?.total ?? 0) > 0) {
      console.log('Rode `npm run rag:embedar` de novo para continuar de onde parou.');
    } else {
      console.log('Base completa: todos os trechos ativos têm vetor.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error('\nFalha na geração de embeddings:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
