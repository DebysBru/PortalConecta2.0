-- ==============================================================================
-- PORTAL CONECTA 2.0 — TABELAS DO RAG (documentos_kb / chunks_kb)
-- ==============================================================================
--
-- Cria as duas tabelas da base de conhecimento de forma IDEMPOTENTE, SEM a
-- coluna vetorial. Serve para os dois ambientes:
--
--   VPS (produção)   psql "$DATABASE_URL" -f prisma/rag-tabelas-setup.sql
--                    psql "$DATABASE_URL" -f prisma/pgvector-setup.sql   ← cria a coluna vector
--                    psql "$DATABASE_URL" -f prisma/busca-textual-setup.sql
--
--   Windows (dev)    psql "$DATABASE_URL" -f prisma/rag-tabelas-setup.sql
--                    psql "$DATABASE_URL" -f prisma/busca-textual-setup.sql
--                    (sem pgvector: a extensão não existe no Postgres do Windows
--                     e instalá-la exige administrador)
--
-- Por que NÃO usar `prisma db push` em vez disto: o banco deste projeto tem
-- objetos que o schema.prisma não declara (a coluna `Edital.projetoId` com dados
-- e o índice HNSW do pgvector). O `db push` apaga o que não conhece — está
-- documentado no LEIAME e no runbook da migração. Além disso o próprio schema
-- declara `embedding Unsupported("vector(1536)")`, o que faz o `db push` falhar
-- em qualquer banco sem a extensão `vector` instalada.
--
-- A coluna `embedding` é criada depois por pgvector-setup.sql (bloco `DO` com
-- `IF NOT EXISTS`), então rodar este arquivo num banco que já tem pgvector não
-- mexe em nada.
--
-- Como aplicar:
--   psql "$DATABASE_URL" -f prisma/rag-tabelas-setup.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "documentos_kb" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ref_id" TEXT,
    "storage_path" TEXT,
    "hash_arquivo" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'indexed',
    "processado_em" TIMESTAMP(3),
    "total_paginas" INTEGER,
    "total_chunks" INTEGER NOT NULL DEFAULT 0,
    "modelo_embedding" TEXT NOT NULL DEFAULT 'gemini-embedding-2',
    "embedding_dimensions" INTEGER NOT NULL DEFAULT 1536,
    "erro" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "documentos_kb_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chunks_kb" (
    "id" TEXT NOT NULL,
    "documento_id" TEXT NOT NULL,
    "documento_versao" INTEGER NOT NULL DEFAULT 1,
    "chunk_index" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "pagina_inicial" INTEGER,
    "pagina_final" INTEGER,
    "secao" TEXT,
    "categoria" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chunks_kb_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "documentos_kb_tipo_idx" ON "documentos_kb"("tipo");
CREATE INDEX IF NOT EXISTS "documentos_kb_ref_id_idx" ON "documentos_kb"("ref_id");
CREATE INDEX IF NOT EXISTS "documentos_kb_hash_arquivo_idx" ON "documentos_kb"("hash_arquivo");
CREATE INDEX IF NOT EXISTS "documentos_kb_ativo_idx" ON "documentos_kb"("ativo");
CREATE INDEX IF NOT EXISTS "chunks_kb_documento_id_idx" ON "chunks_kb"("documento_id");
CREATE INDEX IF NOT EXISTS "chunks_kb_categoria_idx" ON "chunks_kb"("categoria");
CREATE INDEX IF NOT EXISTS "chunks_kb_ativo_idx" ON "chunks_kb"("ativo");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chunks_kb_documento_id_fkey'
  ) THEN
    ALTER TABLE "chunks_kb"
      ADD CONSTRAINT "chunks_kb_documento_id_fkey"
      FOREIGN KEY ("documento_id") REFERENCES "documentos_kb"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
