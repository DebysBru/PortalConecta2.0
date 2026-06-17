# AUDIT DO PROJETO — Portal Conecta IFPR
**Data:** 2026-06-17  
**Especificação:** SPEC.md (v1.0)  
**Deploy:** https://portal-conecta2-0.vercel.app

---

## RESUMO EXECUTIVO

O projeto encontra-se em **estágio avançado de MVP** com **Fase 1 ~85% completa** e **Fase 2 ~60% completa**. Painel admin/professor unificado, todas as páginas conectadas ao banco, inscrições funcionando com LGPD e protocolo.

**Alignment com SPEC:** ~70% (Fase 1+2 parcialmente completa)

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

---

## 2. MODELO DE DADOS (§3)

### Tabelas implementadas (27):

| Tabela | SPEC | Atual | Status |
|---|---|---|---|
| User | ✓ | ✅ | 90% |
| Projeto | ✓ | ✅ | 80% |
| ProjetoTag | ✓ | ✅ | 100% |
| ProjetoCurso | ✓ | ✅ | 100% |
| ProjetoFaq | ✓ | ✅ | 100% |
| ProjectCoordinator | ✓ | ✅ | 100% |
| Edital | ✓ | ✅ | 80% |
| EditalTag | ✓ | ✅ | 100% |
| EditalExplicacao | ✓ | ✅ | 100% |
| EditalResumoVersao | ✓ | ✅ | 100% |
| Evento | ✓ | ✅ | 60% |
| Inscricao | ✓ | ✅ | 80% |
| Post | ✓ | ✅ | 70% |
| RagDocumento | ✓ | ✅ | 70% |
| RagChunk | ✓ | ✅ | 50% (String? não pgvector) |
| ChatSessao | ✓ | ✅ | 70% |
| ChatMensagem | ✓ | ✅ | 70% |
| Job | ✓ | ✅ | 60% (sem worker) |
| IaRevisao | ✓ | ✅ | 60% |
| SiteConfig | ✓ | ✅ | 90% |
| AuditLog | ✓ | ✅ | 60% (sem uso) |
| SyncLog | ✓ | ✅ | 50% |
| AlertaInteresse | ✓ | ✅ | 100% |
| Favorito | ✓ | ✅ | 100% |
| Notificacao | ✓ | ✅ | 100% |
| UserPermission | ✓ | ✅ | 100% |
| Inscricao | ✓ | ✅ | 80% |

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
| 5.2 Projetos | 75% | ✅ Listagem, filtros, página individual, FAQ |
| 5.3 Editais | 70% | ✅ Listagem, filtros, "A IFizinha Explica", AI |
| 5.4 Agenda | 80% | ✅ Timeline, eventos derivados, .ics |
| 5.5 Painel professor | 80% | ✅ Dashboard, projetos, inscrições, relatórios |
| 5.6 Inscrição | 75% | ✅ Formulário LGPD, protocolo, validações |
| 5.7 Admin | 60% | ✅ Dashboard, editais, projetos, agenda, posts, usuários |
| 5.8 Posts | 70% | ✅ CRUD básico |

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

---

## 7. IFIZINHA (RAG) (§8)

| Componente | Status |
|---|---|
| Modelos de dados | ✅ RagDocumento, RagChunk, ChatSessao, ChatMensagem |
| pgvector | ❌ embedding é `String?` |
| Busca vetorial | ❌ Ausente |
| Chat com citações | ❌ Ausente |
| System prompt | ❌ Ausente |

---

## 8. LGPD E SEGURANÇA (§9)

| Aspecto | Status |
|---|---|
| Consentimento formulário | ✅ `consentimento_lgpd` obrigatório |
| Ciência das regras | ✅ Checkbox obrigatório |
| Protocolo único | ✅ PRJ-YYYY-NNNNNN |
| Validação email duplicado | ✅ |
| Acesso restrito inscritos | ⚠️ RLS simulada |
| "Meus dados" | ❌ Ausente |
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

## 11. RESUMO POR FASE

| Fase | Completude | Status |
|---|---|---|
| **1 — Fundação + MVP** | **85%** | ✅ Home, projetos, editais, agenda, inscrição |
| **2 — Professor** | **60%** | ✅ Dashboard, projetos, inscrições, relatórios |
| **3 — IA Extração** | **20%** | ✅ API DeepSeek funcional; falta UI revisão |
| **4 — RAG** | **10%** | Modelos prontos; falta pgvector + lógica |
| **5 — SUAP** | **30%** | Sync manual; falta agendada + conflitos |
| **6 — Portal completo** | **5%** | Tabelas criadas; falta UI |

---

## 12. PRÓXIMOS PASSOS RECOMENDADOS

### Imediato:
1. **Testes automatizados** — Critérios de aceite §14
2. **Confirmação por e-mail** — Pós-inscrição

### Curto prazo:
3. **Upload PDF** — Storage + extração IA
4. **Revisão humana** — Tela de revisão por campo
5. **Sync SUAP agendada** — Cron job

### Médio prazo:
6. **pgvector** — Migrar embeddings para extensão nativa
7. **RAG completo** — Ingestão + busca + chat
8. **Notificações** — Email/push para prazos

### Longo prazo:
9. **Favoritos + alertas** — Interesse por categoria
10. **"Meus dados"** — Estudante vê inscrições
11. **Relatórios avançados** — Gráficos + export PDF

---

**FIM DA AUDITORIA**
