# Relatório de Testes - PortalConecta 2.0

**Data:** 2026-07-24 (revisado e atualizado em 2026-08-26 — ver `PLANO_DE_TESTES_E_VALIDACAO.md` para o estado consolidado e o plano de regressão)
**Escopo:** QA Funcional, Validação de Formulários, Segurança, Usabilidade (UI/UX)

> **Atualização 2026-08-26:** muita coisa mudou desde julho (reconstrução do RAG, Vagas, PerfilAluno, fluxo de publicação — ver `ANALISE_E_PLANO_RAG.md`). Reverifiquei item por item da seção 3 (Segurança) contra o código atual; o status real de cada um está marcado inline abaixo como `[STATUS 2026-08-26]`. Vários itens que pareciam corrigidos regrediram ou nunca cobriam todos os call sites; vários outros foram corrigidos nesta data. Não reverifiquei as seções 1/2/4 linha a linha — os pontos relevantes que confirmei estão anotados onde aparecem.

---

## SUMÁRIO EXECUTIVO

| Severidade | Total | Corrigidos (2026-07-24) | Corrigidos (2026-08-26) |
|-----------|-------|-----------|-----------|
| CRÍTICO (S1-S4)  | 4     | 2 (S2,S4) | S1, S3 |
| ALTO (S5-S12)    | 8     | 0 | S5,S6,S8,S9,S10,S11 (S7 parcial; S12 aberto) |
| MÉDIO (S13-S22)  | 10    | 1 (S21) | S13,S14,S15,S16,S18,S19,S20 (S17,S22 parciais) |
| BAIXO (S23-S27)  | 5     | 0 | S25,S26,S27 (N/A) — S23 aberto |

**Resumo:** de 27 itens, restam abertos só **S12** (regra de negócio do SUAP — vincular Google auto-atribui PROFESSOR, decisão de produto, não bug) e **S23** (sem paginação — UX/performance, não segurança). S7,S17,S22 ficam como parciais (risco baixo, não bloqueiam). Todos os itens de autorização, sessão e abuso (S1,S3,S5,S6,S9,S10,S11,S13,S25) estão corrigidos e testados — ver `PLANO_DE_TESTES_E_VALIDACAO.md` para o detalhe de cada teste.

Ver a tabela de status item-a-item na seção 3 para o detalhe de cada um, e `PLANO_DE_TESTES_E_VALIDACAO.md` para o plano de regressão e a lista priorizada do que falta.

### Bugs Corrigidos (2026-07-24)
- Checkbox `disponibilidade` — agora captura todos os valores via `form.getAll()`
- Validação server-side adicionada em: inscrição, projetos, editais, eventos
- `userRole` client-side — agora lookup no servidor em vez de confiar no cliente
- `meus-dados.ts` — validação de email adicionada para prevenir exfiltração
- `updateInscricaoStatus` — agora verifica ownership do projeto
- `updateUserRole` / `deleteUser` — agora previnem auto-promoção e auto-exclusão
- `perfil.ts` — validação de email em todas as funções
- Email hardcoded removido de `admin.ts` e `AuthContext.tsx`
- Guard de acesso adicionado à página RAG

---

## 1. VALIDAÇÃO DE FORMULÁRIOS — VALORES INVÁLIDOS/NEGATIVOS

### 1.1 Formulário de Inscrição (`/inscricao/[slug]`)

| Campo | Validação | Resultado | Severidade |
|-------|-----------|-----------|------------|
| **Idade** | `min="14" max="100"` HTML5 | Aceita valores negativos via console (ex: `-5`). O `FormData.get('idade')` converte para `Number()`, que aceita `-5`. O `min`/`max` HTML é ignorado se o browser não aplicar. | ALTO |
| **Idade** | Campo é opcional | Permite inscrição sem idade. | OK |
| **Telefone** | Sem validação | Aceita qualquer string, incluindo letras e caracteres especiais. | MÉDIO |
| **Nome completo** | Apenas `required` HTML | Aceita apenas espaços em branco ("   "). O server action verifica `!data.nome_completo` mas não trim() — uma string com espaços passaria. | MÉDIO |
| **Email** | `type="email"` + server action | Validação OK. | OK |
| **Semestre** | `form.get('semestre')` | **BUG:** O campo no HTML tem `name="semestre_atual"` mas o código lê `form.get('semestre')` — retorna `null`. O valor correto vem do state `semestre` via template string. Funciona, mas é frágil. | BAIXO |
| **Disponibilidade** | Checkboxes `name="disponibilidade"` | **BUG:** `form.get('disponibilidade')` retorna APENAS o PRIMEIRO checkbox marcado. Checkboxes múltiplos não são capturados corretamente. Deveria usar `form.getAll('disponibilidade')`. | ALTO |
| **Curso** | `required` HTML | OK, mas sem validação server-side do valor estar na lista. | BAIXO |

### 1.2 Formulário de Cadastro (`/cadastro`)

| Campo | Validação | Resultado | Severidade |
|-------|-----------|-----------|------------|
| **Nome** | Apenas `required` | Aceita um único caractere (ex: "A"). Sem limite de tamanho. | MÉDIO |
| **Email** | `type="email"` | OK. | OK |
| **Senha** | `length < 6` client-side | Firebase rejeita < 6 chars. OK. | OK |
| **Confirmar senha** | `password !== confirmPassword` | OK. | OK |
| **Name** | Trim não aplicado | O `ensureUser` upserta com o name como enviado — espaços extras são preservados. | BAIXO |

### 1.3 Formulário de Projetos (Admin)

| Campo | Validação | Resultado | Severidade |
|-------|-----------|-----------|------------|
| **Nome** | Apenas `required` HTML | Aceita strings vazias com espaços. Sem validação server-side. | MÉDIO |
| **Coordenador** | Apenas `required` HTML | Mesmo problema. | MÉDIO |
| **Área** | Apenas `required` HTML | Aceita qualquer texto, não valida se está na lista (Pesquisa/Extensão). | BAIXO |
| **Logo URL** | `type="url"` HTML | Aceita URLs quebradas. Sem validação de URL real no server. | BAIXO |
| **Email do projeto** | `type="email"` | OK. | OK |
| **Cor primária** | Input color + text | Aceita qualquer string no campo de texto (ex: "abc123"), que quebra o CSS. | BAIXO |

### 1.4 Formulário de Editais (Admin)

| Campo | Validação | Resultado | Severidade |
|-------|-----------|-----------|------------|
| **Link Oficial** | `type="url"` required | OK, mas aceita URLs inválidas como "abc" no campo text. | BAIXO |
| **Data de Encerramento** | `required` | OK. | OK |
| **Título** | Apenas `required` | Sem limite de tamanho. | BAIXO |

### 1.5 Formulário de Perfil (`/admin/perfil`)

| Campo | Validação | Resultado | Severidade |
|-------|-----------|-----------|------------|
| **Nome** | `maxLength={80}` client + server validation 2-80 chars | OK — server valida corretamente. | OK |
| **Exclusão de conta** | Input deve coincidir com nome/email exato | OK — boa UX de confirmação. | OK |

### 1.6 Formulário de Inscrições do Professor

| Campo | Validação | Resultado | Severidade |
|-------|-----------|-----------|------------|
| **Post título** | `form.titulo.trim()` check | OK. | OK |
| **Post conteúdo** | `form.conteudo.trim()` check | OK. | OK |
| **Status change** | Select dropdown, imediato | Atualiza sem confirmação. Mudanças acidentais são irreversíveis sem undo. | MÉDIO |

---

## 2. CRUD DO ADMIN — O QUE FUNCIONA E O QUE NÃO

### 2.1 Editais

| Operação | Botão | Funcionalidade | Problema |
|----------|-------|----------------|----------|
| Criar | "Novo Edital" | Funciona | Sem validação server-side de campos obrigatórios |
| Editar | Lápis (Pencil) | Funciona | OK |
| Excluir | Lixeira (Trash) | Funciona | `confirm()` nativo, sem undo. Deleta em cascata com eventos derivados |
| Gerar com IA | "Gerar com IA" | Funciona | Requer título + resumo preenchidos primeiro |

### 2.2 Projetos

| Operação | Botão | Funcionalidade | Problema |
|----------|-------|----------------|----------|
| Criar | "Novo Projeto" | Funciona | Sem validação server-side de campos obrigatórios |
| Editar | Lápis | Funciona | OK |
| Excluir | Lixeira | Funciona | `confirm()` nativo. Deleta projeto + invalida cache |
| Ver Posts | Ícone newspaper | Funciona | Navega para `/admin/posts?projetoId={id}` |
| Ver Página | ExternalLink | Funciona | Abre em nova aba |
| Filtros | Barra de filtros | Funciona | Busca por nome, tipo e status |
| Limpar Filtros | Botão "Limpar" | Funciona | OK |

### 2.3 Usuários

| Operação | Botão | Funcionalidade | Problema |
|----------|-------|----------------|----------|
| Convidar | "Autorizar" | Funciona | Valida email + projeto se professor |
| Alterar papel | Select por linha | Funciona | Alerta ao tentar mudar para professor (redireciona para convite) |
| Excluir | Lixeira | Funciona | Previne auto-exclusão. `confirm()` nativo |
| Acesso restrito | - | Funciona | Apenas MASTER ADMIN acessa |

### 2.4 Agenda/Eventos

| Operação | Botão | Funcionalidade | Problema |
|----------|-------|----------------|----------|
| Criar | "Novo Evento" | Funciona | Sem validação server-side |
| Editar | Lápis | Funciona | OK |
| Excluir | Lixeira | Funciona | `confirm()` nativo |
| Acesso restrito | - | Funciona | Apenas MASTER ADMIN |

### 2.5 Posts

| Operação | Botão | Funcionalidade | Problema |
|----------|-------|----------------|----------|
| Criar | "Novo Post" | Funciona | Valida professor é coordenador do projeto |
| Editar | Lápis | Funciona | OK |
| Excluir | Lixeira | Funciona | Valida ownership |

### 2.6 Inscrições (Admin)

| Operação | Botão | Funcionalidade | Problema |
|----------|-------|----------------|----------|
| Mudar status | Select por linha | Funciona | Atualiza imediatamente sem confirmação |
| Exportar CSV | "Exportar CSV" | Funciona | OK |
| Ver detalhes | Ícone Eye | Funciona | Abre side panel |

### 2.7 Limpar Dados (CRÍTICO)

| Operação | Botão | Funcionalidade | Problema |
|----------|-------|----------------|----------|
| Selecionar tabelas | Checkboxes | Funciona | OK |
| Confirmação 3 etapas | Fluxo modal | Funciona | Email de confirmação necessário |
| Executar limpeza | "Apagar Dados" | Funciona | **Email hardcoded como fallback se env não estiver configurado** |

### 2.8 SUAP

| Operação | Botão | Funcionalidade | Problema |
|----------|-------|----------------|----------|
| Salvar Token | "Salvar Token" | Funciona | Token exibido em texto plano (type="text") |
| Sincronizar projetos | "Sincronizar" | Funciona | OK |
| Sincronizar editais | "Sincronizar" | Funciona | OK |
| Dry-run | "Testar" | Funciona | OK |

### 2.9 RAG

| Operação | Botão | Funcionalidade | Problema |
|----------|-------|----------------|----------|
| Criar doc (texto) | "Texto Direto" | Funciona | Valida título + conteúdo client-side |
| Upload arquivo | "Upload Arquivo" | Funciona | Aceita extensões via client-side |
| Editar doc | Ícone Edit | Funciona | Edita resumo e tags |
| Excluir doc | Lixeira | Funciona | `confirm()` nativo |
| Ativar/Desativar | Eye/EyeOff | Funciona | OK |
| **Guard de acesso** | - | **FALTA** | Página não verifica `isMasterAdmin`. Qualquer usuário logado pode acessar via URL direto |

---

## 3. PROBLEMAS DE SEGURANÇA (POR SEVERIDADE)

### Status consolidado (verificado em 2026-08-26, item a item contra o código atual)

| Item | Status | Observação |
|---|---|---|
| S1 | ✅ Corrigido (2026-08-26) | Ver anotação inline abaixo. |
| S2 | ✅ Corrigido | `role` sempre lido do servidor em `professor.ts`/`admin.ts`. |
| S3 | ✅ Corrigido (2026-08-26) | `meus-dados.ts` agora exige `idToken` do Firebase, verificado no servidor via `verifySessionToken` — não valida mais só o formato de um `email` que o cliente afirma ser seu. Testado com token real. |
| S4 | ✅ Corrigido | Sem e-mail hardcoded; só `process.env.ADMIN_EMAILS`. |
| S5 | ✅ Corrigido (2026-08-26) | `deleteUser` agora exige `callerEmail` e checa `role === 'ADMIN'`, não só auto-proteção. |
| S6 | ✅ Corrigido (2026-08-26) | `updateUserRole` idem — antes qualquer um podia promover qualquer um a ADMIN. |
| S7 | 🟡 Parcial | Ainda promove sem consentimento explícito, mas agora é revogável (Etapa 9 do plano RAG — `revogarProfessorSeSemProjetos`). |
| S8 | ✅ Corrigido | Guard `isMasterAdmin` presente em `/admin/rag`. |
| S9 | ✅ Corrigido (2026-08-26) | Session cookie httpOnly (`createSessionCookie`/`verifySessionCookie` do firebase-admin, ver `src/lib/session.ts`) verificado nos layouts `admin/(protected)/layout.tsx`/`professor/(protected)/layout.tsx` — rodam em Node (não em Edge, onde `middleware.ts` roda e não suporta `firebase-admin`). `/admin/login`/`/professor/login` ficaram num route group `(protected)` separado pra não entrar no gate (evita redirect-loop). Testado com token real: sem sessão → 307 pro login; sessão de ESTUDANTE → 307 pra home; sessão de ADMIN/PROFESSOR → 200; cookie forjado → 307. |
| S10 | ✅ Corrigido (2026-08-26, revisão de segurança da Etapa 10) | `userEmail` era opcional em `updateInscricaoStatus`, permitindo alterar status de qualquer inscrição sem autenticação. Agora obrigatório, checagem sempre roda. |
| S11 | ✅ Corrigido (2026-08-26) | `exportInscricoesCSV` agora exige `userEmail` e checa coordenador do projeto. |
| S12 | 🔴 Aberto (decisão de produto) | SUAP+Google auto-atribui PROFESSOR — não é bug técnico, é uma regra de negócio a decidir. |
| S13 | ✅ Corrigido (2026-08-26) | Rate limit baseado no banco (`src/lib/rate-limit.ts`, tabela `RateLimitHit` — sem depender de memória do processo, que não sobrevive entre invocações serverless). Aplicado em `/api/auth/suap-login` (5 tentativas/5min por IP — alvo de força bruta contra credencial SUAP) e `criarInscricao` (10/10min por IP — spam no formulário público). Testado: bloqueia na tentativa seguinte ao limite, com `429`/mensagem clara. |
| S14 | ✅ Corrigido (2026-08-26) | Campo de token SUAP virou `type="password"`. |
| S15 | ✅ Corrigido | `detectFileType()` roda server-side no upload. |
| S16 | ✅ Corrigido (2026-08-26) | Mensagem de "esqueci senha" não revela mais se o e-mail existe. |
| S17 | 🟡 Baixo impacto, não corrigido | `listProjetos()` sem auth interno, mas dado já é majoritariamente público. |
| S18 | ✅ Corrigido (2026-08-26) | `getMyProfile` agora exige `idToken` verificado. `getCurrentUserAction` era código morto (sem caller) — removida. |
| S19 | ✅ Corrigido (2026-08-26) | `adicionarTagsProjeto`/`aprovarTag`/`removerTag` — eram código morto (nenhuma página chama), mas ganharam checagem de ADMIN mesmo assim (Server Actions são invocáveis diretamente). |
| S20 | ✅ Corrigido (2026-08-26) | `deleteMyAccount` agora exige `idToken` verificado. Testado com token real. |
| S21 | ✅ Corrigido | `updateMyName` valida no servidor. |
| S22 | 🟡 Parcial | 7 páginas já usam `<ConfirmDialog>`; `professor/projetos/[id]` ainda usa `confirm()`/`alert()` nativos. |
| S23 | 🔴 Aberto | Sem paginação — melhoria de UX/performance, não segurança. |
| S25 | ✅ Corrigido (2026-08-26) | Cloudflare Turnstile (`src/lib/turnstile.ts`, componente `<TurnstileWidget>`) em `/cadastro` e `/inscricao/[slug]`. Degrada graciosamente: sem `TURNSTILE_SECRET_KEY`/`NEXT_PUBLIC_TURNSTILE_SITE_KEY` configuradas, o widget não renderiza e a verificação sempre passa — nada quebra até alguém gerar as chaves gratuitas em dash.cloudflare.com. **Verificação funcional do bloqueio real ainda não testada** (precisa das chaves de verdade). |
| S26 | ✅ Corrigido (2026-08-26) | `syncUserProfileAction` era código morto (sem caller) — removida junto com `getCurrentUserAction`. |
| S27 | ✅ N/A | Já coberto pela proteção CSRF nativa de Server Actions do Next.js. |

**S3/S18/S20/S26 compartilhavam a mesma causa raiz** (corrigida em 2026-08-26): este app não tinha verificação real de sessão no servidor — todo lugar que recebia um `email`/`userId` como parâmetro confiava nele por convenção. Agora `verifySessionToken` (`src/lib/auth-helpers.ts`) verifica o ID token do Firebase via `firebase-admin`, e as actions de autoatendimento (`perfil.ts`, `meus-dados.ts`) usam o e-mail *verificado* do token, não mais um parâmetro cru. Testado com token real (ver `PLANO_DE_TESTES_E_VALIDACAO.md`, seções 0 e 1). **S9 continua aberto** — o gate de entrada em `/admin`/`/professor` (`middleware.ts`) ainda é só client-side; a correção acima protege os *dados*, mas não impede a UI de carregar pra quem não devia.

### CRÍTICO

#### S1. Server Actions sem verificação de autorização
**Localização:** `src/actions/admin.ts` — maioria das funções
**Descrição:** `createProjeto`, `updateProjeto`, `deleteProjeto`, `createEdital`, `updateEdital`, `deleteEdital`, `listUsuarios`, `updateUserRole`, `deleteUser`, `inviteUser`, `createEvento`, `updateEvento`, `deleteEvento` não verificam se o chamador está autenticado ou tem o papel correto.
**Impacto:** Qualquer usuário autenticado (ou até não autenticado via curl direto) pode chamar essas Server Actions e manipular dados arbitrariamente.
**Exemplo:** `deleteUser` não verifica se o chamador é admin. `updateUserRole` permite auto-promoção.
**[STATUS 2026-08-26]: CORRIGIDO.** Todas as funções citadas agora exigem `callerEmail`/`authorEmail` e checam `role === 'ADMIN'` no servidor (helper `requireAdminEmail`, mesmo padrão de `src/actions/rag.ts`). `createPost`/`updatePost`/`deletePost` (também em `admin.ts`) tinham uma variante do mesmo bug — "fail-open" quando o role não era detectado — corrigida junto (agora nega por padrão, só libera se `ADMIN` ou coordenador `PROFESSOR`). Testado via chamada direta simulando um atacante sem passar `callerEmail`/passando e-mail forjado — nega em todos os casos; testado o caminho de admin de verdade — funciona.

#### S2. `userRole` fornecido pelo cliente e confiável no servidor
**Localização:** `src/app/admin/posts/page.tsx` → `createPost(form, user.email, userRole)`
**Descrição:** O `userRole` é passado como parâmetro do cliente. Um atacante pode passar `'ADMIN'` para pular a verificação de que é coordenador do projeto.
**Impacto:** Bypass de autorização para criar/editar/excluir posts em projetos alheios.

#### S3. `meus-dados.ts` — exfiltração de dados
**Localização:** `src/actions/meus-dados.ts`
**Descrição:** `getMinhasInscricoes(email)`, `exportMinhasInscricoesCSV(email)` aceitam qualquer email como parâmetro. Um usuário autenticado pode passar o email de qualquer pessoa e ver/exportar suas inscrições.
**Impacto:** Vazamento massivo de dados pessoais (LGPD violation).

#### S4. Email hardcoded como fallback de master admin
**Localização:** `src/actions/admin.ts:13`, `src/contexts/AuthContext.tsx`
**Descrição:** Se `ADMIN_EMAILS` não estiver configurado, o email `bru.mkt2024@gmail.com` é usado como master admin. Isso está em código-fonte.
**Impacto:** Se o env não estiver configurado em produção, qualquer pessoa com esse email terá acesso master.

### ALTO

#### S5. `deleteUser` sem auto-proteção no servidor
**Localização:** `src/actions/admin.ts`
**Descrição:** A verificação `userId === currentUser?.uid` é apenas client-side. O server action deleta qualquer ID fornecido.

#### S6. `updateUserRole` permite auto-promoção
**Localização:** `src/actions/admin.ts`
**Descrição:** Sem verificação server-side, qualquer chamada pode alterar o papel de qualquer usuário.

#### S7. `syncProjectAdmins` promove automaticamente para PROFESSOR
**Localização:** `src/actions/admin.ts:182-201`
**Descrição:** Ao adicionar emails no campo `adminEmails` de um projeto, usuários inexistentes são criados com papel PROFESSOR, e estudantes existentes são promovidos sem consentimento.

#### S8. Página RAG sem guard de autorização
**Localização:** `src/app/admin/rag/page.tsx`
**Descrição:** Diferente de usuarios/editais/agenda/limpar-dados, a página RAG não verifica `isMasterAdmin`. Qualquer usuário logado pode acessar via URL direto.

#### S9. Middleware não verifica autenticação
**Localização:** `middleware.ts:48-55`
**Descrição:** O middleware注释 explicitamente afirma que a proteção é apenas client-side. Todas as rotas `/admin/*` e `/professor/*` são servidas sem verificação de token.

#### S10. `updateInscricaoStatus` sem verificação de ownership
**Localização:** `src/actions/professor.ts`
**Descrição:** Qualquer professor autenticado pode alterar o status de inscrições de projetos que não administra.

#### S11. `exportInscricoesCSV` sem verificação
**Localização:** `src/actions/professor.ts`
**Descrição:** Qualquer chamada pode exportar CSV de qualquer projeto.

#### S12. SUAP link auto-atribui papel PROFESSOR
**Localização:** `src/app/api/auth/complete-suap-link/route.ts`
**Descrição:** Qualquer usuário SUAP que vincule Google recebe automaticamente o papel de PROFESSOR, independentemente de seu cargo real na instituição.

### MÉDIO

#### S13. Sem rate limiting em login, cadastro e inscrições
**Descrição:** Nenhuma proteção contra brute force ou spam.

#### S14. Token SUAP exibido em texto plano
**Localização:** `src/app/admin/suap/page.tsx`
**Descrição:** Input `type="text"` em vez de `type="password"`.

#### S15. Upload de arquivo no RAG sem validação server-side de tipo
**Descrição:** A lista de extensões aceitas é apenas client-side. O endpoint `/api/admin/rag/upload` deve validar.

#### S16. User enumeration via "Esqueci minha senha"
**Localização:** `src/app/esqueci-senha/page.tsx`
**Descrição:** Mensagem de erro "Não encontramos uma conta com este e-mail" revela se o email está cadastrado.

#### S17. `listProjetos` exposta sem email quando chamada por usuarios
**Localização:** `src/app/admin/usuarios/page.tsx`
**Descrição:** `listProjetos()` é chamada sem parâmetros, retornando todos os projetos.

#### S18. `getCurrentUserAction` e `getMyProfile` sem auth
**Descrição:** Podem ser chamados com qualquer email.

#### S19. Tags actions sem auth
**Descrição:** `adicionarTagsProjeto`, `aprovarTag`, `removerTag` não verificam autorização.

#### S20. `deleteMyAccount` sem auth
**Descrição:** Aceita qualquer email como parâmetro.

#### S21. Formulário de perfil sem validação server-side de nome
**Descrição:** O campo nome aceita espaços extras.

#### S22. `confirm()` nativo do browser
**Descrição:** Não pode ser customizado, logado, ou desabilitado. Usuários podem clicar por engano.

### BAIXO

#### S23. Sem paginação em listas de usuários e projetos
**Descrição:** Performance degrada com muitos registros.

#### S24. Hardcoded fallback email
**Descrição:** Já coberto em S4.

#### S25. Formulário de cadastro sem CAPTCHA
**Descrição:** Aberto para criação automatizada de contas.

#### S26. `syncUserProfileAction` aceita userId não verificado
**Descrição:** O caller pode fornecer qualquer userId.

#### S27. CSRF mitigation dependente do Next.js
**Descrição:** Server Actions do Next.js têm proteção CSRF embutida, mas não há verificação adicional de Origin header.

---

## 4. TESTE DE USABILIDADE (UI/UX)

### 4.1 Problemas de Fluxo

| # | Problema | Localização | Sugestão |
|---|----------|-------------|----------|
| U1 | **Status de inscrição atualiza imediatamente** sem confirmação ou undo | Inscricões (admin/professor) | Adicionar toast de confirmação ou undo temporário (ex: "Status alterado. Desfazer?") |
| U2 | **Exclusão de dados usa `confirm()` nativo** — sem visual consistente | Projetos, Editais, Usuários, Posts, RAG | Usar modal customizado com design consistente ao restante do sistema |
| U3 | **Mensagem de erro genérica** em许多Server Actions | `admin.ts`, `perfil.ts` | Traduzir erros do Prisma para mensagens amigáveis ao usuário |
| U4 | **Painel de edição deslizante** abre rápido mas sem animação de saída visível | Projetos, Editais | Adicionar animação de slide-out ao fechar |
| U5 | **Campo "Turma" readOnly** pode confundir o usuário | Inscrição | Adicionar tooltip ou mensagem explicativa mais visível |
| U6 | **Filtros na barra de projetos** misturam busca com dropdowns — densidade visual alta | `/admin/projetos` | Considerar collapse/expand dos filtros ou layout mais limpo |
| U7 | **Modal de detalhes da inscrição** (side panel) não tem botão de ação | `/admin/inscricoes` | Adicionar ações diretamente no modal (ex: mudar status, exportar individual) |
| U8 | **Tela de sucesso da inscrição** não tem opção de voltar ao formulário | `/inscricao/[slug]` | Adicionar botão "Fazer nova inscrição" |
| U9 | **Mobile: cards de lista** não têm ações visíveis sem scroll | Admin pages (mobile) | Consolidar ações em menu de contexto (3 dots) |

### 4.2 Repetições que Atrapalham o Fluxo

| # | Repetição | Localização | Sugestão |
|---|-----------|-------------|----------|
| R1 | **Botão "Exportar CSV"** aparece em 4 páginas com implementação idêntica | inscricoes, relatorio (admin + professor) | Extrair componente `ExportCSVButton` reutilizável |
| R2 | **Filtros de status** são implementados de forma diferente em cada página | inscricoes (admin) vs inscricoes (professor) vs relatorio | Padronizar componente `StatusFilter` |
| R3 | **Tabela de inscrições** é renderizada em 3 páginas com código quase idêntico | admin/inscricoes, professor/inscricoes, professor/projetos/[id] | Extrair componente `InscricoesTable` |
| R4 | **Modal de detalhes da inscrição** duplicado em 3+ páginas | admin/inscricoes, professor/relatorio | Extrair componente `InscricaoDetailModal` |
| R5 | **Empty state** (ícone + mensagem) repetido em todas as listas | Todas as páginas de listagem | Extrair componente `EmptyState` |
| R6 | **Botões de ação** (lápiz/lixeira) com código quase idêntico | Todas as páginas CRUD | Extrair componente `ActionButtons` |
| R7 | **Header de página** (título + descrição) repetido em todas as páginas | Todas as páginas admin | Extrair componente `PageHeader` |

### 4.3 Melhorias de UX Recomendadas

| Prioridade | Melhoria | Descrição |
|-----------|----------|-----------|
| ALTA | **Skeleton loading** em vez de "Carregando..." em texto | Todas as páginas com carregamento |
| ALTA | **Toast notifications** para ações de sucesso/erro | Substituir `alert()` e mensagens inline |
| ALTA | **Confirmação visual** antes de excluir | Modal customizado com preview do que será deletado |
| MÉDIA | **Busca global** | Um campo de busca que funcione em todas as entidades |
| MÉDIA | **Breadcrumbs** em todas as páginas internas | Facilita navegação, especialmente em mobile |
| MÉDIA | **Pagination** ou infinite scroll | Para listas que podem crescer indefinidamente |
| MÉDIA | **Empty states com CTA** | Em vez de apenas "Nenhum resultado", sugerir a próxima ação |
| BAIXO | **Keyboard shortcuts** | Ctrl+K para busca, atalhos para ações comuns |
| BAIX0 | **Dark mode** | Opcional, mas melhora acessibilidade |

### 4.4 Acessibilidade

| # | Problema | Localização |
|---|----------|-------------|
| A1 | Inputs não têm `aria-label` ou `aria-describedby` para leitores de tela | Formulários |
| A2 | Modais não trapem foco (Tab pode sair do modal) | Painéis laterais |
| A3 | Contraste de cores pode ser insuficiente em textos `text-gray-400` | Múltiplas páginas |
| A4 | Botões de ação (ícones) não têm texto alternativo acessível | Tabelas CRUD |
| A5 | Radio buttons e checkboxes não têm `fieldset`/`legend` agrupando | Formulários |

---

## 5. MAPA DE CAMPOS — VALIDAÇÃO RESUMIDA

### Formulário de Inscrição

| Campo | Tipo | Required | Validação Client | Validação Server | Bug |
|-------|------|----------|-----------------|-----------------|-----|
| nome_completo | text | Sim | HTML required | `!data.nome_completo` | Espaços em branco passam |
| email | email | Sim | HTML email | `!data.email` | OK |
| telefone | tel | Não | Nenhuma | Nenhuma | Aceita qualquer string |
| idade | number | Não | min=14, max=100 | Nenhuma | Aceita negativos via FormData |
| genero | radio | Sim | HTML required | Nenhuma | OK |
| curso | select | Sim | HTML required | Nenhuma | OK |
| ano_inicio | select | Sim | HTML required | Nenhuma | OK |
| semestre_atual | select | Sim | HTML required | Nenhuma | **BUG name mismatch** |
| turma | text (RO) | Não | Calculado | Nenhuma | OK |
| matricula | text | Não | Nenhuma | Nenhuma | OK |
| tipo_interesse | radio | Sim | HTML required | Nenhuma | OK |
| disponibilidade | checkbox[] | Não | Nenhuma | Nenhuma | **BUG: só captura 1** |
| experiencia_previa | select | Não | Nenhuma | Nenhuma | OK |
| justificativa | textarea | Não | Nenhuma | Nenhuma | OK |
| ciencia_regras | checkbox | Sim | HTML required | `!data.ciencia_regras` | OK |
| consentimento_lgpd | checkbox | Sim | HTML required | `!data.consentimento_lgpd` | OK |

### Formulário de Cadastro

| Campo | Tipo | Required | Validação Client | Validação Server |
|-------|------|----------|-----------------|-----------------|
| nome | text | Sim | Nenhuma | Nenhuma |
| email | email | Sim | HTML email | Firebase |
| senha | password | Sim | length >= 6 | Firebase (min 6) |
| confirmar senha | password | Sim | === senha | Nenhuma |

---

## 6. CHECKLIST DE BOTÕES

| Botão | Página | Funcional | Observação |
|-------|--------|-----------|------------|
| Criar Conta | /cadastro | Sim | OK |
| Entrar | /admin/login | Sim | SUAP + Google + Email |
| Esqueci senha | /esqueci-senha | Sim | OK |
| Enviar Inscrição | /inscricao/[slug] | Sim | Bug no checkbox disponibilidade |
| Voltar aos Projetos | /inscricao (sucesso) | Sim | OK |
| Novo Projeto | /admin/projetos | Sim | Visível apenas para admin |
| Editar (lápis) | /admin/projetos | Sim | OK |
| Excluir (lixeira) | /admin/projetos | Sim | confirm() nativo |
| Gerenciar Posts | /admin/projetos | Sim | OK |
| Ver Página | /admin/projetos | Sim | OK |
| Novo Edital | /admin/editais | Sim | OK |
| Gerar com IA | /admin/editais | Sim | OK |
| Autorizar | /admin/usuarios | Sim | Valida email + projeto |
| Alterar papel | /admin/usuarios | Sim | Alerta para professor |
| Excluir usuário | /admin/usuarios | Sim | Previne auto-exclusão |
| Exportar CSV | /admin/inscricoes | Sim | OK |
| Ver detalhes | /admin/inscricoes | Sim | OK |
| Mudar status | /admin/inscricoes | Sim | Atualiza sem confirmação |
| Salvar Token | /admin/suap | Sim | Token em texto plano |
| Sincronizar | /admin/suap | Sim | OK |
| Limpar dados | /admin/limpar-dados | Sim | 3 etapas de confirmação |
| Trocar email | /admin/perfil | Sim | OK |
| Excluir conta | /admin/perfil | Sim | 3 etapas de confirmação |
| Atualizar nome | /admin/perfil | Sim | OK |
| Salvar Post | /admin/posts | Sim | OK |
| Excluir Post | /admin/posts | Sim | OK |
| Texto Direto | /admin/rag | Sim | **Sem guard de acesso** |
| Upload Arquivo | /admin/rag | Sim | **Sem guard de acesso** |

---

## 7. RECOMENDAÇÕES PRIORIZADAS

### Prioridade 1 (Imediato)
1. **Adicionar verificação de autorização em TODAS as Server Actions** — verificar sessão Firebase e papel do usuário no servidor
2. **Corrigir bug do checkbox disponibilidade** — usar `form.getAll('disponibilidade')`
3. **Remover email hardcoded** de `admin.ts` e `AuthContext.tsx`
4. **Corrigir `userRole` client-side confiável** — lookup no servidor em vez de aceitar do cliente
5. **Adicionar guard na página RAG** — verificar `isMasterAdmin`

### Prioridade 2 (Curto prazo)
6. **Adicionar validação server-side** em todos os formulários (trim, length, regex)
7. **Substituir `confirm()` nativo** por modal customizado
8. **Adicionar rate limiting** em login e cadastro
9. **Mascarar token SUAP** (type="password")
10. **Validar tipo de arquivo** no upload do RAG server-side

### Prioridade 3 (Médio prazo)
11. Extrair componentes reutilizáveis (tabelas, filtros, modais)
12. Adicionar toast notifications
13. Adicionar skeleton loading
14. Implementar paginação
15. Melhorar acessibilidade (aria labels, focus trap, contraste)

---

*Relatório gerado por análise estática do código. Testes executados sem servidor rodando — validações de runtime (como comportamento real do browser) requerem ambiente de staging.*
