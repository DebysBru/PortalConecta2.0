# ORIENTACAO.md — Guia de Andamento do Projeto

**Última atualização:** 2026-06-17  
**Status geral:** Fase 1 completa (~85%) + Fase 2 parcial (~60%) — Painel unificado em `/admin`

---

## 📚 ARQUIVOS DE DOCUMENTAÇÃO — Ordem de Leitura

1. **SPEC.md** — Especificação técnica completa (fonte da verdade)
2. **DECISIONS.md** — Decisões arquiteturais (Prisma/Firebase vs Supabase)
3. **AUDIT.md** — Estado atual do projeto
4. **ROADMAP.md** — Plano de 6 fases
5. **ORIENTACAO.md** — Este arquivo (checklist de status)

---

## ✅ STATUS ATUAL — O QUE FOI IMPLEMENTADO

### Fase 1 — Fundação + MVP Público (~85%)

| Item | Status | Detalhes |
|---|---|---|
| Schema Prisma | ✅ | 27 tabelas, todos os enums limpos (UserRole 3, StatusProjeto 6, StatusEdital 7) |
| Auth helpers | ✅ | `assignUserRole`, `ensureUserProfile`, `requireRole`, `requireProjectCoordinator` |
| Home dinâmica | ✅ | Métricas do BD, SiteConfig, editais/destaque, projetos, agenda |
| Projetos | ✅ | Listagem com filtros, busca, página individual com FAQ/tags/cursos/relacionados |
| Editais | ✅ | Listagem com filtros, página individual com "A IFizinha Explica" |
| Agenda | ✅ | Timeline por mês, eventos derivados, exportação `.ics` |
| Event derivation | ✅ | Auto-criar eventos ao publicar/editar edital ou projeto |
| AI translation | ✅ | Botão "Gerar com IA" com DeepSeek (API `/api/ai/ifizinha`) |
| Inscrição | ✅ | Formulário público com LGPD, protocolo PRJ-YYYY-NNNNNN |
| Painel admin/professor | ✅ | Unificado em `/admin` com navegação por role |

### Fase 2 — Gestão de Professores (~60%)

| Item | Status | Detalhes |
|---|---|---|
| Login professor | ✅ | Google OAuth, detecção `@ifpr.edu.br` |
| Dashboard professor | ✅ | Stats dos seus projetos |
| Edição de projetos | ✅ | Professor edita seus projetos |
| Inscrições | ✅ | Listagem, filtros, alteração de status, export CSV |
| Relatórios | ✅ | Estatísticas, busca, filtros por status |

---

## ❌ O QUE FALTA IMPLEMENTAR

### Fase 1 — Pendências

| Item | Prioridade | Descrição |
|---|---|---|
| Filtros avançados | Média | Busca textual, paginação, filtros por data, público-alvo |
| View `public_metrics` | Baixa | Materializar métricas para performance |
| Testes | Média | Critérios de aceite §14 |
| Upload PDF | Baixa | Storage para PDFs de editais |

### Fase 3 — IA de Extração (não iniciada)

| Item | Prioridade | Descrição |
|---|---|---|
| Upload PDF | Alta | Admin envia PDF do edital |
| Extração IA | Alta | Claude/DeepSeek extrai campos estruturados |
| Revisão humana | Alta | Tela de revisão por campo com confiança |
| Publicação | Alta | Só após aprovação → `review_status='publicado'` |

### Fase 4 — IFizinha RAG (não iniciada)

| Item | Prioridade | Descrição |
|---|---|---|
| pgvector | Alta | Migrar `embedding` de `String?` para extensão `vector` |
| Ingestão | Alta | Documentos publicados → `rag_documentos` |
| Embeddings | Alta | Chunking + geração de embeddings |
| Busca vetorial | Alta | `rag-query` com filtro de permissão |
| Chat com citações | Alta | IFizinha responde com fontes |

### Fase 5 — Integração SUAP (parcial)

| Item | Prioridade | Descrição |
|---|---|---|
| Sync agendada | Média | Cron job para sync automática |
| Proteção edição manual | Média | Não sobrescrever campos editados |
| Conflitos | Média | Registrar e exigir decisão do admin |

### Fase 6 — Portal Completo (não iniciada)

| Item | Prioridade | Descrição |
|---|---|---|
| Notificações | Média | Push/email para prazos próximos |
| Favoritos | Baixa | Estudante favorita editais/projetos |
| Alertas | Baixa | Interesse por categoria |
| "Meus dados" | Média | Estudante vê suas inscrições |
| Busca global | Baixa | Full-text search |

---

## 🎯 SUGESTÕES DE MELHORIA

### 1. **Notificações automáticas** (Alta prioridade)
- Enviar email/WhatsApp quando inscrições estão quase encerrando
- Lembrete 3 dias antes do prazo final
- Notificar professor quando nova inscrição é recebida

### 2. **Dashboard admin avançado** (Média)
- Gráficos de inscrições por período
- Taxa de aprovação/reprovação
- Projetos mais populares
- Editais mais acessados

### 3. **Formulário dinâmico** (Média)
- Cada projeto pode ter campos extras (`formulario_extra`)
- Arrastar para reordenar campos
- Campos condicionais (ex: se bolsista, mostrar campo de renda)

### 4. **Exportação avançada** (Baixa)
- Exportar para XLSX (não só CSV)
- Relatórios em PDF com gráficos
- Relatório consolidado de todos os projetos

### 5. **Chat IFizinha integrado** (Alta)
- Widget flutuante em todas as páginas
- Contexto da página atual (ex: "Sobre este edital")
- Histórico de conversas

### 6. **Modo urgente** (Baixa)
- Banner vermelho em editais/projetos com prazo em 24h
- Notificação push para estudantes interessados

### 7. **Página "Como participar"** (Baixa)
- Tutorial passo a passo para estudantes
- FAQ interativo
- Vídeos explicativos

---

## 📊 CHECKLIST DE STATUS

| Item | Status | Próximo |
|---|---|---|
| Schema Prisma | ✅ | — |
| Enums limpos | ✅ | — |
| Auth + Role assignment | ✅ | — |
| Home dinâmica | ✅ | — |
| Projetos (BD) | ✅ | Filtros avançados |
| Editais (BD) | ✅ | Upload PDF |
| Agenda + .ics | ✅ | Derivação automática |
| AI translation | ✅ | — |
| Inscrição + LGPD | ✅ | Confirmação e-mail |
| Painel admin/professor | ✅ | — |
| Testes | ❌ | Critérios §14 |
| Upload PDF | ❌ | Fase 3 |
| RAG | ❌ | Fase 4 |
| SUAP sync | ⚠️ | Sync agendada |

---

**URL:** https://portal-conecta2-0.vercel.app  
**Deploy:** Automático via Vercel  
**Última atualização:** 2026-06-17
