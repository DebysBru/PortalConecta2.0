-- ==============================================================================
-- PORTAL CONECTA 2.0 — DATAS "SÓ DIA" NO FUSO CERTO
-- ==============================================================================
--
-- CONTEXTO (bug visto em produção em 05/10/2026): campos de `<input type="date">`
-- eram gravados com `new Date("AAAA-MM-DD")`, ou seja, MEIA-NOITE UTC. Como a VPS
-- roda em America/Chicago, a data aparecia um dia ANTES do que a coordenação
-- digitou ("encerra em 10/10" virava 09/10 na tela) e o prazo terminava no meio da
-- tarde do dia anterior.
--
-- A partir de agora o código grava essas datas ao MEIO-DIA UTC
-- (src/lib/datas.ts › parseDataDoFormulario). Este script normaliza o que já
-- estava gravado à meia-noite, somando 12 horas.
--
-- É IDEMPOTENTE por construção: depois de rodar, a hora é 12:00 e a condição
-- `::time = '00:00:00'` deixa de casar. Rodar de novo não muda nada.
--
-- ⚠️ Só toca em colunas que vêm de `<input type="date">`. `vagas.data_abertura`,
-- `created_at` e afins são INSTANTES reais ("agora") e ficam como estão.
--
-- COMO APLICAR:
--   psql "$DATABASE_URL" -f prisma/datas-fuso-setup.sql

-- 1) Editais — prazos e datas de calendário.
UPDATE "Edital" SET "dataEncerramento"     = "dataEncerramento"     + interval '12 hours' WHERE "dataEncerramento"     IS NOT NULL AND "dataEncerramento"::time     = '00:00:00';
UPDATE "Edital" SET "dataInicio"           = "dataInicio"           + interval '12 hours' WHERE "dataInicio"           IS NOT NULL AND "dataInicio"::time           = '00:00:00';
UPDATE "Edital" SET "dataPublicacao"       = "dataPublicacao"       + interval '12 hours' WHERE "dataPublicacao"       IS NOT NULL AND "dataPublicacao"::time       = '00:00:00';
UPDATE "Edital" SET "dataResultado"        = "dataResultado"        + interval '12 hours' WHERE "dataResultado"        IS NOT NULL AND "dataResultado"::time        = '00:00:00';
UPDATE "Edital" SET "dataResultadoParcial" = "dataResultadoParcial" + interval '12 hours' WHERE "dataResultadoParcial" IS NOT NULL AND "dataResultadoParcial"::time = '00:00:00';
UPDATE "Edital" SET "prazoRecurso"         = "prazoRecurso"         + interval '12 hours' WHERE "prazoRecurso"         IS NOT NULL AND "prazoRecurso"::time         = '00:00:00';
UPDATE "Edital" SET "dataResultadoFinal"   = "dataResultadoFinal"   + interval '12 hours' WHERE "dataResultadoFinal"   IS NOT NULL AND "dataResultadoFinal"::time   = '00:00:00';

-- 2) Projetos — janela de inscrição e datas do projeto.
UPDATE "Projeto" SET "inscricao_inicio" = "inscricao_inicio" + interval '12 hours' WHERE "inscricao_inicio" IS NOT NULL AND "inscricao_inicio"::time = '00:00:00';
UPDATE "Projeto" SET "inscricao_fim"    = "inscricao_fim"    + interval '12 hours' WHERE "inscricao_fim"    IS NOT NULL AND "inscricao_fim"::time    = '00:00:00';
UPDATE "Projeto" SET "dataInicio"       = "dataInicio"       + interval '12 hours' WHERE "dataInicio"       IS NOT NULL AND "dataInicio"::time       = '00:00:00';
UPDATE "Projeto" SET "dataConclusao"    = "dataConclusao"    + interval '12 hours' WHERE "dataConclusao"    IS NOT NULL AND "dataConclusao"::time    = '00:00:00';

-- 3) Vagas — prazo de encerramento (a abertura é instante real, não entra).
UPDATE vagas SET data_encerramento = data_encerramento + interval '12 hours' WHERE data_encerramento IS NOT NULL AND data_encerramento::time = '00:00:00';

-- 4) Eventos — data e data de término (o formulário do admin usa type="date").
UPDATE "Evento" SET "data"    = "data"    + interval '12 hours' WHERE "data"    IS NOT NULL AND "data"::time    = '00:00:00';
UPDATE "Evento" SET "dataFim" = "dataFim" + interval '12 hours' WHERE "dataFim" IS NOT NULL AND "dataFim"::time = '00:00:00';
