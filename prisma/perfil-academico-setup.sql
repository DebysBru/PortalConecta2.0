-- ==============================================================================
-- PORTAL CONECTA 2.0 — PERFIL ACADÊMICO DO ESTUDANTE E RESPOSTA A CONVOCAÇÃO
-- ==============================================================================
--
-- Adiciona as colunas usadas por:
--   * "Meu Perfil"  → curso (catálogo), ano de ingresso, semestre do curso;
--   * "Suas Inscrições" → resposta do aluno a uma convocação e desistência.
--
-- COMO APLICAR (o banco local fica em 127.0.0.1:5433; em produção, no VPS):
--   psql "$DATABASE_URL" -f prisma/perfil-academico-setup.sql
--
-- ⚠️ NÃO use `prisma db push` neste banco (ver DOCUMENTACAO/MIGRACAO_POSTGRES_LOCAL.md):
-- ele apagaria `Edital.projetoId` (com dados) e o índice HNSW do pgvector. O
-- banco é a fonte de verdade do modelo; o schema.prisma só gera o client tipado.
--
-- O script é IDEMPOTENTE: pode rodar quantas vezes quiser.
-- ==============================================================================

-- 1. Perfil do aluno: ano de ingresso e semestre do curso.
--    O semestre é gravado junto com a data em que foi informado, porque é isso
--    que permite o portal avançar o semestre sozinho a cada semestre letivo
--    (cálculo em src/lib/perfil-academico.ts, função `semestreAtual`).
ALTER TABLE "perfis_aluno" ADD COLUMN IF NOT EXISTS "ano_ingresso"        INTEGER;
ALTER TABLE "perfis_aluno" ADD COLUMN IF NOT EXISTS "semestre_atual"      INTEGER;
ALTER TABLE "perfis_aluno" ADD COLUMN IF NOT EXISTS "semestre_referencia" TIMESTAMP(3);

-- 2. Semestre do curso só existe de 1 a 10 (catálogo do campus). A checagem
--    também está na Server Action; aqui é a rede de segurança do banco.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'perfis_aluno_semestre_atual_check'
  ) THEN
    ALTER TABLE "perfis_aluno"
      ADD CONSTRAINT "perfis_aluno_semestre_atual_check"
      CHECK ("semestre_atual" IS NULL OR ("semestre_atual" >= 1 AND "semestre_atual" <= 10));
  END IF;
END $$;

-- 3. Inscrição: resposta do estudante a uma convocação + desistência.
--    `resposta_aluno` é separado de `status` de propósito (ver comentário no
--    schema.prisma): o status segue sendo a decisão do coordenador e alimenta as
--    contagens de vaga/relatórios que já existem.
ALTER TABLE "Inscricao" ADD COLUMN IF NOT EXISTS "resposta_aluno" TEXT;
ALTER TABLE "Inscricao" ADD COLUMN IF NOT EXISTS "respondido_em"  TIMESTAMP(3);
ALTER TABLE "Inscricao" ADD COLUMN IF NOT EXISTS "desistiu_em"    TIMESTAMP(3);

-- 4. Migração de dados (opcional, uma vez): quem já tinha "2024.5" em
--    PerfilAluno.semestre (o formato que o PRÓPRIO portal escreve no formulário
--    de inscrição: ano de ingresso . semestre do curso) ganha ano de ingresso e
--    semestre nas colunas novas, para não precisar redigitar. Mesma precedência
--    do código (src/lib/perfil-academico.ts › fonteDeLegado): a turma vence o ano
--    solto do texto do semestre.
--
--    ⚠️ Só o formato com PONTO entra. As inscrições antigas gravadas como
--    "2026/1" significam ano letivo / semestre do ano — outra coisa — e
--    convertê-las marcaria um aluno do 3º ano como calouro. Essas ficam em branco
--    e o estudante escolhe na lista.
--
--    Só preenche onde `semestre_atual` ainda está vazio: rodar de novo não
--    sobrescreve nada que o estudante já tenha confirmado depois.
UPDATE "perfis_aluno"
SET
  "ano_ingresso" = COALESCE(
    substring("turma" from '(\d{4})')::INTEGER,
    substring("semestre" from '^\s*(\d{4})')::INTEGER
  ),
  "semestre_atual" = substring("semestre" from '^\s*\d{4}\s*\.\s*(\d{1,2})')::INTEGER,
  -- A data de referência é AGORA: é o melhor palpite disponível para "o valor
  -- que estava digitado é o semestre atual". A partir daqui ele avança sozinho.
  "semestre_referencia" = NOW()
WHERE "semestre_atual" IS NULL
  AND "semestre" ~ '^\s*\d{4}\s*\.\s*(10|[1-9])\s*$';

-- 5. Índice de apoio para a área do aluno (busca por user_id já é única em
--    perfis_aluno; este é para a checagem de convocação pendente).
CREATE INDEX IF NOT EXISTS "Inscricao_resposta_aluno_idx" ON "Inscricao" ("resposta_aluno");
