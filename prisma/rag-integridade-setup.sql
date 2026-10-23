-- Migração aditiva. Não executa db push nem altera a coluna/índice pgvector.
-- Fazer backup e verificar duplicatas antes de aplicar em outro ambiente.
CREATE UNIQUE INDEX IF NOT EXISTS documentos_kb_versao_atual_unica
ON documentos_kb (ref_id)
WHERE ativo = true AND ref_id IS NOT NULL
  AND (ref_id LIKE 'kb:%' OR tipo = 'projeto_sintetico');

CREATE INDEX IF NOT EXISTS chunks_kb_embedding_signature_idx
ON chunks_kb ((metadata->>'embedding_signature')) WHERE ativo = true;

CREATE UNIQUE INDEX IF NOT EXISTS documentos_kb_ifpr_versao_atual_unica
ON documentos_kb (ref_id) WHERE ativo = true AND ref_id LIKE 'ifpr-md:%';
