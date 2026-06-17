# ROADMAP — Portal Conecta IFPR

**Status:** Em desenvolvimento conforme SPEC.md + DECISIONS.md  
**Última atualização:** 2026-06-17  
**Deploy:** https://portal-conecta2-0.vercel.app

---

## 📋 FASE 1 — Fundação + MVP Público ✅ (~85%)

**Objetivo:** Modelo de dados completo → home dinâmica → listagem/detalhe de projetos e editais → agenda → inscrição

### ✅ Tarefas concluídas:

- [x] **1.1** Expandir Prisma schema: 27 tabelas, enums limpos
- [x] **1.2** Aprimorar `User` model: campos perfil + SUAP
- [x] **1.3** Aprimorar `Projeto`: review_status, source, deleted_at
- [x] **1.4** Aprimorar `Edital`: pdf_path, review_status, source, deleted_at
- [x] **1.5** Role assignment: `assignUserRole` + `ensureUserProfile` + `requireRole`
- [x] **1.6** Home dinâmica: métricas BD + SiteConfig
- [x] **1.7** Projetos: listagem + filtros + busca + página individual
- [x] **1.8** Editais: listagem + filtros + "A IFizinha Explica"
- [x] **1.9** Página `/projetos/[slug]`: FAQ, tags, cursos, relacionados
- [x] **1.10** Página `/editais/[slug]`: tradução IFizinha + datas
- [x] **1.11** Agenda: timeline + eventos derivados + `.ics`
- [x] **1.12** Inscrição: formulário LGPD + protocolo + validações
- [x] **1.13** AI translation: DeepSeek API + botão "Gerar com IA"
- [x] **1.14** Painel admin/professor unificado em `/admin`

### ⚠️ Pendências:

- [ ] **1.15** Filtros avançados: busca textual, paginação
- [ ] **1.16** Testes: critérios de aceite §14
- [ ] **1.17** View `public_metrics` para performance

---

## 📋 FASE 2 — Gestão de Professores ✅ (~60%)

**Objetivo:** Login professor → painel → edição projetos → inscrições → relatórios

### ✅ Tarefas concluídas:

- [x] **2.1** Login Google com detecção `@ifpr.edu.br`
- [x] **2.2** Dashboard professor com stats
- [x] **2.3** Edição de projetos pelo professor
- [x] **2.4** Listagem de inscrições com filtros
- [x] **2.5** Alteração de status de inscrições
- [x] **2.6** Export CSV de inscrições
- [x] **2.7** Relatórios com estatísticas

### ⚠️ Pendências:

- [ ] **2.8** Confirmação por e-mail pós-inscrição
- [ ] **2.9** "Meus dados" para estudantes
- [ ] **2.10** Edição controlada (campos SUAP bloqueados)

---

## 📋 FASE 3 — IA de Extração (~20%)

**Objetivo:** Upload PDF → extração IA → revisão → publicação

### ✅ Concluído:

- [x] **3.1** API DeepSeek configurada e funcional
- [x] **3.2** Botão "Gerar com IA" no admin editais
- [x] **3.3** Tabela `IaRevisao` criada

### ❌ Pendente:

- [ ] **3.4** Upload de PDF para Storage
- [ ] **3.5** Extração de campos do PDF
- [ ] **3.6** Tela de revisão por campo
- [ ] **3.7** Publicação após aprovação

**ETA:** Agosto 2026

---

## 📋 FASE 4 — IFizinha RAG (~10%)

**Objetivo:** Ingestão → embeddings → busca vetorial → chat com citações

### ✅ Concluído:

- [x] **4.1** Tabelas `RagDocumento`, `RagChunk`, `ChatSessao`, `ChatMensagem`

### ❌ Pendente:

- [ ] **4.2** Migrar `embedding` para pgvector
- [ ] **4.3** Ingestão de documentos publicados
- [ ] **4.4** Geração de embeddings
- [ ] **4.5** Busca vetorial com filtro de permissão
- [ ] **4.6** Chat com citações e guardrails

**ETA:** Setembro 2026

---

## 📋 FASE 5 — Integração SUAP (~30%)

**Objetivo:** Sync idempotente → criação professores → proteção edição manual

### ✅ Concluído:

- [x] **5.1** Cliente SUAP desacoplado
- [x] **5.2** Sync manual via API
- [x] **5.3** Criação de professores por domínio

### ❌ Pendente:

- [ ] **5.4** Sync agendada (cron)
- [ ] **5.5** Proteção de edição manual
- [ ] **5.6** Tratamento de conflitos

**ETA:** Outubro 2026

---

## 📋 FASE 6 — Portal Completo (~5%)

**Objetivo:** Notificações → favoritos → alertas → relatórios avançados

### ✅ Concluído:

- [x] **6.1** Tabelas `AlertaInteresse`, `Favorito`, `Notificacao`

### ❌ Pendente:

- [ ] **6.2** UI de notificações
- [ ] **6.3** UI de favoritos
- [ ] **6.4** UI de alertas
- [ ] **6.5** "Meus dados" para estudantes
- [ ] **6.6** Busca global
- [ ] **6.7** Relatórios avançados com gráficos

**ETA:** Novembro-Dezembro 2026

---

## 📊 STATUS GERAL

| Fase | Completude | Status |
|---|---|---|
| **1** | 85% | ✅ MVP funcional |
| **2** | 60% | ✅ Professor pode gerenciar |
| **3** | 20% | ⚠️ API pronta; falta UI |
| **4** | 10% | ⚠️ Modelos prontos; falta lógica |
| **5** | 30% | ⚠️ Sync manual; falta agendada |
| **6** | 5% | ⚠️ Tabelas prontas; falta UI |

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

### Imediato:
1. Testes automatizados (§14)
2. Confirmação por e-mail

### Curto prazo:
3. Upload PDF + extração IA
4. Revisão humana
5. Sync SUAP agendada

### Médio prazo:
6. pgvector + RAG
7. Notificações
8. "Meus dados"

---

**Próximo:** Testes + confirmação e-mail + upload PDF
