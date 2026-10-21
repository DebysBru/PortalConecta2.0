-- ==============================================================================
-- PORTAL CONECTA 2.0 — ANEXOS E IMAGENS NOS POSTS (limite de 20 MB por post)
-- ==============================================================================
--
-- Adiciona `Post.anexos`: lista dos arquivos anexados (PDF, ZIP, RAR) guardados
-- no storage local da VPS, no formato:
--
--   [{"path":"outros/2026/10/<uuid>.zip","url":"/files/outros/2026/10/<uuid>.zip",
--     "nome":"material.zip","bytes":5242880,"mime":"application/zip"}]
--
-- As imagens inseridas NO TEXTO do post não precisam de coluna nova: elas são
-- <img src="/files/..."> dentro de `conteudo` (que já existe). O peso do post é a
-- soma das duas coisas, conferida no servidor ao salvar (src/lib/file-storage.ts
-- › pesoDasMidiasDoPost e src/lib/post-midias.ts).
--
-- COMO APLICAR (banco local em 127.0.0.1:5433; em produção, no VPS):
--   psql "$DATABASE_URL" -f prisma/post-anexos-setup.sql
--
-- ⚠️ NÃO use `prisma db push` neste banco (ver DOCUMENTACAO/MIGRACAO_POSTGRES_LOCAL.md):
-- ele apagaria `Edital.projetoId` (com dados) e o índice HNSW do pgvector. O
-- banco é a fonte de verdade do modelo; o schema.prisma só gera o client tipado.
--
-- O script é IDEMPOTENTE: pode rodar quantas vezes quiser.
-- ==============================================================================

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "anexos" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Posts antigos (e qualquer linha criada antes desta migração) ficam com lista
-- vazia, que é o valor esperado: nenhum deles tem anexo para mostrar.
UPDATE "Post" SET "anexos" = '[]'::jsonb WHERE "anexos" IS NULL;
