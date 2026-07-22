# ORIENTACAO.md — Guia de Andamento do Projeto

**Última atualização:** 2026-06-17 (Atualizado)  
**Status geral:** Fase 1 completa (~90%) + Fase 2 parcial (~70%) — Chat IFizinha com RAG funcional

---

## 📚 ARQUIVOS DE DOCUMENTAÇÃO — Ordem de Leitura

1. **SPEC.md** — Especificação técnica completa (fonte da verdade)
2. **DECISIONS.md** — Decisões arquiteturais (Prisma/Firebase vs Supabase)
3. **AUDIT.md** — Estado atual do projeto
4. **ROADMAP.md** — Plano de 6 fases
5. **ORIENTACAO.md** — Este arquivo (checklist de status)

---

## ✅ STATUS ATUAL — O QUE FOI IMPLEMENTADO

### Fase 1 — Fundação + MVP Público (~90%)

| Item | Status | Detalhes |
|---|---|---|
| Schema Prisma | ✅ | 27 tabelas, todos os enums limpos |
| Auth helpers | ✅ | `assignUserRole`, `ensureUserProfile`, `requireRole`, `requireProjectCoordinator` |
| Home dinâmica | ✅ | Métricas do BD, SiteConfig, editais/destaque, projetos, agenda |
| Projetos | ✅ | Listagem com filtros, busca, página individual com FAQ/tags/cursos/relacionados |
| Editais | ✅ | Listagem com filtros, página individual com "A IFizinha Explica" |
| Agenda | ✅ | Timeline por mês, eventos derivados, exportação `.ics` |
| Event derivation | ✅ | Auto-criar eventos ao publicar/editar edital ou projeto |
| AI translation | ✅ | Botão "Gerar com IA" com DeepSeek |
| Inscrição | ✅ | Formulário com selects/radios/checkboxes, LGPD, protocolo |
| Tags com IA | ✅ | `sugerirTags` funcional |
| Painel admin/professor | ✅ | Unificado em `/admin` com navegação por role |

### Fase 2 — Gestão de Professores (~70%)

| Item | Status | Detalhes |
|---|---|---|
| Login professor | ✅ | Google OAuth, detecção `@ifpr.edu.br` |
| Dashboard professor | ✅ | Stats dos seus projetos |
| Edição de projetos | ✅ | Professor edita seus projetos |
| Inscrições | ✅ | Listagem, filtros, alteração de status, export CSV |
| Relatórios | ✅ | Estatísticas, busca, filtros por status |

### Chat IFizinha (RAG)

| Item | Status | Detalhes |
|---|---|---|
| Widget flutuante | ✅ | Em todas as páginas |
| Busca por projetos | ✅ | Nome, área, tags, coordenador, tipo |
| Busca por editais | ✅ | Título, resumo, categoria |
| Cache local | ✅ | 5 min TTL |
| Detecção de intenção | ✅ | Projeto/Edital/Ambos |
| Formatação markdown | ✅ | Negrito, listas, tabelas |
| Resumo do portal | ✅ | Totais de projetos/editais |

---

## ❌ O QUE FALTA IMPLEMENTAR

### Fase 1 — Pendências

| Item | Prioridade | Descrição |
|---|---|---|
| Testes | Média | Critérios de aceite §14 |
| Confirmação e-mail | Alta | Pós-inscrição (Resend/SendGrid) |
| Upload PDF | Baixa | Storage para PDFs de editais |

### Fase 3 — IA de Extração (não iniciada)

| Item | Prioridade | Descrição |
|---|---|---|
| Upload PDF | Alta | Admin envia PDF do edital |
| Extração IA | Alta | DeepSeek extrai campos estruturados |
| Revisão humana | Alta | Tela de revisão por campo com confiança |
| Publicação | Alta | Só após aprovação → `review_status='publicado'` |

### Fase 4 — IFizinha RAG (parcial)

| Item | Prioridade | Descrição |
|---|---|---|
| pgvector | Alta | Migrar `embedding` de `String?` para extensão `vector` |
| Ingestão | Alta | Documentos publicados → `rag_documentos` |
| Embeddings | Alta | Chunking + geração de embeddings |
| Busca vetorial | Alta | `rag-query` com filtro de permissão |
| Chat com citações | ✅ | IFizinha responde com fontes |

### Fase 5 — Integração SUAP (parcial)

| Item | Prioridade | Descrição |
|---|---|---|
| Sync agendada | Média | Cron job para sync automática |
| Proteção edição manual | Média | Não sobrescrever campos editados |
| Conflitos | Média | Registrar e exigir decisão do admin |

### Fase 6 — Portal Completo (parcial)

| Item | Prioridade | Descrição |
|---|---|---|
| Notificações | Média | Push/email para prazos próximos |
| Favoritos | Baixa | Estudante favorita editais/projetos |
| Alertas | Baixa | Interesse por categoria |
| "Meus dados" | ✅ | Página implementada |
| Busca global | Baixa | Full-text search |

---

## 🎯 SUGESTÕES DE MELHORIA

### 1. **Confirmação por e-mail** (Alta prioridade)
- Enviar email de confirmação pós-inscrição
- Usar Resend ou SendGrid

### 2. **Notificações automáticas** (Alta)
- Enviar email/WhatsApp quando inscrições estão quase encerrando
- Lembrete 3 dias antes do prazo final
- Notificar professor quando nova inscrição é recebida

### 3. **Dashboard admin avançado** (Média)
- Gráficos de inscrições por período
- Taxa de aprovação/reprovação
- Projetos mais populares
- Editais mais acessados

### 4. **Upload PDF** (Média)
- Storage para upload de editais
- Extração automática com IA
- Revisão humana por campo

### 5. **pgvector + RAG completo** (Média)
- Migrar embeddings para extensão nativa
- Ingestão automática de documentos
- Busca vetorial com filtro de permissão

### 6. **Notificações** (Média)
- Email para prazos próximos
- Push para estudantes interessados
- WhatsApp (opt-in)

### 7. **Relatórios avançados** (Baixa)
- Gráficos de inscrições
- Export PDF
- Relatório consolidado

---

## 📊 CHECKLIST DE STATUS

| Item | Status | Próximo |
|---|---|---|
| Schema Prisma | ✅ | — |
| Enums limpos | ✅ | — |
| Auth + Role assignment | ✅ | — |
| Home dinâmica | ✅ | — |
| Projetos (BD) | ✅ | Tags com IA |
| Editais (BD) | ✅ | Upload PDF |
| Agenda + .ics | ✅ | — |
| AI translation | ✅ | — |
| Tags com IA | ✅ | — |
| Inscrição + LGPD | ✅ | Confirmação e-mail |
| Chat IFizinha | ✅ | pgvector |
| Painel admin/professor | ✅ | — |
| "Meus dados" | ✅ | — |
| Testes | ❌ | Critérios §14 |
| Upload PDF | ❌ | Fase 3 |
| RAG completo | ⚠️ | pgvector + ingestão |
| SUAP sync | ⚠️ | Sync agendada |
| Notificações | ❌ | Fase 6 |

---

## 📈 EVOLUÇÃO RECENTE

| Data | Funcionalidade |
|---|---|
| 2026-06-17 | Chat IFizinha com RAG, cache, markdown |
| 2026-06-17 | Formulário inscrição com selects/radios/checkboxes |
| 2026-06-17 | Tags com IA (`sugerirTags`) |
| 2026-06-17 | Melhoria busca chat (10 projetos, filtros, intenção) |

---

**URL:** https://portal-conecta2-0.vercel.app  
**Deploy:** Automático via Vercel  
**Última atualização:** 2026-06-17
