# Plano de Testes e Validação — Portal Conecta 2.0

**Data:** 2026-08-26
**Contexto:** consolida o resultado da revisão dos relatórios antigos (`RELATORIO_TESTES.md`, `RELATORIO_USABILIDADE.md`, ambos de 2026-07-24) contra o estado atual do código, as correções aplicadas nesta rodada, e um plano de regressão repetível para validar o sistema — RAG (`ANALISE_E_PLANO_RAG.md`, Etapas 1-10) incluído.

---

## 0. ✅ Achado crítico resolvido — Firebase Authentication não estava provisionado

Ao testar a correção de verificação de sessão (seção 1), descobri que o **Firebase Authentication não estava habilitado** no projeto `portalconecta2-ab194` — chamadas básicas do Admin SDK (`listUsers()`, `getUserByEmail()`) falhavam com `"There is no configuration corresponding to the provided identifier"`, a mensagem padrão de quando ninguém nunca clicou em "Get Started" na aba Authentication do Console.

**Impacto (antes da correção):** ninguém conseguia logar (nem Google, nem SUAP) — o app inteiro ficava inacessível além das páginas públicas. Batia com uma nota já registrada no `ANALISE_E_PLANO_RAG.md` (Etapa 1): "login com Google via Firebase ainda não foi testado ponta a ponta" — agora sabemos por quê.

**Resolvido em 2026-08-26** — usuário habilitou Authentication + provedor Google no Console do Firebase. Confirmado por mim logo em seguida: gerei um token real (custom token do Admin SDK trocado por ID token via API do Identity Toolkit) e validei a verificação de sessão de ponta a ponta (ver seção 1) — funcionou. **Ainda vale testar o login de verdade pela UI** (botão "Entrar com Google") pra confirmar o fluxo completo do usuário, não só a API.

---

## 1. O que foi corrigido nesta rodada (2026-08-26)

### Segurança — autorização ausente ou pulável

Todos os itens abaixo seguiam o mesmo padrão de falha: uma Server Action que devia checar "o chamador tem permissão pra isso?" não checava nada, ou a checagem ficava dentro de um parâmetro **opcional** que bastava omitir pra pular.

| # | Onde | O que mudou |
|---|------|-------------|
| S1 | `src/actions/admin.ts` | `createProjeto`, `updateProjeto`, `deleteProjeto`, `createEdital`, `updateEdital`, `deleteEdital`, `createEvento`, `updateEvento`, `deleteEvento` agora exigem `callerEmail` e checam `role === 'ADMIN'` no servidor (helper `requireAdminEmail`). |
| — | `src/actions/admin.ts` | `createPost`/`updatePost`/`deletePost` (versão admin, diferente da versão em `professor.ts`) tinham um bug "fail-open": se o role não fosse detectado, a checagem de coordenador era pulada por inteiro (equivalente a acesso ADMIN). Agora nega por padrão. |
| S5, S6 | `src/actions/admin.ts` | `deleteUser`/`updateUserRole` só tinham auto-proteção (não excluir/promover a si mesmo), **nenhuma checagem de que o chamador é admin**. Qualquer chamada direta promovia qualquer usuário a ADMIN. Corrigido. |
| — | `src/actions/admin.ts` | `inviteUser` também ganhou a checagem (não estava nem no relatório original). |
| S10 | `src/actions/professor.ts` | `updateInscricaoStatus` — achado e corrigido na revisão de segurança da própria Etapa 10 do RAG. `userEmail` era opcional; sem ele, qualquer inscrição de qualquer projeto podia ter o status alterado sem autenticação. |
| S11 | `src/actions/professor.ts` | `exportInscricoesCSV` não tinha checagem nenhuma — qualquer `projetoId` exportava nome/email/telefone dos inscritos. Agora exige `userEmail` + é coordenador do projeto. Mudou de retornar `string` pra `{ok, csv}`/`{ok, error}` — os 5 pontos de chamada foram atualizados. |
| S19 | `src/actions/tags.ts` | `adicionarTagsProjeto`/`aprovarTag`/`removerTag` eram código morto (nenhuma página chama) mas continuavam invocáveis como Server Action direta, sem checagem nenhuma. Ganharam checagem de ADMIN. |
| — | `src/actions/admin.ts` | Removidas 5 funções mortas do RAG legado (`listRagDocuments`, `createRagDocument`, `deleteRagDocument`, `toggleRagDocument`, `chunkText`) — operavam em `RagDocumento`/`RagChunk`, substituídas por `documentos_kb`/`chunks_kb` desde a Etapa 2 do RAG, sem checagem de autorização, e sem nenhuma página chamando. |
| S3, S18, S20, S26 | `src/lib/auth-helpers.ts`, `src/actions/perfil.ts`, `src/actions/meus-dados.ts`, `src/actions/auth.ts` | **Correção arquitetural, não pontual — corrigida e validada com token real.** Novo helper `verifySessionToken(idToken)` verifica o ID token do Firebase no servidor via `firebase-admin` (`getAdminAuth().verifyIdToken`) e retorna o e-mail *verificado* do dono da sessão — nunca mais um parâmetro que o cliente afirma ser seu (não existe mais nenhum parâmetro de e-mail pra falsificar — a exfiltração entre usuários fica estruturalmente impossível, não só bloqueada por um `if`). Reescritas: `getMyProfile`, `updateMyName`, `deleteMyAccount`, `getMeuPerfilAluno`, `updateMeuPerfilAluno` (perfil.ts) e `getMinhasInscricoes`, `exportMinhasInscricoesCSV`, `solicitarExclusaoDados` (meus-dados.ts) — todas agora recebem `idToken` em vez de `email`. Call sites (`admin/perfil/page.tsx`, `meus-dados/page.tsx`) atualizados pra obter o token via `user.getIdToken()` (Firebase client SDK). `syncUserProfileAction`/`getCurrentUserAction` (S26/parte de S18) removidas — eram código morto sem nenhum caller. **Testado com token real** (gerado via Admin SDK + API do Identity Toolkit, depois que o Firebase Auth foi habilitado — seção 0): token válido retorna os dados certos do dono; token forjado ou ausente é negado (`null`/erro). |

### Segurança — correções pontuais

| # | Onde | O que mudou |
|---|------|-------------|
| S14 | `src/app/admin/suap/page.tsx` | Campo de colar o token SUAP virou `type="password"` (antes: texto plano na tela). |
| S16 | `src/app/esqueci-senha/page.tsx` | Mensagem de erro não revela mais se um e-mail tem conta cadastrada ou não (enumeração de usuário). |

### S9 — Gate de sessão real em `/admin` e `/professor` (era só client-side)

**O problema:** `middleware.ts` já dizia isso no próprio comentário — "a proteção real é feita no client". Sem sessão nenhuma, o servidor mandava o HTML inteiro da página protegida mesmo assim; quem bloqueava a navegação era um `useEffect` no React, *depois* da página já ter carregado.

**Por que não é trivial:** o middleware do Next roda em Edge Runtime, que não suporta `firebase-admin` (usa APIs do Node). A verificação de verdade só pode acontecer em Server Components/Actions (rodam em Node).

**Solução implementada:**
1. **Session cookie** (`src/lib/session.ts`, `src/app/api/auth/session/route.ts`): depois do login no Firebase (client), o `AuthContext` troca o ID token por um cookie `httpOnly` de 5 dias (`createSessionCookie` do Admin SDK). No logout, o cookie é limpo.
2. **Route groups**: `admin/(protected)/` e `professor/(protected)/` — cada um com seu próprio `layout.tsx` que verifica o cookie (`verifySessionCookie`) e redireciona pra `/login` se inválido/ausente, ou pra `/` se o role não for `ADMIN`/`PROFESSOR`. As páginas de login ficaram *fora* do grupo, então não entram nesse gate (evita redirect-loop).
   - **Tentativa anterior que não funcionou:** cheguei a implementar isso repassando o pathname via header do middleware (`x-pathname`) pra um layout compartilhado saber se estava na página de login. Funcionou em teoria (é um padrão documentado do Next.js) mas o header simplesmente não chegava no `headers()` do layout neste ambiente — depois de depurar, troquei pra route groups, que não dependem de header nenhum sendo repassado entre processos e são a forma mais robusta de resolver isso.
3. `AdminShell`/`ProfessorShell` mantidos como estavam (gate client-side original) — agora são a segunda camada, não a única.

**Testado com tokens reais** (gerados via Admin SDK, trocados por sessão real via `/api/auth/session`): sem sessão → redirect servidor pro login; sessão de `ESTUDANTE` → redirect pra `/`; sessão de `ADMIN` e de `PROFESSOR` → acesso liberado nos dois painéis (igual ao comportamento do `AdminShell`, que sempre permitiu os dois roles); cookie forjado → redirect. Build de produção (`npm run build`) rodou limpo com a nova estrutura de rotas.

### S13 — Rate limiting (login SUAP e inscrições)

Novo helper `src/lib/rate-limit.ts` + tabela `RateLimitHit` (banco, não memória — necessário porque o deploy roda em funções serverless sem estado compartilhado entre instâncias). Aplicado em:
- `/api/auth/suap-login` — 5 tentativas / 5 minutos por IP (esse endpoint repassa a senha direto pro SUAP; é o alvo natural de força bruta contra credencial institucional).
- `criarInscricao` — 10 inscrições / 10 minutos por IP (formulário público, alvo de spam).

**Testado:** 5 chamadas ao login SUAP passam (cada uma batendo de verdade na API do SUAP e recebendo 401 por credencial errada), a 6ª é bloqueada com `429` e mensagem clara. Mesmo padrão confirmado em `criarInscricao` (10 passam, 11ª bloqueada) — inclusive confirma que `headers()` funciona igual dentro de Server Actions e Route Handlers.

### S25 — CAPTCHA (Cloudflare Turnstile)

Novo `src/lib/turnstile.ts` + componente `<TurnstileWidget>` (`src/components/ui/turnstile-widget.tsx`), aplicados em `/cadastro` e `/inscricao/[slug]`. **Degrada graciosamente**: sem `TURNSTILE_SECRET_KEY`/`NEXT_PUBLIC_TURNSTILE_SITE_KEY` configuradas (são gratuitas — dash.cloudflare.com/?to=/:account/turnstile), o widget não renderiza e a verificação sempre passa — não bloqueia ninguém até você gerar as chaves.

`/cadastro` cria a conta direto no Firebase client-side (sem Server Action no meio), então precisou de uma rota nova (`/api/auth/verify-captcha`) pra verificar o token antes de deixar o cadastro seguir. `criarInscricao` (Server Action) verifica direto, sem rota extra.

**Testado:** comportamento sem as chaves configuradas (não bloqueia nada, formulários funcionam normalmente). **Não testado:** o bloqueio real de um CAPTCHA não resolvido — precisa das chaves de verdade, que só você pode gerar. Depois de configurar, vale testar: preencher o formulário sem resolver o desafio deve mostrar "Complete a verificação de segurança".

### Validação de formulário

| Onde | O que mudou |
|------|-------------|
| `src/actions/inscricao.ts` | Telefone (quando preenchido) agora valida formato — 8 a 15 dígitos, só caracteres de telefone válidos. |
| `src/app/inscricao/[slug]/page.tsx` | Removido um fallback morto/frágil no campo `semestre` (lia `form.get('semestre')`, mas o input real se chama `semestre_atual` — nunca funcionava, só não quebrava porque o campo é obrigatório antes de chegar lá). |

**Confirmado já corrigido antes desta sessão** (não precisou de ação): idade negativa, nome só com espaços, `userRole` client-side confiável, e-mail hardcoded de master admin, guard de acesso na página RAG, validação de nome em `perfil.ts`, checkbox de disponibilidade com múltiplos valores.

---

## 2. Como testar você mesmo (regressão manual)

Cheque cada item rodando `npm run dev` e usando a UI normalmente — ou, pra automação, o padrão usado durante esta sessão: subir uma rota de API temporária em `src/app/api/teste-x/route.ts` chamando a action diretamente, testar via `curl`, e apagar a rota depois (nunca deixar rotas de teste no repositório).

### 2.1 Autorização (o mais importante desta rodada)

- [ ] Logado como usuário comum (não ADMIN), tentar acessar `/admin/usuarios` e mudar o role de alguém pra ADMIN pela UI → deve estar bloqueado pela própria UI (gate client-side).
- [ ] Chamar `updateUserRole(userId, 'ADMIN', undefined, 'algum-email-qualquer@x.com')` diretamente (fora da UI) → deve retornar `{ok: false, error: 'Acesso negado: apenas administradores'}`.
- [ ] Chamar `deleteUser`, `createProjeto`, `updateProjeto`, `deleteProjeto`, `createEdital`, `updateEdital`, `deleteEdital`, `createEvento`, `updateEvento`, `deleteEvento` sem um `callerEmail` de ADMIN válido → todas devem negar.
- [ ] Logado como PROFESSOR coordenador do Projeto A, chamar `exportInscricoesCSV(projetoB_id, meu_email)` (projeto que não coordeno) → deve negar.
- [ ] Repetir o teste de `updateInscricaoStatus` sem `userEmail` (já validado na Etapa 10, mas vale reconferir após qualquer mudança futura em `professor.ts`).

### 2.2 Pipeline RAG (Etapas 1-6 do plano RAG)

- [ ] Subir um `.docx`/`.txt`/`.pdf` com texto real em `/admin/rag` → deve terminar em `status: indexed`.
- [ ] Conferir no banco: `chunks_kb.embedding` com 1536 dimensões, `documentos_kb.modelo_embedding = 'gemini-embedding-2'`.
- [ ] Perguntar pra IFizinha (`/api/chat` ou o widget do site) algo sobre o conteúdo do documento → resposta deve citar a fonte.
- [ ] Rodar a bateria de prompt injection documentada na Etapa 6 (instruction override, extração de system prompt, jailbreak via histórico forjado, injeção indireta via documento) — todos devem continuar bloqueados.
- [ ] Publicar um projeto (ver 2.4) → confirmar que o `DocumentoKb` tipo `projeto_sintetico` é gerado e a IFizinha passa a responder sobre ele.

### 2.3 Vagas (Etapa 7)

- [ ] Como coordenador, criar uma vaga com `quantidade: 1`.
- [ ] Inscrever 2 candidatos nessa vaga pelo formulário público.
- [ ] Selecionar o 1º candidato → deve funcionar. Selecionar o 2º → deve ser bloqueado ("vaga lotada").
- [ ] Tentar excluir a vaga com inscrições vinculadas → deve ser bloqueado, sugerindo encerrar em vez de excluir.

### 2.4 Publicação (lacuna da Etapa 5, resolvida na Etapa 10)

- [ ] Criar um projeto/edital pelo painel admin → deve nascer com badge "Publicado" já visível na lista, e aparecer em `/projetos` ou `/editais` (páginas públicas).
- [ ] Clicar no botão de olho (despublicar) → projeto/edital some das páginas públicas; badge muda pra "Rascunho".
- [ ] Rodar uma sincronização do SUAP (dry-run é seguro) → projetos/editais novos devem nascer publicados; os que já existiam e foram despublicados manualmente **não** devem ser republicados pelo sync.

### 2.5 PerfilAluno (Etapa 8)

- [ ] Logado como estudante, em `/meus-dados`, preencher e salvar o "Meu Perfil".
- [ ] Recarregar a página → dados devem persistir.
- [ ] Colocar um link de Lattes sem `http(s)://` → deve ser rejeitado com mensagem clara.

### 2.6 Formulário de inscrição

- [ ] Telefone com letras (ex: "abc123") → deve ser rejeitado.
- [ ] Telefone válido (ex: "(43) 99999-0000") → deve passar.
- [ ] Conferir que o campo semestre grava corretamente no protocolo gerado (ex: "2026.1").

---

## 3. Backlog priorizado — o que ficou pendente e por quê

Todos os itens arquiteturais que estavam aqui (verificação real de sessão — S3/S9/S18/S20/S26 — e rate limiting/CAPTCHA — S13/S25) **foram resolvidos** nesta mesma rodada, ver seção 1. Só ficaram pendentes itens de decisão de produto e polish de UX, nenhum deles bloqueador de segurança.

### 3.1 Decisões de produto, não bugs

- **S7** — `syncProjectAdmins` promove a PROFESSOR sem pedir consentimento (já é revogável desde a Etapa 9, mas a promoção em si continua automática). Decisão: manter assim, ou exigir que o próprio usuário aceite virar PROFESSOR?
- **S12** — vincular SUAP+Google auto-atribui PROFESSOR pra qualquer um, independente do cargo real. Precisa de uma regra de negócio melhor (ex.: consultar o cargo real via API do SUAP).
- **S17** — `listProjetos()` sem filtro de auth interno, mas o dado (nome/coordenador de projeto) já é majoritariamente público. Baixo risco, mas vale revisar se algum campo sensível vazar ali no futuro.
- **S23** — sem paginação em listas de usuários/projetos/editais/posts — vira problema de performance quando o volume crescer, não é uma questão de segurança.

### 3.2 Prioridade baixa — polish de UX, não corrigido nesta rodada

Do `RELATORIO_USABILIDADE.md` (26 itens, nenhum tocado nesta rodada — são refatoração/design, não bugs):

- **Maior ganho por esforço:** extrair `<EmptyState>`, `<ActionButtons>` e `<ExportCSVButton>` (baixa complexidade, elimina duplicação em 5+ páginas cada).
- **S22 remanescente:** `professor/projetos/[id]/page.tsx` ainda usa `confirm()`/`alert()` nativos em vez do `<ConfirmDialog>` já usado nas outras 7 páginas — é a exceção fácil de igualar.
- **Acessibilidade (A1-A5):** `aria-label` em botões de ícone e associação `label`/`id` em inputs são baixo esforço e alto valor; focus trap em modais e contraste de cor (`text-gray-400` → `text-gray-500`) exigem mais atenção.
- **Maior escopo, decisão de design:** consistência visual (C1-C4 — paleta de botões, bordas, tipografia) e as extrações maiores (`<InscricoesTable>`, `<FilterBar>`) — valem uma rodada própria de design system, não uma correção pontual.
- **Infraestrutura:** paginação (P2), skeleton loading (P1), busca global (P3) — funcionalidades novas, não bugs.

---

## 4. Arquivos relacionados

- `ANALISE_E_PLANO_RAG.md` — plano e log completo das Etapas 1-10 do RAG (pipeline, prompt injection, Vagas, PerfilAluno, publicação, observabilidade, revisão de segurança).
- `RELATORIO_TESTES.md` — relatório original de QA/segurança (2026-07-24), agora com status atualizado item a item na seção 3.
- `RELATORIO_USABILIDADE.md` — relatório original de UI/UX (2026-07-24), ainda válido como está — nenhum item foi tratado nesta rodada.
