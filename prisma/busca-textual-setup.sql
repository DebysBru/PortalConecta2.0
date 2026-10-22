-- ==============================================================================
-- PORTAL CONECTA 2.0 — BUSCA TEXTUAL (REDE DE SEGURANÇA DO PGVECTOR)
-- ==============================================================================
--
-- Por que este arquivo existe:
--
-- A busca principal do RAG é vetorial (pgvector + `match_chunks_kb`). Só que ela
-- tem dois modos de falha que já aconteceram de verdade neste projeto:
--
--   1. ambiente sem a extensão `vector` (ex.: Windows de desenvolvimento, onde
--      o pgvector não está instalado) — `match_chunks_kb` e a coluna
--      `embedding` simplesmente não existem;
--   2. ambiente com pgvector, mas com chunks SEM embedding (importação feita
--      sem `GEMINI_API_KEY`) — a busca vetorial devolve zero linhas.
--
-- Sem esta camada, `searchSimilarChunks` caía num "fallback" que retornava
-- 50 chunks arbitrários com `similarity: 0.5` fixo. O chat continuava
-- respondendo — com o documento errado — e era impossível perceber olhando a
-- resposta. Isto aqui substitui aquele fallback por busca textual de verdade.
--
-- É idempotente: pode rodar quantas vezes quiser.
-- NÃO depende de nenhuma extensão (só de `to_tsvector`, que é nativa).
--
-- Como aplicar:
--   psql "$DATABASE_URL" -f prisma/busca-textual-setup.sql
-- ==============================================================================

-- 1) Normalização de acentos.
--    O dicionário 'portuguese' do Postgres NÃO remove acento: 'transferencia'
--    não casa com 'transferência'. Como o estudante digita das duas formas no
--    celular, normalizamos os dois lados da busca com a mesma função.
--    Precisa ser IMMUTABLE para poder entrar no índice de expressão abaixo.
CREATE OR REPLACE FUNCTION normalizar_busca(texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT translate(
    lower(texto),
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );
$$;

-- 2) Índice de texto completo (GIN) sobre o texto normalizado.
--    Sem ele, cada pergunta faria um full scan nos ~15 mil chunks. Com ele, a
--    busca textual responde em poucos milissegundos.
CREATE INDEX IF NOT EXISTS "chunks_kb_busca_textual_idx"
ON "chunks_kb"
USING gin (to_tsvector('portuguese', normalizar_busca("texto")));

-- 3) Nada de extensão extra aqui de propósito.
--
--    O "plano B do plano B" — pergunta formada só por palavras que o dicionário
--    descarta como stopword (ex.: "quais os") — usa `LIKE '%...%'` sobre
--    `normalizar_busca(texto)`, que NÃO tem índice possível (o curinga no
--    início impede o uso de B-tree, e o índice trigram exigiria `pg_trgm`).
--    É um full scan de ~15 mil chunks: medido em ~60 ms, e só acontece quando
--    a busca por texto completo não retorna nada. Trocar essa raridade por mais
--    uma extensão a instalar em cada ambiente seria pior.
