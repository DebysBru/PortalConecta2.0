-- ==============================================================================
-- PORTAL CONECTA 2.0 — EQUIPE DE ESTUDANTES E FINANCIAMENTO DO PROJETO
-- ==============================================================================
--
-- Adiciona à tabela `Projeto` os três campos que a página pública passa a
-- mostrar ao lado do resumo:
--
--   estudantesBolsistas    TEXT[]  nomes dos bolsistas que atuam no projeto
--   estudantesVoluntarios  TEXT[]  nomes dos voluntários que atuam no projeto
--   financiamento          TEXT[]  fontes financiadoras ("IFPR", "CNPq",
--                                  "Fundação Araucária", "Emenda Parlamentar"...)
--
-- Por que: a sugestão recebida foi que, junto ao resumo do projeto, apareçam
-- os estudantes bolsistas e voluntários — ver gente já atuando motiva os demais
-- a se inscrever — e de onde vem o financiamento. O campo antigo `alunos` era
-- um texto livre sem papel (e nunca era exibido), então não dava para separar
-- bolsista de voluntário nem exibir como lista.
--
-- COMO APLICAR (banco local em 127.0.0.1:5433; em produção, no VPS):
--   psql "$DATABASE_URL" -f prisma/equipe-financiamento-setup.sql
--   (ou: npx prisma db execute --file prisma/equipe-financiamento-setup.sql --schema prisma/schema.prisma)
--
-- ⚠️ NÃO use `prisma db push` neste banco (ver DOCUMENTACAO/MIGRACAO_POSTGRES_LOCAL.md).
-- O script é IDEMPOTENTE: pode rodar quantas vezes quiser.
-- ==============================================================================

ALTER TABLE "Projeto"
  ADD COLUMN IF NOT EXISTS "estudantesBolsistas"   TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "estudantesVoluntarios" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "financiamento"         TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Consequência: projeto que já existia fica com listas vazias (nada é exibido
-- na página pública até a coordenação cadastrar a equipe/o financiamento).
