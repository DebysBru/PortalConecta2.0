# AUDIT DO PROJETO — Portal Conecta IFPR
**Data:** 2026-06-17 (Atualizado)  
**Especificação:** SPEC.md (v1.0)  
**Deploy:** https://portal-conecta2-0.vercel.app

---

## RESUMO EXECUTIVO

O projeto encontra-se em **estágio avançado de MVP** com **Fase 1 ~90% completa** e **Fase 2 ~70% completa**. Chat IFizinha com RAG funcional, formulário de inscrição com selects/checkboxes, tags com IA, e sistema completo de gerenciamento.

**Alignment com SPEC:** ~75% (Fase 1+2 substantialmente completa)

---

## 1. STACK TECNOLÓGICA (§2.3)

| Item | Esperado (SPEC) | Atual | Status |
|---|---|---|---|
| Backend / BD | Supabase | Prisma + PostgreSQL | ⚠️ Decisão documentada |
| Frontend | Next.js + React + TS + Tailwind | ✓ Next.js 14.2.5 | ✅ |
| IA | Anthropic (Claude) | DeepSeek (API compatível) | ✅ Funcional |
| Auth | Google OAuth | Firebase Auth + NextAuth | ✅ Funcional |
| Storage | Supabase Storage | ❌ Ausente | ❌ Fase 3 |
| PDF | Edge Function + OCR | ❌ Ausente | ❌ Fase 3 |
| Fila | pg_cron | Tabela Job (sem worker) | ⚠️ Parcial |
| Chat | — | DeepSeek + Cache local | ✅ Funcional |

---

## 2. MODELO DE DADOS (§3)

### Tabelas implementadas (27):

| Tabela | SPEC | Atual | Status |
|---|---|---|---|
| User | ✓ | ✅ | 90% |
| Projeto | ✓ | ✅ | 85% |
| ProjetoTag | ✓ | ✅ | 100% |
| ProjetoCurso | ✓ | ✅ | 100% |
| ProjetoFaq | ✓ | ✅ | 100% |
| ProjectCoordinator | ✓ | ✅ | 100% |
| Edital | ✓ | ✅ | 85% |
| EditalTag | ✓ | ✅ | 100% |
| EditalExplicacao | ✓ | ✅ | 100% |
| EditalResumoVersao | ✓ | ✅ | 100% |
| Evento | ✓ | ✅ | 70% |
| Inscricao | ✓ | ✅ | 85% |
| Post | ✓ | ✅ | 75% |
| RagDocumento | ✓ | ✅ | 70% |
| RagChunk | ✓ | ✅ | 50% (String? não pgvector) |
| ChatSessao | ✓ | ✅ | 80% |
| ChatMensagem | ✓ | ✅ | 80% |
| Job | ✓ | ✅ | 60% (sem worker) |
| IaRevisao | ✓ | ✅ | 60% |
| SiteConfig | ✓ | ✅ | 90% |
| AuditLog | ✓ | ✅ | 60% (sem uso) |
| SyncLog | ✓ | ✅ | 50% |
| AlertaInteresse | ✓ | ✅ | 100% |
| Favorito | ✓ | ✅ | 100% |
| Notificacao | ✓ | ✅ | 100% |
| UserPermission | ✓ | ✅ | 100% |
| Inscricao | ✓ | ✅ | 85% |

### Tabelas ausentes:

| Tabela | Prioridade |
|---|---|
| `project_team` | Baixa |

---

## 3. AUTENTICAÇÃO E AUTORIZAÇÃO (§4)

| Critério | Status |
|---|---|
| Login Google | ✅ Firebase Auth |
| Restrição `@ifpr.edu.br` | ✅ `assignUserRole` |
| Atribuição role no signup | ✅ `ensureUserProfile` |
| RLS simulada | ⚠️ Validação em app (não BD) |
| Matriz permissões | ✅ `requireRole`, `requireProjectCoordinator` |
| Painel admin por role | ✅ Navegação filtrada por role |

---

## 4. MÓDULOS FUNCIONAIS (§5)

| Módulo | Completude | Status |
|---|---|---|
| 5.1 Home pública | 90% | ✅ Métricas BD, SiteConfig, destaques |
| 5.2 Projetos | 80% | ✅ Listagem, filtros, busca, página individual, FAQ, tags |
| 5.3 Editais | 75% | ✅ Listagem, filtros, "A IFizinha Explica", AI translation |
| 5.4 Agenda | 85% | ✅ Timeline, eventos derivados, .ics, exportação |
| 5.5 Painel professor | 85% | ✅ Dashboard, projetos, inscrições, relatórios |
| 5.6 Inscrição | 80% | ✅ Formulário com selects/radios/checkboxes, LGPD, protocolo |
| 5.7 Admin | 70% | ✅ Dashboard, editais, projetos, agenda, posts, usuários |
| 5.8 Posts | 75% | ✅ CRUD básico |

---

## 5. INTEGRAÇÃO SUAP (§6)

| Critério | Status |
|---|---|
| Cliente desacoplado | ✅ `suap-api.ts` |
| Sync manual | ✅ API routes |
| Sync agendada | ❌ Ausente |
| Idempotência | ⚠️ Parcial |
| Proteção edição manual | ❌ Ausente |

---

## 6. PIPELINE DE IA (§7)

| Etapa | Status |
|---|---|
| Extração de editais | ✅ DeepSeek API funcional |
| Botão "Gerar com IA" | ✅ Admin editais |
| Revisão humana | ❌ Ausente |
| Tabela `ia_revisoes` | ✅ Modelo pronto |
| Tags com IA | ✅ `sugerirTags` funcional |

---

## 7. IFIZINHA (RAG/CHAT) (§8)

| Componente | Status |
|---|---|
| Modelos de dados | ✅ RagDocumento, RagChunk, ChatSessao, ChatMensagem |
| Chat widget | ✅ Flutuante em todas as páginas |
| Busca por projetos | ✅ Nome, área, tags, coordenador, tipo |
| Busca por editais | ✅ Título, resumo, categoria |
| Cache local | ✅ 5 min TTL |
| Detecção de intenção | ✅ Projeto/Edital/Ambos |
| Formatação markdown | ✅ Negrito, listas, tabelas |
| Resumo do portal | ✅ Totais de projetos/editais |
| pgvector | ❌ embedding é `String?` |
| Busca vetorial nativa | ❌ Ausente |

---

## 8. LGPD E SEGURANÇA (§9)

| Aspecto | Status |
|---|---|
| Consentimento formulário | ✅ `consentimento_lgpd` obrigatório |
| Ciência das regras | ✅ Checkbox obrigatório |
| Protocolo único | ✅ PRJ-YYYY-NNNNNN |
| Validação email duplicado | ✅ |
| Acesso restrito inscritos | ⚠️ RLS simulada |
| "Meus dados" | ✅ Página `/meus-dados` com listagem e exclusão |
| Retenção dados | ❌ Ausente |

---

## 9. ACESSIBILIDADE (§11)

| Critério | Status |
|---|---|
| Responsivo | ✅ Mobile-first |
| Contraste | ⚠️ Review pendente |
| Navegação teclado | ⚠️ Não testado |
| Headings | ⚠️ Não verificado |

---

## 10. APIs IMPLEMENTADAS

| Rota | Método | Função |
|---|---|---|
| `/api/ai/ifizinha` | POST | Gera tradução IFizinha com DeepSeek |
| `/api/chat` | POST | Chat IFizinha com RAG + cache |
| `/api/events/ics` | GET | Exporta eventos em formato .ics |
| `/api/projetos/check-inscricao` | GET | Verifica se projeto aceita inscrições |
| `/api/suap/sync/projetos` | POST | Sync projetos do SUAP |
| `/api/suap/sync/editais` | POST | Sync editais do SUAP |
| `/api/suap/status` | GET | Status da última sync |
| `/api/suap/endpoints` | GET | Lista endpoints SUAP |
| `/api/auth/suap-login` | POST | Login via SUAP |
| `/api/auth/complete-suap-link` | POST | Vincular SUAP + Google |
| `/api/auth/relink-google` | POST | Re-vincular Google |
| `/api/auth/delete-firebase-user` | POST | Deletar usuário |

---

## 11. COMPONENTES IMPLEMENTADOS

| Componente | Função |
|---|---|
| `ChatWidget.tsx` | Widget flutuante do chat IFizinha |
| `AdminShell.tsx` | Shell do painel admin com nav por role |
| `ProfessorShell.tsx` | Shell do painel professor (legado) |
| `HeroIFizinha.tsx` | Hero da home com configuração |
| `ProjetosGrid.tsx` | Grid de projetos em destaque |
| `Header.tsx` | Cabeçalho público com nav |
| `Footer.tsx` | Rodapé |
| `SyncButtons.tsx` | Botões de sync SUAP |

---

## 12. RESUMO POR FASE

| Fase | Completude | Status |
|---|---|---|
| **1 — Fundação + MVP** | **90%** | ✅ Home, projetos, editais, agenda, inscrição, tags IA |
| **2 — Professor** | **70%** | ✅ Dashboard, projetos, inscrições, relatórios |
| **3 — IA Extração** | **25%** | ✅ API DeepSeek funcional; tags IA; falta UI revisão |
| **4 — RAG** | **40%** | Chat funcional com busca keyword; falta pgvector |
| **5 — SUAP** | **30%** | Sync manual; falta agendada + conflitos |
| **6 — Portal completo** | **15%** | Chat widget, "Meus dados"; falta notificações |

---

## 13. PRÓXIMOS PASSOS RECOMENDADOS

### Imediato (Alta prioridade):
1. **Confirmação por e-mail** — Pós-inscrição (Resend/SendGrid)
2. **Testes automatizados** — Critérios de aceite §14
3. **Upload PDF** — Storage para editais

### Curto prazo:
4. **Revisão humana IA** — Tela de revisão por campo com confiança
5. **Sync SUAP agendada** — Cron job
6. **Notificações** — Email para prazos próximos

### Médio prazo:
7. **pgvector** — Migrar embeddings para extensão nativa
8. **RAG completo** — Ingestão + busca vetorial + chat com citações
9. **"Meus dados" avançado** — Exportação, histórico completo

### Longo prazo:
10. **Favoritos + alertas** — Interesse por categoria
11. **Relatórios avançados** — Gráficos + export PDF
12. **Página "Como participar"** — Tutorial interativo

---

## 14. FUNCIONALIDADES RECENTEMENTE IMPLEMENTADAS

| Data | Funcionalidade |
|---|---|
| 2026-06-17 | Chat IFizinha com RAG, cache, markdown |
| 2026-06-17 | Formulário inscrição com selects/radios/checkboxes |
| 2026-06-17 | Tags com IA (`sugerirTags`) |
| 2026-06-17 | Melhoria busca chat (10 projetos, filtros, intenção) |

---

**FIM DA AUDITORIA**
