# Portal Conecta IFPR — Documentação Consolidada

**Versão:** 2.0 (Julho 2026)  
**Deploy:** https://portal-conecta2-0.vercel.app  
**Status:** MVP funcional, faltando recursos críticos para produção

---

## 1. Visão Geral do Projeto

Plataforma web do IFPR Campus Ivaiporã que centraliza projetos, editais, agenda e atendimento via chatbot (IFizinha). Stack: Next.js 14 + Prisma + PostgreSQL + Firebase Auth + DeepSeek API.

### Arquitetura

```
Frontend (Next.js App Router)
  ↓ Prisma + Server Actions
Backend (PostgreSQL via Supabase)
  ↓ API routes
DeepSeek API (IA: chat + extração + tags)
  ↓
Firebase Auth (Google OAuth + SUAP)
```

### Estrutura de Pastas Principal

```
src/
├── app/              # Páginas (App Router)
│   ├── page.tsx      # Home pública
│   ├── projetos/     # Listagem + [slug] individual
│   ├── editais/      # Listagem + [slug] individual
│   ├── agenda/       # Timeline de eventos
│   ├── inscricao/    # Formulário de inscrição
│   ├── meus-dados/   # Dados do estudante
│   ├── admin/        # Painel administrativo
│   ├── professor/    # Painel do coordenador
│   └── api/          # API routes (chat, AI, SUAP, auth)
├── components/       # Componentes React
│   ├── chat/         # ChatWidget (IFizinha)
│   ├── admin/        # AdminShell, SyncButtons
│   ├── professor/    # ProfessorShell
│   ├── layout/       # Header, Footer
│   ├── sections/     # Hero, seções da home
│   └── ui/           # Componentes base (shadcn)
├── contexts/         # AuthContext (Firebase)
├── lib/              # Utilitários, helpers, API clients
│   ├── prisma.ts     # Cliente Prisma
│   ├── firebase.ts   # Firebase client
│   ├── suap-api.ts   # Cliente SUAP (JWT auth)
│   ├── auth-helpers.ts # assignUserRole, requireRole
│   ├── cache.ts      # Cache em memória
│   └── email.ts      # Envio de emails (Resend)
└── actions/          # Server Actions
    ├── admin.ts      # CRUD projetos/editais/users
    ├── professor.ts  # Ações do coordenador
    ├── auth.ts       # Autenticação
    ├── inscricao.ts  # Inscrições
    └── suap.ts       # Sync SUAP
```

---

## 2. Estado Atual — O Que Existe

### ✅ Funcional

| Módulo | Status | Detalhes |
|---|---|---|
| Home pública | 90% | Métricas do BD, SiteConfig, destaques |
| Projetos (listagem) | 85% | Filtros, busca, tags, página individual |
| Editais (listagem) | 80% | Filtros, "A IFizinha Explica", tradução IA |
| Agenda | 85% | Timeline, eventos derivados, export `.ics` |
| Inscrição | 80% | Formulário LGPD, protocolo, validações |
| Auth Google | 100% | Firebase Auth, detecção `@ifpr.edu.br` |
| Painel admin | 70% | Dashboard, CRUD editais/projetos/posts/users |
| Painel professor | 70% | Dashboard, listagem projetos, inscrições |
| Chat IFizinha | 40% | Widget funcional, busca keyword (sem RAG) |
| Sync SUAP | 30% | Cliente funcional, sync manual |
| "Meus dados" | 100% | Listagem e exclusão de dados |

### ❌ Crítico para Produção

| Item | Impacto | Prioridade |
|---|---|---|
| **Chat sem RAG vetorial** | Responde apenas com keyword search, não com semântica | ALTA |
| **Sem upload de PDFs para RAG** | Admin não pode alimentar chatbot com documentos | ALTA |
| **Coordenador não gerencia posts** | Professor não pode postar conteúdo do seu projeto | ALTA |
| **Sem toggle de inscrição** | Coordenador não pode abrir/fechar formulário | ALTA |
| **Sync SUAP não agendada** | Dados ficam desatualizados | MÉDIA |
| **Sem pgvector** | Embeddings são String?, busca não é vetorial | ALTA |
| **Sem storage de PDFs** | Editais não têm PDF original baixável | MÉDIA |

---

## 3. Plano de Implementação — HOJE

### MISSÃO 1: Projetos + Coordenação

**Objetivo:** Coordenador @ifpr.edu.br acessa SOMENTE seu projeto, gerencia posts e inscrições.

#### 3.1 Gerenciamento de Posts por Projeto
- Criar `/professor/projetos/[id]/posts/page.tsx` — CRUD de posts do projeto
- Criar server action `createPost`, `updatePost`, `deletePost` em `src/actions/professor.ts`
- Posts vinculados ao `projetoId`, coordenador só vê/edita os seus
- Suporte a: título, conteúdo (markdown), imagem, status (rascunho/publicado)

#### 3.2 Toggle de Inscrição
- Adicionar campo `inscricoes_abertas` (boolean) no schema Prisma do `Projeto`
- Criar action `toggleInscricoes` em `src/actions/professor.ts`
- Botão no painel do coordenador: "Abrir/Fechar Inscrições"
- Validar que o formulário de inscrição só aparece quando `inscricoes_abertas = true`

#### 3.3 Coordenação de Acesso
- Verificar que `getProjetoDetalhes` e `listMyProjetos` filtram corretamente por `coordenadorEmail` + `ProjectCoordinator`
- Garantir que coordenador NÃO vê projetos de outros coordenadores
- Adicionar verificação server-side em todas as actions do professor

### MISSÃO 2: ChatBot IFizinha + RAG

**Objetivo:** Chatbot responde com base em documentos carregados pelo admin, com identidade da IFizinha.

#### 3.4 Upload de PDFs para RAG
- Criar página `/admin/rag/page.tsx` — upload de PDFs institucionais
- Criar API route `/api/admin/rag/upload` para receber PDF
- Salvar no filesystem (ou Supabase Storage) + registrar em `RagDocumento`
- Criar action `uploadRagDocument`, `listRagDocuments`, `deleteRagDocument`

#### 3.5 Extração de Texto de PDF
- Implementar extração de texto server-side (sem dependência externa pesada)
- Usar `pdf-parse` ou similar para extrair texto do PDF
- Dividir texto em chunks (~500 tokens)
- Salvar chunks em `RagChunk` com embedding simulado (ou real se pgvector disponível)

#### 3.6 Busca Vetorial (ou Similar)
- **Opção A (sem pgvector):** Busca porsimilaridade textual usando trigramas ou full-text search
- **Opção B (com pgvector):** Habilitar extensão pgvector no Supabase, gerar embeddings reais
- Implementar `rag-query` que combina busca vetorial com filtros de permissão

#### 3.7 System Prompt da IFizinha
- Atualizar system prompt no `/api/chat/route.ts`
- Persona: IFizinha, assistente virtual jovem e acolhedora
- Regras: só responde com base nos documentos, nunca inventa, cita fontes
- Incluir contexto dos chunks recuperados + metadados

#### 3.8 Integração com Chat
- Modificar `buscarContexto` para usar busca vetorial em `rag_chunks`
- Adicionar filtros: conteúdo publicado, tipo de documento
- Retornar fontes citadas na resposta
- Atualizar ChatWidget para mostrar fontes

---

## 4. Dependências Técnicas

### Pacotes Necessários

```bash
# Para extração de PDF
npm install pdf-parse

# Para pgvector (opcional, para RAG vetorial real)
# Requer extensão pgvector no Supabase
```

### Variáveis de Ambiente (adicionar)

```bash
# DeepSeek (já existe)
DEEPSEEK_API_KEY=...

# Storage local para PDFs do RAG
RAG_STORAGE_PATH=./storage/rag

# Admin emails (já existe)
ADMIN_EMAILS=...
```

### Mudanças no Schema Prisma

```prisma
// Adicionar campo inscricoes_abertas no Projeto
model Projeto {
  // ... campos existentes
  inscricoes_abertas Boolean @default(false)
}

// Adicionar modelo para logs de upload RAG
model RagUploadLog {
  id         String   @id @default(cuid())
  filename   String
  docId      String
  status     String   @default("processing") // processing, done, error
  chunks     Int      @default(0)
  error      String?
  created_at DateTime @default(now())
}
```

---

## 5. Fluxos Críticos

### Fluxo 1: Coordenador Gerencia Projeto

```
Login Google (@ifpr.edu.br)
  → AuthContext detecta role PROFESSOR
  → /professor mostra projetos vinculados
  → /professor/projetos/[id] — detalhes do projeto
  → /professor/projetos/[id]/posts — gerenciar posts
  → Botão "Abrir/Fechar Inscrições" — toggle inscricoes_abertas
```

### Fluxo 2: Admin Alimenta RAG

```
Login ADMIN
  → /admin/rag — página de upload
  → Upload PDF institucional
  → API extrai texto → cria chunks → salva em RagDocumento + RagChunk
  → Chat IFizinha usa chunks para responder
```

### Fluxo 3: Estudante Usa Chat

```
Abre ChatWidget
  → Pergunta: "Quais projetos de tecnologia tem?"
  → /api/chat recebe mensagem
  → buscarContexto faz busca em RagChunk (keyword ou vetorial)
  → Monta contexto com chunks relevantes
  → DeepSeek responde como IFizinha, citando fontes
  → ChatWidget exibe resposta + fontes
```

---

## 6. Checklist de Implementação

### Fase 1: Schema + Infraestrutura
- [x] Adicionar `inscricoes_abertas` ao schema Projeto
- [ ] Rodar `prisma db push`
- [x] Instalar `pdf-parse`
- [ ] Criar diretório `storage/rag/`

### Fase 2: Coordenador + Posts
- [x] Criar CRUD de posts no painel do professor
- [x] Criar toggle de inscrições
- [ ] Testar acesso isolado por coordenador

### Fase 3: RAG + Upload
- [x] Criar página admin de upload RAG
- [x] Implementar extração de texto de PDF
- [x] Implementar chunking de texto
- [x] Criar busca por chunks (keyword ou vetorial)

### Fase 4: Chat Atualizado
- [x] Atualizar system prompt da IFizinha
- [x] Integrar busca vetorial no `buscarContexto`
- [x] Adicionar citações de fontes nas respostas
- [ ] Testar fluxo completo

### Fase 5: Validação
- [ ] Testar login coordenador → acesso apenas seus projetos
- [ ] Testar upload PDF → chunking → busca → resposta
- [ ] Testar toggle inscrições → formulário abre/fecha
- [ ] Deploy e teste em produção
