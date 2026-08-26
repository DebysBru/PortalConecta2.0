-- ==============================================================================
-- PORTAL CONECTA 2.0 — INFRAESTRUTURA PGVECTOR E BUSCA VETORIAL
-- ==============================================================================

-- 1. Habilitar a extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Garantir coluna de embedding com dimensão 1536 na tabela chunks_kb
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'chunks_kb' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE "chunks_kb" ADD COLUMN "embedding" vector(1536);
  END IF;
END $$;

-- 3. Criar índice vetorial HNSW para consultas por distância de cosseno de alta performance
CREATE INDEX IF NOT EXISTS "chunks_kb_embedding_hnsw_idx" 
ON "chunks_kb" 
USING hnsw ("embedding" vector_cosine_ops);

-- 4. Função RPC no PostgreSQL para busca semântica por similaridade por cosseno
CREATE OR REPLACE FUNCTION match_chunks_kb(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_categoria text DEFAULT NULL,
  filter_tipo text DEFAULT NULL,
  min_similarity float DEFAULT 0.2
)
RETURNS TABLE (
  id text,
  documento_id text,
  chunk_index int,
  texto text,
  secao text,
  categoria text,
  pagina_inicial int,
  pagina_final int,
  metadata jsonb,
  documento_titulo text,
  documento_tipo text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.documento_id,
    c.chunk_index,
    c.texto,
    c.secao,
    c.categoria,
    c.pagina_inicial,
    c.pagina_final,
    c.metadata,
    d.titulo AS documento_titulo,
    d.tipo AS documento_tipo,
    (1 - (c.embedding <=> query_embedding))::float AS similarity
  FROM chunks_kb c
  JOIN documentos_kb d ON d.id = c.documento_id
  WHERE c.ativo = true
    AND d.ativo = true
    AND c.embedding IS NOT NULL
    AND (filter_categoria IS NULL OR c.categoria = filter_categoria OR (c.metadata->>'categoria') = filter_categoria)
    AND (filter_tipo IS NULL OR d.tipo = filter_tipo)
    AND (1 - (c.embedding <=> query_embedding)) >= min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. RLS — NOTA: este arquivo é mantido só como referência histórica da
-- infra pgvector. O conjunto real de políticas RLS (para as 35 tabelas do
-- banco, não só documentos_kb/chunks_kb) foi aplicado diretamente no projeto
-- Supabase via migração `enable_rls_minimal_public_policies`
-- (ver ANALISE_E_PLANO_RAG.md, Etapa 1). Não reaplique as duas linhas abaixo
-- isoladamente — elas já estão cobertas (com nomes de política diferentes)
-- pela migração real.
ALTER TABLE "documentos_kb" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chunks_kb" ENABLE ROW LEVEL SECURITY;
