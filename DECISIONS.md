# DECISIONS.md — Divergências do SPEC

**Propósito:** Registrar decisões arquiteturais onde o projeto existente diverge do SPEC.md, com justificativas.

---

## 1. Backend: Prisma + Firebase vs. Supabase puro

**SPEC (§2.3):**  
→ Backend: Supabase (Postgres + Auth + Storage + Edge Functions + pgvector)

**Decisão:**  
→ **Manter Prisma + PostgreSQL + Firebase Auth + NextAuth**

**Justificativa:**  
- Projeto já tem investimento em Prisma ORM, NextAuth, e Firebase Authentication.
- Stack é viável e amplamente testada; migração para Supabase puro causaria refatoração massiva (trocar ORM, auth, redefinir RLS).
- **Tradeoff:** Perde nativamente: Supabase Storage (use Firebase Storage ou S3), Edge Functions (use Vercel Functions / Next.js API routes), pgvector integrado (use API de embeddings externa + PostgreSQL vector extension manualmente).

**Implementação:**
- RLS nativa do Postgres será habilitada, mas validação de permissões ocorrerá no Prisma / servidor via campos `userId` e relações.
- Storage: Firebase Storage para PDFs + arquivos.
- Edge Functions: Next.js API routes + `/api` folder e server actions.
- Embeddings: API Anthropic (Claude) + extensão `vector` do Postgres (manual).

**Registrado em:** DECISIONS.md (este arquivo)  
**Impacto:** §2.3, §3.8, §5.3, §7, §8, §10.1

---

## 2. Autenticação: Firebase Auth + NextAuth vs. Google OAuth puro

**SPEC (§4.1):**  
→ Google OAuth (qualquer e-mail para estudante, `@ifpr.edu.br` para professor)

**Decisão:**  
→ **Manter Firebase Auth + NextAuth**, adicionar restrição `@ifpr.edu.br` em lógica de aplicação

**Justificativa:**  
- Projeto já usa Firebase; integração com Supabase Auth exigiria mudança de auth provider.
- NextAuth abstrai detalhes; trocar por Supabase Auth é refatoração de autenticação global.

**Implementação:**
- Signup via Google (Firebase) → criar `User` no Prisma com `role = VISITANTE`.
- Se e-mail termina em `@ifpr.edu.br` E coordena projetos no SUAP → `role = PROFESSOR` (verificação em sync SUAP).
- Admin: seed list em `.env` (`ADMIN_EMAILS`).
- RLS: validar `user.role` em queries do lado do servidor (Prisma + server actions).

---

## 3. Enums de role: Mismatch com SPEC

**SPEC (§3.1):**  
→ `create type user_role as enum ('estudante', 'professor', 'admin');`

**Atual (Prisma):**
```prisma
enum UserRole {
  VISITANTE
  EDITOR_IFIZINHA
  EQUIPE_PROJETO
  ADMINISTRADOR
}
```

**Decisão:**  
→ **Manter 7 valores por agora** (inclui legados: VISITANTE, EDITOR_IFIZINHA, EQUIPE_PROJETO, ADMINISTRADOR)
→ **Limpar em Fase 2** quando o fluxo de auth estiver completo

**Justificativa:**  
- AuthContext.tsx usa valores legados (`ADMINISTRADOR`, `EDITOR_IFIZINHA`, `EQUIPE_PROJETO`)
- Mudar agora quebra o login existente
- Limpeza segura apenas após migração de todos os usuários

**Implementação:**
```prisma
enum UserRole {
  ESTUDANTE      // Google auth qualquer domínio
  PROFESSOR      // Google @ifpr.edu.br + vínculo SUAP
  ADMIN          // Seed list
  // Legados (remover Fase 2):
  VISITANTE      // → migrar para ESTUDANTE
  EDITOR_IFIZINHA // → migrar para ADMIN
  EQUIPE_PROJETO  // → migrar para PROFESSOR
  ADMINISTRADOR   // → migrar para ADMIN
}
```

**Registrado em:** DECISIONS.md  
**Impacto:** AuthContext.tsx, toda lógica de role

---

## 4. Modelo de dados: Redução de complexidade inicial

**Decisão:**  
→ Implementar Fase 1 (§16) com **subset de tabelas**, expandir em fases posteriores

**Tabelas Fase 1 (existentes):**
- `User` (aprimorado com campos profile + SUAP) ✅
- `Projeto` (aprimorado com enums + review_status) ✅
- `Edital` (aprimorado com enums + review_status) ✅
- `Evento` ✅
- `Post` ✅
- `SyncLog` (renomear para `SuapSyncRecord` — pendente)
- `ProjectCoordinator`, `UserPermission`, `Inscricao`, `Job`, `RagDocumento`, `RagChunk`, `ChatSessao`, `ChatMensagem`, `IaRevisao`, `SiteConfig`, `AuditLog` ✅

**Tabelas ausentes (adicionar em Fase 2+):**  
→ `projeto_tags`, `projeto_cursos`, `projeto_faq`, `edital_tags`, `edital_explicacao`, `edital_resumo_versoes`, `alertas_interesse`, `favoritos`, `notificacoes`

**Justificativa:** MVP focado; evita schema bloat; mantém releases incrementais.

---

## 4.1 Enums legados: StatusProjeto e StatusEdital

**SPEC (§3.1):**
→ `StatusProjeto`: 6 valores (ativo, em_execucao, encerrado, suspenso, inscricoes_abertas, sem_vagas)
→ `StatusEdital`: 7 valores (em_breve, aberto, em_analise, resultado_parcial, prazo_recurso, resultado_publicado, encerrado)

**Atual (Prisma):**
→ `StatusProjeto`: 9 valores (inclui ENVIADO_2026, CONCLUIDO, INATIVADO)
→ `StatusEdital`: 9 valores (inclui ATIVO, ENCERRA_BREVE, ENCERRADO, RESULTADO_PUBLICADO)

**Decisão:**
→ **Manter valores legados** até migração de dados existentes
→ **Limpar em Fase 2** quando dados SUAP estiverem sincronizados

**Justificativa:**
- Dados existentes no banco usam valores legados
- Mudar agora quebra queries existentes
- Migração segura: mapear ENVIADO_2026→EM_EXECUCAO, CONCLUIDO→ENCERRADO, etc.

---

## 5. RLS (Row Level Security)

**SPEC (§4.4):**  
→ RLS nativo do Postgres via políticas SQL

**Decisão:**  
→ **Implementar validação de permissões no Prisma + server actions** (simulação de RLS)

**Justificativa:**  
- RLS nativa requer Supabase Auth com `auth.uid()`.
- Com Firebase, `auth.uid()` não está disponível no Postgres automaticamente.
- Alternativa: Validar `userId` e `role` no servidor antes de cada query Prisma.

**Implementação:**
```typescript
// src/lib/auth.ts — helper de autorização
export async function requireRole(userId: string, requiredRole: UserRole) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== requiredRole) throw new Error('Unauthorized');
}

export async function requireProjectCoordinator(userId: string, projectId: string) {
  const isCoordinator = await db.projectCoordinators.findUnique({
    where: { projeto_id_user_id: { projeto_id: projectId, user_id: userId } }
  });
  if (!isCoordinator) throw new Error('Unauthorized');
}
```

---

## 6. Processamento assíncrono: Fila de jobs

**SPEC (§10.1, §3.9):**  
→ Fila `jobs` em tabela Postgres + `pg_cron` / Edge Functions agendadas

**Decisão:**  
→ **Tabela `Job` + worker manual** (pode escalar para Bull/BullMQ depois)

**Justificativa:**  
- `pg_cron` requer extensão Postgres especial; pode não estar disponível em Supabase free.
- Bull/BullMQ adicionaria dependência Redis.
- Solução simples: tabela `Job` + Vercel Functions / cron interno (Next.js 15+) ou worker externo.

**Implementação:**
- Tabela `Job` com `status` (pendente | processando | ok | erro).
- Server action dispara insert em `Job`; responde imediatamente ao cliente.
- Worker assíncrono (Node.js simples ou cronjob externo) verifica pendentes a cada N segundos.

---

## 7. Calendário acadêmico: Dados reais vs. fabricados

**SPEC (§5.4, §0.2):**  
→ Calendário Acadêmico Oficial do Campus Ivaiporã deve ser **importado do documento oficial**, não fabricado.

**Decisão:**  
→ **Deixar TODO explícito; criar estrutura para import; inicializar com dados de exemplo** até obter oficial.

**Implementação:**
- Arquivo `docs/calendario_ifpr_ivaipora_2026.pdf` (ou `.xlsx`) será ponto de ingestão.
- Script `scripts/import-calendar.ts` fará parse e inserção em tabela `Evento`.
- TODO comentário em código: `// TODO: Substituir por import do calendário oficial do Campus Ivaiporã`.

---

## 8. Variáveis de ambiente

**Decisão:**  
→ Adicionar seções novas em `.env.example`:

```bash
# BANCO
SUPABASE_URL=              # ou deixar vazio; usar DIRECT_URL
SUPABASE_SERVICE_ROLE_KEY= # opcional; usar apenas para admin tasks

# IA
ANTHROPIC_API_KEY=         # Claude API
EMBEDDING_MODEL=text-embedding-3-small  # OpenAI ou Anthropic (definir)

# ADMIN
ADMIN_EMAILS=admin@ifpr.edu.br,admin2@ifpr.edu.br

# FEATURES
WHATSAPP_ENABLED=false
SUAP_ENABLED=true
```

---

## 9. Implementação de Fases

**SPEC (§16):**  
→ Fases 1–6 de desenvolvimento

**Decisão:**  
→ Fase 1 (MVP): Fundação + home configurável + projetos + editais + agenda  
→ Fases 2–6: Conforme roadmap, incrementalmente

**Registro:** Ver ROADMAP.md (arquivo separado) ou comments no código.

---

## 10. Soft delete vs. Hard delete

**SPEC (§3):**  
→ `deleted_at timestamptz` para editais, projetos, posts (soft delete para histórico)

**Decisão:**  
→ **Implementar soft delete em `Edital`, `Projeto`, `Post`; hard delete em outros**

**Implementação:**
```prisma
model Edital {
  // ...
  deleted_at DateTime?
  @@index([deleted_at])
}

// Nas queries: WHERE deleted_at IS NULL
```

---

## 11. Hospedagem: VPS própria vs. Vercel + Supabase

**Contexto (2026, pré-lançamento):**
→ O sistema estava implantado na Vercel, com banco no Supabase (`uodkwdaruqrnprqkpgqr`,
org "DebysBru's Org", compute NANO, região `aws-1-sa-east-1`).

**Decisão:**
→ **Hospedar tudo na VPS própria** (RackNerd, `198.44.123.154`, nginx 1.20.1,
que já serve outros projetos sob `ifcoding.com.br`): aplicação Next.js,
**PostgreSQL local com pgvector** e **armazenamento de arquivos em disco**.

**Justificativa:**
- **Limite de upload:** a Vercel corta o corpo da requisição em ~4,5 MB. O requisito
  é 10 MB para PDF e 5 MB para imagem, o que **não é atingível** sem contornar a
  plataforma (upload direto do navegador para a VPS).
- **Armazenamento:** "guardar no próprio servidor" é incompatível com função
  serverless — o filesystem é somente leitura exceto `/tmp`, que é efêmero e não
  compartilhado entre invocações. Comprovação: a rota `api/admin/suap/token`
  grava `.suap-token.json` e **sempre falha** na Vercel.
- **pgvector:** no Supabase, instalar a extensão é uma ação manual no painel e
  nunca foi feita — deixando o RAG em fallback silencioso. Em Postgres próprio
  vira `CREATE EXTENSION vector;`.
- **Latência e pooler:** o app serverless exigia o pooler do Supabase; com o
  banco no mesmo host, a conexão é local.
- **Pausa por inatividade:** o cron `keep-db-alive` existe só por causa do
  Supabase. Um Postgres local nunca pausa — o cron deixa de ser necessário.
- **Autonomia:** banco e repositório estavam em contas de terceiros. App, dados
  e arquivos passam a ficar sob controle do projeto.

**Tradeoff aceito:**
- **Backup passa a ser responsabilidade do projeto.** Sem o Supabase não há
  backup gerenciado (o painel mostrava "No backups"). O script está em
  `deploy/MIGRACAO_SUPABASE_PARA_VPS.md` §5 e **precisa ser testado** pelo menos
  uma vez restaurando num banco descartável.
- A VPS é ponto único de falha (app + banco + arquivos no mesmo host), o que não
  era o caso com Vercel + Supabase separados.

**Implementação:**
- `deploy/setup-postgres-local.sh` — PostgreSQL 16 (repo oficial PGCG) + `postgresql-16-pgvector`
- `deploy/setup-portal-subdomain.sh` + `deploy/nginx-portal.ifcoding.com.br.conf` — vhost e TLS do subdomínio
- `deploy/MIGRACAO_SUPABASE_PARA_VPS.md` — dump/restore, `.env`, backup, checklist
- `src/lib/file-storage.ts` — armazenamento local (10 MB PDF / 5 MB imagem)
- `src/app/api/files/upload/route.ts` — upload autenticado

**Repositório canônico:** `github.com/profronan16/PortalConecta2.0`
(a Vercel estava conectada a `DebysBru/PortalConecta2.0` — divergência que será
eliminada junto com a saída da Vercel).

**Registrado em:** DECISIONS.md (este arquivo)
**Impacto:** §2.3, §3.8, §5.3, §7, §8, §10.1 (e substitui o item "Storage:
Firebase Storage" da Decisão 1)

---

## 12. Editais: professor publica, admin modera

**Contexto:**
→ Publicar edital era exclusivo do Administrador Geral (`createEdital` em
`src/actions/admin.ts`). O painel do professor não tinha **nenhuma** função de
edital, apesar do requisito de que o professor publica os editais dos seus
projetos.

**Decisão:**
→ **Professor publica editais vinculados aos seus próprios projetos; o
Administrador Geral mantém a válvula de moderação.**

**Implementação:**
- `Edital.projetoId` (opcional, `onDelete: SetNull`) + relação inversa `Projeto.editais`.
  Editais institucionais sem projeto continuam válidos.
- Autorização em `podeGerenciarEdital`: admin passa sempre; professor só se for
  coordenador/vice/admin do projeto do edital **ou** o autor original. Trocar o
  `projetoId` para projeto alheio é bloqueado.
- Edital nasce `review_status: 'PUBLICADO'`, que é a condição exigida pela
  página pública `/editais`. O professor pode despublicar; o admin também, pelo
  painel dele.
- Slug com sufixo de timestamp (o admin usa apenas `slugify` e colide com título
  repetido).
- Excluir o edital remove o PDF do disco **depois** do registro sair do banco,
  para não deixar registro apontando para arquivo inexistente.

**Registrado em:** DECISIONS.md (este arquivo)
**Impacto:** §3.2 (editais), painel do professor

---

## 13. Armazenamento de arquivos: disco local servido pelo nginx

**Decisão:**
→ **Arquivos no disco da VPS** (`STORAGE_ROOT`, padrão `/var/www/portal-files`),
servidos diretamente pelo nginx em `/files/`, **sem** passar pelo processo Node.

**Limites:** PDF 10 MB · PNG/JPG/WEBP/GIF 5 MB.

**Justificativa de segurança** (todo arquivo vem de upload de usuário e é
servido publicamente — é o vetor de ataque mais óbvio):
1. **O nome original nunca toca o disco** — nome físico é UUID + extensão
   derivada do tipo validado. Elimina travessia de diretório e nomes maliciosos.
2. **Tipo detectado por magic bytes**, não por `file.type` nem pela extensão —
   ambos controlados pelo cliente.
3. **Travessia conferida de novo** no caminho resolvido (`path.relative` não
   pode começar com `..`), como defesa em profundidade.
4. Nginx **bloqueia execução** de `.php/.sh/.js/.html/.svg` dentro de `/files/`
   e força PDF como `attachment` com `X-Content-Type-Options: nosniff`.

**Tradeoff:** servir pelo nginx em vez do Node significa que um arquivo público
não passa por checagem de sessão. Aceito porque o conteúdo (editais e imagens de
posts) é público por natureza; **se algum dia for necessário arquivo
restringido, ele não pode entrar em `/files/`** — precisa de rota autenticada.

**Registrado em:** DECISIONS.md (este arquivo)

---

## 14. Sync SUAP: manual, sem cron e sem tratamento de conflitos

**Contexto:**
→ O ROADMAP previa **5.4** sync agendada (cron) e **5.6** tratamento de conflitos de sincronização.

**Decisão (2026-09-16):**
→ **Remover os dois itens do escopo.**

**Justificativa:**
- A sync agendada depende de informações/credenciais que só o responsável possui e não devem ser automatizadas sem supervisão.
- No fluxo adotado (sync manual, disparada pelo admin e revisada em seguida), não existe cenário legítimo de conflito automático — o tratamento de conflitos resolveria um problema que não ocorre.

**Implementação:**
- Sync permanece **manual**, via `/api/suap/sync/projetos`, `/api/suap/sync/editais` e botões em `SyncButtons`.
- O único cron do projeto continua sendo `/api/cron/keep-db-alive` (evita pause do Supabase por inatividade).
- Permanece no escopo apenas **5.5** (proteção de edição manual: re-sync não deve sobrescrever campos editados no admin).

**Registrado em:** DECISIONS.md + DOCUMENTACAO/ROADMAP.md
**Impacto:** Fase 5 do roadmap

---

## 15. Mensagens de alerta e erro: catálogo central e proibição de vazar erro técnico

**Contexto:**
→ As mensagens exibidas ao usuário estavam escritas à mão em dezenas de arquivos
(páginas, server actions e rotas de API). O resultado era tom inconsistente — a mesma
recusa aparecia como `Acesso negado` (25 ocorrências), `Não autenticado` (14),
`Acesso negado: você não é coordenador deste projeto` (7), todas secas e sem próximo
passo — e, principalmente, **vazamento de erro técnico para a tela**: nomes de
variáveis de ambiente (`DEEPSEEK_API_KEY`, `RESEND_API_KEY`, `GEMINI_API_KEY`,
`ADMIN_EMAILS`, `SUAP_*`, `FIREBASE_ADMIN_*`), mensagens cruas de Prisma/Postgres
(incluindo host/porta), da API do DeepSeek (em inglês), caminhos absolutos de disco
(`ENOENT`/`EACCES`) e a matrícula do usuário do SUAP.

**Decisão (2026-08-27):**
→ **Centralizar em `src/lib/mensagens.ts`** e tratar o vazamento como bug: nenhum
texto de biblioteca de terceiros pode chegar à interface.

**Justificativa:**
- O portal declara no SPEC (§1) "linguagem amigável" como pilar de produto. Um
  `P1001: Can't reach database server at ...` na tela contradiz o próprio produto.
- Vazar nome de variável de ambiente revela a infraestrutura e sugere ao usuário uma
  ação impossível ("configure X no .env").
- Texto técnico não é acionável: o usuário não sabe o que fazer, então tende a
  abandonar o cadastro/inscrição — exatamente o fluxo que o portal precisa proteger.
- Sem módulo único, cada correção de tom virava uma edição em 30 arquivos.

**Implementação:**
- `src/lib/mensagens.ts`: catálogo (`MENSAGENS`), regras de escrita e os tradutores
  `mensagemAmigavel(erro, fallback)` e `mensagemDeErroServidor(...)`. Inclui uma
  tabela de padrões técnicos (Prisma, Firebase, IA, rede, SUAP) e dois bloqueios
  (`TERMOS_TECNICOS`, `VARIAVEIS_AMBIENTE`). **Compartilhado por client e server** —
  não pode importar `@prisma/client` nem módulos `server-only`.
- `src/lib/use-mensagem-erro.ts`: hook que substitui `useState('')` do estado de erro
  e normaliza tudo que entra nele. Mantém `setError('')` funcionando.
- Normalização nas fronteiras de exibição: `toast.tsx` (todo toast de erro passa pelo
  tradutor) e o hook acima nas telas de painel.
- `translatePrismaError` (em `src/lib/utils.ts`) passou a devolver as constantes do
  catálogo.
- Mensagens internas de `src/lib/llm.ts`, `embeddings.ts`, `suap-api.ts` e
  `firebase-admin.ts` foram mantidas **técnicas de propósito**: elas não são
  renderizadas — servem ao log e a quem configura o ambiente — e todo ponto de saída
  para o usuário passa pelo tradutor.
- Erros persistidos no banco (`Job.erro`, `DocumentoKb.erro`) e exibidos no painel
  admin também são gravados já na versão amigável.

**Efeito colateral aceito:** 7 testes que faziam asserção sobre o texto literal foram
ajustados para afirmar a **intenção** (ex.: "a mensagem orienta a escolher um canal"
em vez de "contém 'Canal inválido'"). Dois testes foram o caso inverso — revelaram
perda real de informação, e o código foi corrigido em vez do teste: o relatório de
sync SUAP voltou a preservar o motivo legível da falha (`SUAP fora do ar`), e o
rate limit de inscrição manteve "muitas inscrições" em vez de ser trocado por um
genérico.

**Registrado em:** DECISIONS.md
**Impacto:** rodapé transversal — `src/lib/`, `src/actions/`, `src/app/api/`,
`src/app/**/page.tsx`, `src/components/ui/toast.tsx`

---

## 16. Perfil acadêmico do estudante e resposta à convocação

**Pedido:** "a tela de perfil precisa que Curso seja uma lista dropdown (select). Ao
invés de turma, deve selecionar o Ano de Ingresso. O semestre também deve ser uma
lista de 1º a 10º semestre. Se a pessoa tiver logada, na hora de se cadastrar em uma
bolsa, já deve puxar todos esses dados (a cada semestre, ir atualizando
automaticamente para o semestre atual). Na área de inscrição, o aluno pode desistir
de uma inscrição e receber atualizações por lá (aceitar convocação, etc)."

### 16.1 Um único catálogo de cursos (`src/lib/perfil-academico.ts`)

A lista de cursos existia **só** dentro de `src/app/inscricao/[slug]/page.tsx`; o
perfil aceitava "Curso" como texto livre. O mesmo aluno aparecia como
"Informática" em uma tela e "Informática Integrado" na outra, e a validação do
servidor não tinha como recusar valor inventado.

O catálogo passou para um módulo **puro** (sem Prisma, sem React), com os grupos
usados no `<optgroup>` e uma lista achatada para validar o que chega do formulário.
O módulo é a fonte única para a inscrição, o perfil e a Server Action. Curso fora
do catálogo já gravado (dado antigo) continua sendo exibido como opção extra, para
o estudante não perder o valor ao salvar.

### 16.2 Semestre que avança sozinho, sem cron

`PerfilAluno` ganhou `anoIngresso` (substitui o campo livre "Turma") e
`semestreAtual` (1..10) **junto com a data em que foi informado**
(`semestreReferencia`). O semestre "de hoje" é calculado na leitura:
`semestreAtual + (semestres letivos entre a referência e hoje)`, com 1º semestre =
jan–jun e 2º = jul–dez.

Por que assim, e não com um job que incrementa todo mundo a cada semestre:

- não precisa de cron/agendador (o projeto não tem nenhum — a fila de jobs é
  manual, ver Dec. 6) nem de tabela de calendário acadêmico oficial (Dec. 7);
- é determinístico e testável (tests/perfil-academico.test.ts);
- **nunca regride** (relógio para trás ou referência futura devolvem o valor
  informado) e **satura no 10º** em vez de virar "15º semestre" com dado antigo;
- sem semestre informado devolve `null` — o portal não inventa.

O formato histórico de `Inscricao.semestre` (`"2024.5"` = entrou em 2024, 5º
semestre) foi mantido: relatórios, CSV e as telas de professor/admin já exibem
esse texto. A conversão ficou em `formatarSemestreInscricao`/`parseSemestreInscricao`,
o que também permitiu **aproveitar o dado antigo**: quem só tem `turma` ("Turma
2024") ou `semestre` ("2024.5") no perfil tem os dois lidos como fallback
(`fonteDeLegado`) e pré-preenchidos, sem redigitar nada.

### 16.3 Pré-preenchimento da inscrição

`getDadosAcademicosInscricao` (Server Action) junta, campo a campo e em ordem de
precedência, **perfil novo → colunas legadas do perfil → última inscrição**
(`mesclarFontesAcademicas`). Isso importa porque é comum ter curso no perfil e
matrícula só na inscrição antiga: a precedência é por campo, não tudo-ou-nada.

A página de inscrição passou a esperar o Firebase dizer quem é o usuário antes de
renderizar o formulário (`authCarregando`): os campos usam `defaultValue`, então
renderizar antes do perfil chegar deixaria tudo em branco para quem está logado —
exatamente o caso que o pedido queria resolver. Visitante sem login segue
preenchendo à mão, e um aviso azul explica que os dados vieram do perfil.

### 16.4 Desistir e responder convocação (status x resposta do aluno)

A resposta do estudante ficou em colunas **próprias** (`resposta_aluno`,
`respondido_em`, `desistiu_em`), **não** em novos valores de `Inscricao.status`.
Motivo: o status é a decisão do coordenador e é o que já alimenta as contagens de
vaga por `status = 'selecionado'`, os gráficos de relatório (`STATUS_INSCRICAO`),
os filtros das três telas de gestão e os e-mails. Criar status novos
("convite_aceito", "convite_recusado") obrigaria a mexer em todos esses pontos de
uma vez — e um deles (contagem de vaga) quebraria em silêncio.

Regras:

| Ação | Status antes | Depois |
|---|---|---|
| Aceitar convocação | `selecionado` | `selecionado` + `resposta_aluno = 'aceito'` |
| Recusar convocação | `selecionado` | `desistente` + `resposta_aluno = 'recusado'` |
| Desistir | qualquer exceto `desistente`/`nao_selecionado` | `desistente` |

Recusar derruba o status para `desistente` porque **a vaga precisa voltar a contar
como livre**; `resposta_aluno = 'recusado'` é o que preserva a diferença entre
"recusou o convite" e "desistiu depois de aceitar". Não é possível desistir de uma
inscrição já encerrada como `nao_selecionado`: trocar por `desistente` só perderia
informação. A resposta é definitiva pelo portal (quem errou fala com a coordenação,
que muda pelo painel) para o coordenador não agir sobre uma resposta que já mudou.

As regras vivem em `src/lib/inscricao-aluno.ts` (puro) porque decidem duas coisas:
**quais botões aparecem** na tela e **o que o servidor aceita**. Foi assim que o
clássico "o botão aparece mas o servidor recusa" ficou impossível.

Posse: toda ação confere que a inscrição é do usuário da sessão (`user_id` **ou**
e-mail gravado, a mesma regra que "Meus Dados" usa para listar) — confiar no id
vindo do cliente deixaria qualquer um desistir da vaga de outra pessoa (mesma
família dos achados S3/S18/S20 do RELATORIO_TESTES.md).

### 16.5 Avisos nos dois sentidos

- O coordenador é avisado **no portal** (`notificarCoordenadoresDoProjeto`) quando
  alguém aceita, recusa ou desiste — antes ele só descobriria abrindo a lista do
  projeto por acaso. Também fica `AuditLog` (quem desistiu libera vaga).
- O aluno recebe as mudanças de status na área de inscrição: o aviso do sino
  agora aponta para `/meus-dados` (onde ficam os botões de resposta) em vez da
  página do projeto, e "Meus Dados" ganhou o cartão "Atualizações" com os mesmos
  avisos, ao lado das inscrições.
- A resposta do aluno aparece para a coordenação na lista do projeto, no detalhe
  da inscrição (professor e admin) e no CSV exportado.

**Banco:** `prisma/perfil-academico-setup.sql` (idempotente) adiciona as colunas e
migra `turma`/`semestre` antigos para as colunas novas. **`prisma db push` continua
proibido** neste banco (Dec. 11 / DOCUMENTACAO/MIGRACAO_POSTGRES_LOCAL.md).

**Registrado em:** DECISIONS.md
**Impacto:** `prisma/schema.prisma`, `prisma/perfil-academico-setup.sql`,
`src/lib/perfil-academico.ts`, `src/lib/inscricao-aluno.ts`,
`src/actions/perfil.ts`, `src/actions/minhas-inscricoes.ts`,
`src/actions/meus-dados.ts`, `src/actions/professor.ts`, `src/lib/notificacoes.ts`,
`src/app/meus-dados/page.tsx`, `src/app/inscricao/[slug]/page.tsx`,
telas de professor/admin de inscrições

---

## 17. Seleção por vaga: o bloqueio precisa dizer QUEM ocupa

**Relato:** "mudei um aluno de selecionado para desistente e mesmo assim não
deixou eu colocar outro aluno como selecionado."

**Diagnóstico:** o bloqueio estava certo. A cota é por VAGA
(`Inscricao.vaga_id` + `status = 'selecionado'`), e o bloqueio só é conferido
quando o status de destino é `selecionado`. Quem estava com a vaga era **outra
inscrição da mesma vaga** — inclusive em dados antigos com mais selecionados do
que posições. O dump de produção restaurado localmente mostra o caso exato:
"Bolsista — Monitoria de Robótica" com `quantidade = 1` e **dois** selecionados
(Carla Mendes Oliveira e Felipe Andrade Rocha). Tirar Carla não liberou nada,
porque Felipe continuava marcado.

A mensagem antiga (`A vaga "X" já está com todas as N posições preenchidas`)
não dizia de quem era a vaga, então não havia como entender o bloqueio nem o
que fazer. Não era um problema de regra: era de **informação**.

**Correção (sem afrouxar a regra):**

1. `mensagemVagaLotada` (`src/lib/vagas.ts`, puro e testado) passou a **nomear
   quem está selecionado**, com protocolo, e — quando a vaga tem mais
   selecionados do que posições — dizer que isso veio de antes da checagem
   existir. A regra de bloqueio continua igual: não dá para estourar a cota.
2. A tela `/professor/inscricoes` ganhou a coluna **Vaga**, com `selecionados/
   posições` (vermelho quando passa). Antes não dava para saber a qual vaga
   cada pessoa pertencia — e "selecionado" é limitado pela vaga, não pelo projeto.
3. A lista de vagas do projeto marca em vermelho a vaga estourada, em vez de
   mostrar `2/1` como se fosse normal.
4. Efeitos colaterais de `updateInscricaoStatus` (e-mail e aviso no portal)
   passaram a rodar em `void Promise.resolve().then(...)`: uma falha **síncrona**
   (chave do Resend ausente, por exemplo) transformava em erro uma mudança de
   status que já estava gravada no banco — e "tente novamente" não resolveria
   nada. Descoberto por teste, não em produção.

**O que NÃO foi feito (de propósito):** permitir passar da cota com um "sim,
quero mesmo". Estourar a cota é o problema, não a solução; para os dados
legados, o caminho é a coordenação mudar quem ocupa (ex.: lista de espera) ou
aumentar as posições da vaga — as duas coisas que a nova mensagem sugere.

**Registrado em:** DECISIONS.md
**Impacto:** `src/lib/vagas.ts`, `src/actions/professor.ts`,
`src/app/professor/(protected)/inscricoes/page.tsx`,
`src/app/professor/(protected)/projetos/[id]/page.tsx`

---

## 18. SUAP: login automático quebrado e editais que não existem na API

**Relato:** "mesmo com o token, não funcionou. Será que mudou algo na API?" — com o
aviso `token-salvo: HTTP 405` no teste de conexão.

**O que foi verificado contra a API real (2026-10-05), não deduzido:**

| Verificação | Resultado |
|---|---|
| `POST /api/token/pair` com as credenciais do `.env` | **200** (username/refresh/access) |
| `GET /api/pesquisa/projetos/?page_size=1` com `access` novo | **200** (2756 projetos) |
| `GET /api/extensao/projetos/?page_size=1` | **200** (1230) |
| Mesmo GET com token expirado, refresh, lixo ou sem header | **401** (nunca 405) |
| Mesmo GET com POST/PUT/PATCH/DELETE/HEAD/OPTIONS | **405 Method not allowed** |
| `/api/pesquisa/editais/`, `/api/extensao/editais/`, `/api/v2/pesquisa/editais/` | **404** |
| `GET /api/openapi.json` (93 endpoints) — algum com "edital"? | **nenhum** |

Ou seja: **a API não mudou** nos endpoints que o portal usa (seguem 200, e só
aceitam GET). E 405 não é resposta para token inválido — é resposta para MÉTODO
não permitido. O 405 do relato continua sem reprodução a partir desta rede (um GET
idêntico, com o mesmo `fetch` do Node, responde 200): o suspeito é a camada de
rede/bloqueio por IP na frente do SUAP para o IP do servidor — o mesmo motivo que
já fez o código antigo falar em "IP bloqueado pelo SUAP". Por isso o diagnóstico da
tela agora trata **401 = token expirado** e **403/405 = requisição recusada
(bloqueio)**, que pedem ações diferentes.

**BUG REAL ENCONTRADO E CORRIGIDO (este sim, reproduzido):**

`getSuapTokenFresh` lia o corpo da resposta com `await res.text()` para poder
diagnosticar o erro e, no caminho de SUCESSO, chamava `res.json()` **no mesmo corpo
já consumido**. Toda tentativa de login por usuário/senha terminava em
`Body is unusable: Body has already been read` — ou seja, **o login automático
nunca funcionou** (em nenhuma versão do arquivo, conferido no histórico do git).
Consequência prática: o portal só autenticava com o token colado na tela, que vale
24h; quando ele expirava, a mensagem final culpava o token salvo e o admin era
obrigado a colar outro token todo dia. Reproduzido com o código do portal contra o
SUAP real **antes** (`ok:false` + "Body is unusable") e **depois** (`ok:true`, 2756
projetos) da correção.

Correção: `pedirTokenPair` lê o corpo **uma vez** e devolve `{access, refresh}` ou
o detalhe do erro, reaproveitando o mesmo texto. Além disso, quem chama agora
recebe `SuapHttpError` com o status HTTP — a tela decide a orientação pelo
**status**, não por `msg.includes('HTTP 401')` (comparação de texto que quebrou na
primeira mudança de redação, durante a escrita dos testes).

**Editais:** os três caminhos que o sync tentava respondem 404 e a API do SUAP não
tem nenhum endpoint de edital (verificado no `openapi.json`). O 404 era engolido e
o painel anunciava "✅ 0 editais encontrados no SUAP", como se a consulta tivesse
funcionado. Agora `fetchEditaisFromSuap` devolve `{editais, avisos}` e o sync
mostra a verdade: pelo SUAP não há de onde puxar editais — eles entram pelo
portal/professor. Os caminhos continuam sendo tentados, porque se o SUAP expuser
algo o sync volta a funcionar sem mudança de código.

**Registrado em:** DECISIONS.md
**Impacto:** `src/lib/suap-api.ts`, `src/lib/suap-sync.ts`,
`tests/suap-login.test.ts`

---

## 19. Imagens no meio do post, anexos (PDF/ZIP/RAR) e 20 MB por post

**Pedido:** "não tem como enviar imagens no meio do meu Post? Poderia armazenar na
minha VPS — o limite de 25 MB é por post, não por imagem; cada post pode pesar no
máximo 20 MB, seja com imagens, vídeos ou arquivos anexados (PDF, ZIP, RAR)."

**Números:** ficou **20 MB por post** (o valor específico dito no fim do pedido,
que prevalece sobre os "25 MB" iniciais). É uma constante só:
`LIMITE_POST_BYTES` em `src/lib/post-midias.ts`.

### 19.1 Imagem no texto sem dependência nova

O StarterKit do TipTap não traz nó de imagem e `@tiptap/extension-image` não está
instalado. Em vez de somar dependência (que exigiria `npm install` na VPS), o nó
`image` foi declarado em `RichTextEditor.tsx` com **exatamente** os atributos que
o sanitizador do servidor já permitia (`src` e `alt` — ver `src/lib/rich-text.ts`).
Qualquer atributo a mais seria removido ao salvar, então declarar o nó "do lado"
do sanitizador evita a surpresa de a imagem sumir depois de publicada.

O botão só aparece quando o formulário passa `onUploadImage` — assim o componente
continua servindo telas sem upload.

### 19.2 O limite é do POST, e quem decide é o servidor

`pesoDoPost` (`src/lib/post-midias.ts`, **puro**) soma as imagens do texto (lidas
do HTML) + os anexos. O MESMO arquivo roda no navegador (indicador "X MB de 20 MB"
enquanto o professor escreve) e no servidor (`pesoDasMidiasDoPost`, que lê o
tamanho REAL de cada arquivo no disco). Se cada lado tivesse a própria fórmula, a
tela diria "cabe" e o salvamento recusaria.

O servidor **ignora** os bytes informados pelo cliente: caminho é validado contra
a raiz do storage, URL é reconstruída a partir do caminho e o MIME vem da
extensão. `bytes` do cliente só alimenta o indicador da tela.

O limite vale nos DOIS painéis: a regra ficou em `src/lib/post-midias-server.ts`
(`validarMidiasDoPost`), usada por `actions/professor.ts` e `actions/admin.ts` —
antes de extrair, o limite existia só no fluxo do professor e um post criado pelo
admin escaparia.

### 19.3 ZIP e RAR (por conteúdo, não por extensão)

`file-storage.ts` passou a aceitar ZIP (`PK\x03\x04`, `PK\x05\x06`, `PK\x07\x08`) e
RAR (`Rar!\x1a\x07\x00` = RAR4 e `Rar!\x1a\x07\x01\x00` = RAR5), decididos por
**magic bytes** como os outros tipos — um arquivo chamado `.zip` com HTML dentro é
recusado (verificado: 415). Eles ficam em `outros/` e o nginx os serve como
download (`Content-Disposition: attachment`), igual aos PDFs.

Também subiu o `client_max_body_size` do nginx de 12M para **25M** (o envelope
multipart precisa de folga sobre os 20 MB) e esse valor precisa ser aplicado no
servidor — está em `deploy/nginx-portal.ifcoding.com.br.conf`.

### 19.4 Endurecimentos que vieram de junto

- **`actions/admin.ts` gravava `...data` direto no Prisma**: qualquer chave que o
  cliente mandasse entrava no update, inclusive `projetoId` e `authorId` (dava
  para mover um post para um projeto que a pessoa não coordena). Agora os campos
  são listados um a um.
- Anexo que saiu da lista é apagado do disco (o botão "remover" promete isso), em
  modo best-effort: o post já foi gravado, então falha de disco não pode virar
  erro na tela — um teste mostrou que a versão inicial derrubava a atualização.
- O formulário do professor **engolia o erro do servidor** ao salvar post (não
  mostrava nada). Agora usa o toast, que é o que informa o estouro do limite.

### 19.5 Vídeo

O 20 MB conta "imagens + anexos". Vídeo continua por **link** (`Post.videoUrl`,
com embed de YouTube) — não há upload de vídeo, e um arquivo de vídeo dentro de
20 MB seria de poucos segundos. Fica registrado como decisão consciente: se
quiserem upload de vídeo, é outro desenho (limite próprio, transcodificação e
player), não um `if` a mais nesta regra.

**Migração:** `prisma/post-anexos-setup.sql` (idempotente) cria `Post.anexos`.
Aplicar no VPS junto com o restante — `db push` continua proibido (Dec. 11).

**Registrado em:** DECISIONS.md
**Impacto:** `prisma/schema.prisma`, `prisma/post-anexos-setup.sql`,
`src/lib/post-midias.ts`, `src/lib/post-midias-server.ts`,
`src/lib/file-storage.ts`, `src/lib/upload-midia.ts`,
`src/lib/use-peso-midias.ts`, `src/components/ui/RichTextEditor.tsx`,
`src/components/ui/PostAnexosUploader.tsx`,
`src/app/api/files/peso/route.ts`, `src/actions/professor.ts`,
`src/actions/admin.ts`, telas de post (professor e admin) e post público,
`deploy/nginx-portal.ifcoding.com.br.conf`

---

## 20. Capa do post: imagem enviada ou ícone com significado

**Relato:** "a miniatura do post também não funciona. Poderia ter algumas para
escolher, alguns ícones nativos que dessem significado ao tipo da postagem."

**Causa:** dois problemas somados. (1) O card de "Últimas Atualizações"
(`/projetos/[slug]`) só sabia mostrar `Post.imagemUrl` — sem ela, aparecia um
retângulo cinza com ícone de imagem quebrada. (2) O **formulário do professor não
tinha campo de capa nenhum** (só título, resumo, conteúdo e status — a imagem
existia apenas no painel do admin, como URL colada). Ou seja: todo post criado
pelo professor caía inevitavelmente no quadrado vazio.

**Solução — dois caminhos, um componente:**

- **Imagem enviada** (upload para o storage local, mesmo fluxo dos anexos): agora
  disponível no painel do professor e no do admin, com prévia e botão de remover.
- **Ícone do catálogo** (`src/lib/post-capa.ts`): 10 ícones com significado para o
  contexto do campus — Aviso, Inscrições abertas, Seleção/resultado, Prazo,
  Evento, Formação, Reunião, Atividade do projeto, Conquista, Documento — cada um
  com rótulo, descrição de quando usar, fundo e cor.

`PostCapa` (`src/components/ui/PostCapa.tsx`) decide o que desenhar: imagem >
ícone escolhido > ícone padrão (`Newspaper`, cinza). Nunca fica vazio, e é o mesmo
componente no card público, no topo do post (`hero`) e na lista do painel
(`compact`). No post público a faixa `hero` só aparece quando há capa **escolhida**
— sem isso, toda publicação ganharia uma faixa cinza grande sem significado.

**Decisões de implementação que valem registro:**

1. **Catálogo fechado e validado no servidor.** A chave é conferida com
   `chaveDeIconeValida` ao salvar; chave inventada vira `null` em vez de erro (o
   ícone é enfeite, não pode impedir a publicação). `Object.hasOwnProperty` em vez
   de `in`/indexação direta: `'toString'` não passa.
2. **Classes do Tailwind literais** em cada item do catálogo — classe montada em
   tempo de execução não entra no CSS gerado e o ícone sairia sem cor. Há teste
   travando o formato (`bg-<cor>-100`, `text-<cor>-700`).
3. **Imagem e ícone são mutuamente exclusivos na tela**: escolher um limpa o
   outro. Manter os dois faria o professor escolher um ícone e continuar vendo a
   foto antiga no card, porque a imagem tem precedência na renderização.
4. **O admin não perdeu o campo de URL externa** (imagem hospedada fora), que
   agora convive com o upload.

**Migração:** `prisma/post-capa-setup.sql` (idempotente) adiciona `Post.icone`.

**Registrado em:** DECISIONS.md
**Impacto:** `prisma/schema.prisma`, `prisma/post-capa-setup.sql`,
`src/lib/post-capa.ts`, `src/components/ui/PostCapa.tsx`,
`src/components/ui/SeletorDeCapaDoPost.tsx`, `src/actions/professor.ts`,
`src/actions/admin.ts`, telas de post (professor e admin), listagem pública do
projeto e post individual

---

## 21. Servir os arquivos enviados FORA do nginx (imagem "corrompida")

**Relato:** "ele deixou eu colocar uma imagem mas ela ficou corrompida."

**O que era, de verdade:** a imagem não estava corrompida. O arquivo estava no
disco, íntegro (JPEG válido — `FF D8 FF`, 5.436 bytes) e o post apontava para
`/files/imagens/2026/10/<projeto>/<uuid>.jpg`. O que falhava era **servir** o
arquivo: quem publica a pasta do storage é o **nginx**
(`location /files/ { alias /var/www/portal-files/; }`), e o nginx **não existe no
ambiente local**. O navegador pedia `/files/...` e o Next respondia a própria
página 404 — que, num `<img>`, aparece como "imagem quebrada".

**Por que isso importava mais do que "só no meu PC":** o upload e a validação
funcionavam (foram verificados), mas a **entrega** dependia de um arquivo de
configuração do servidor web que não faz parte do repositório. Qualquer ambiente
sem aquele bloco — `npm run dev`, um servidor novo, um deploy em que o conf não
foi aplicado — mostraria **toda** imagem, capa e anexo quebrados, com os arquivos
perfeitamente gravados. Foi uma verificação que eu deixei faltar: testei o POST do
upload, não o GET do arquivo.

**Correção:** `src/app/files/[...caminho]/route.ts` passa a servir a pasta pelo
próprio Next, com as MESMAS regras do conf do nginx:

| Regra | Por quê |
|---|---|
| Whitelist de extensões (pdf, png, jpg, jpeg, webp, gif, zip, rar) | é exatamente o que o storage escreve; `.svg`/`.html`/`.js` nunca são servidos |
| Caminho validado contra a raiz (sem `..`, sem absoluto, `%` inválido recusado) | mesma defesa do `salvarArquivo`, agora na leitura |
| 404 (e não 403) para caminho inválido | não confirma o que existe fora da pasta pública |
| `X-Content-Type-Options: nosniff` + `Cache-Control: public, max-age=604800` | espelha o nginx (`expires 7d`); o nome é UUID, então cache longo não serve versão velha |
| `Content-Disposition: attachment` para PDF/ZIP/RAR | evita interpretar conteúdo de terceiro dentro do domínio |
| Streaming (`createReadStream`) em vez de carregar na memória | anexo pode ter 20 MB e o servidor é modesto |

**O nginx continua sendo o caminho preferido** em produção: ele intercepta
`/files/` antes do proxy, então a rota do Next nem é chamada. Ela é a rede de
segurança para quando o bloco não existe — e o comportamento passa a ser o mesmo
nas duas situações (era essa a intenção desde o começo).

**Limitação registrada:** a rota não trata `Range` (seek de vídeo/PDF grande); o
nginx trata. Se um dia houver vídeo servido localmente, isso volta à mesa.

**Verificação:** o mesmo arquivo que aparecia quebrado passa a responder **200
`image/jpeg`, 5.436 bytes** (idêntico ao disco); travessia de diretório e extensão
fora da whitelist respondem **404**. 13 testes novos em
`tests/arquivos-publicos.test.ts` (MIME, download, whitelist, validação de caminho
e a rota de verdade, com arquivo real no disco).

**Registrado em:** DECISIONS.md
**Impacto:** `src/app/files/[...caminho]/route.ts`, `src/lib/file-storage.ts`,
`tests/arquivos-publicos.test.ts`

---

## 22. Limites de entrada e o que um usuário mal-intencionado podia fazer

**Pedido:** "verifique campos de texto no preto e coloque limites aceitáveis —
título de projeto não precisa ter 5 mil caracteres; valor da bolsa não vai passar
de 9999,99; verifique problemas que um usuário mal-intencionado pode provocar."

### 22.1 O achado mais grave: o painel confiava no e-mail do cliente

As Server Actions do painel recebiam o e-mail de quem chamou
(`requireAdminEmail(callerEmail)`, `temAcessoAoProjeto(id, userEmail)`) e só
conferiam **o papel desse e-mail no banco**. Só que o e-mail vem do CLIENTE
(`user.email` do contexto de autenticação) e o id da Server Action está no bundle
público — então qualquer pessoa podia chamar a action direto passando
`ronan.lopes@ifpr.edu.br` (que está na documentação do projeto) e:

- editar/apagar projetos, editais, eventos, posts, vagas e documentos do RAG;
- mudar status de inscrição de qualquer projeto, exportar inscritos;
- publicar conteúdo no portal.

Isso é o achado S1/S2/S3 do RELATORIO_TESTES.md **ainda aberto** neste arquivo: a
correção anterior checava o papel, não a posse da conta. `src/lib/auth-helpers.ts`
já dizia o certo: "provar posse da conta exige verificar a assinatura do token".

**Correção:** a identidade passa a sair do **cookie de sessão httpOnly**
verificado com a chave do Firebase (`getVerifiedServerSession`), que o cliente não
forja. Como o e-mail continua sendo o parâmetro, a mudança ficou em 5 pontos e
fechou todo o painel:

| Função | Onde | O que fecha |
|---|---|---|
| `emailConfereComSessao` | `permissions.ts` | `temAcessoAoProjeto` + `projetosAcessiveis` → **todo o painel do professor** (projetos, vagas, inscrições, posts, editais) |
| `requireAdminEmail` | `actions/admin.ts` | projetos, editais, eventos, posts, usuários |
| `requireAdminEmail` | `actions/rag.ts` | documentos da base de conhecimento |
| `requireAdminEmail` | `actions/tags.ts` | tags do sistema |

Custo: nenhum call site mudou (a assinatura continua igual). Foi preciso ensinar
a sessão nos testes de permissão — e os testes antigos FALHARAM quando o guard
entrou, o que é a prova de que o furo existia.

### 22.2 Limites de campo (`src/lib/validacao.ts`)

Números num lugar só, para as telas não divergirem: título 120 (post/edital 160),
resumo 400, linha 120, texto de página 4.000, HTML do post 20.000, URL 500, listas
20 itens × 60 caracteres, JSON 32 KB, idade 14–100, bolsa 0–9.999,99 (2 casas),
vagas 1–999, carga horária 1–168 (uma semana), vigência 1–120 meses.

Aplicado em:

| Action | Campos |
|---|---|
| `criarInscricao` (**pública**) | nome, e-mail, telefone, idade, curso, turma, semestre, matrícula, disponibilidade, experiência, justificativa, tipo/gênero em lista fechada, respostas extras (50 perguntas × 2.000 chars, 32 KB), consentimento LGPD |
| `updateMeuPerfilAluno` | telefone, matrícula, Lattes (http/https), experiências, áreas/habilidades |
| `createVaga`/`updateVaga` | título, tipo, descrição, requisitos, **valor da bolsa**, quantidade, carga horária, vigência, fonte pagadora, situação |
| `createPost`/`updatePost` | título, resumo, conteúdo (HTML), imagem de capa, situação |
| `updateMyProjeto` | nome, coordenador, área, descrição, cor `#RRGGBB`, e-mail, **site/Instagram**, formulário extra (JSON) |
| `createMeuEdital`/`updateMeuEdital` | título, resumo, **link oficial e arquivo** |

### 22.3 URL que vira link = XSS armazenado se não for validada

`site`, `instagram`, `linkOficial`, `linkExterno`, `videoUrl`, `arquivoPdfUrl` são
renderizados como `href` na página pública, e o React **não** bloqueia
`javascript:` — ele só avisa em desenvolvimento. Um professor (ou uma conta
comprometida) podia gravar `javascript:...` e o script rodava no navegador do
estudante que clicasse. `validarUrl` aceita só `http://`, `https://` e caminho
interno (`/files/...`), com os testes cobrindo `javascript:`, `data:`,
`vbscript:`, `file:` e `//evil.com`.

### 22.4 Achados menores (registrados, um deles corrigido)

- **Gênero é coletado e descartado**: o formulário público marca "Gênero" como
  obrigatório, mas `Inscricao` não tem a coluna — o dado do aluno vai para o lixo.
  Agora ao menos é validado; a decisão (criar a coluna ou tirar o campo) fica com
  a coordenação.
- **Duplicidade de inscrição por e-mail** passou a ignorar maiúsculas
  (`Maria@x.com` e `maria@x.com` eram duas inscrições).
- **Rate limit** existe em `criarInscricao` (10/10 min) e `suap-login` (5/5 min).
  **Não** existe em `/api/chat` e `/api/ai/ifizinha` — um script pode consumir
  cota paga de LLM. Fica como recomendação (depende de decidir o limite por IP).
- **Upload** não tem limite de quantidade por usuário: um professor autenticado
  pode encher o disco de 20 MB em 20 MB.

### 22.5 O que NÃO foi coberto ainda

Campos de texto/URL do **painel do admin** (`updateEdital`, `updateEvento`,
`updateProjeto`, `createPost` do admin) e o parse de datas (`new Date('abc')` vira
`Invalid Date` e estoura o Prisma). O risco é menor — é o painel de uma pessoa de
confiança — mas a regra deveria ser a mesma dos dois lados; a validação já está
pronta em `src/lib/validacao.ts` para ser plugada.

**Registrado em:** DECISIONS.md
**Impacto:** `src/lib/validacao.ts`, `src/lib/permissions.ts`,
`src/actions/{admin,rag,tags,professor,perfil,inscricao}.ts`,
`tests/{validacao,limites-vaga,permissoes,inscricao}.test.ts`

---

## 23. Deploy em produção (VPS) — 05/10/2026

**Pedido:** "pode fazer o deploy do sistema para deixar no ar, quero testar a noite
com alunos reais."

**Contexto que mudou:** `DOCUMENTACAO/MIGRACAO_POSTGRES_LOCAL.md` avisava que a
produção não era um checkout git e que havia arquivos que só existiam lá — **o
aviso estava desatualizado**. A comparação por hash de todos os 198 arquivos de
`src/`, `prisma/`, `deploy/` e configs mostrou: **0 arquivos exclusivos da
produção**, 93 idênticos, 84 alterados aqui (trabalho acumulado desde 03/10) e 21
novos. Ou seja: dá para reconciliar por cópia, sem risco de apagar hotfix.

**Como foi feito (blue-green, sem tirar o site do ar para construir):**

1. Backup: `tar` do código (599 KB) + `pg_dump -Fc` do banco (174 KB) + cópia do
   conf do nginx — tudo em `/root/`, mais uma cópia do dump baixada para a máquina
   local.
2. Cópia da árvore atual para `/var/www/portal-conecta-novo` e aplicação dos 105
   arquivos alterados/novos por cima.
3. `node_modules` por **hard link** (não gasta disco), com `.prisma` e `@prisma`
   copiados de verdade — para o `prisma generate` não mexer no client que a
   produção estava usando.
4. Migrações idempotentes aplicadas (`perfil-academico-setup.sql`,
   `post-anexos-setup.sql`, `post-capa-setup.sql`) — colunas novas confirmadas
   (`Post.anexos`, `Post.icone`, `Inscricao.resposta_aluno/respondido_em/desistiu_em`,
   `perfil_s_aluno.ano_ingresso/semestre_atual/semestre_referencia`).
5. `prisma generate` + `npm run build` **no diretório novo** (o site seguiu no ar
   durante o build inteiro).
6. Troca: `stop` → `mv` das duas pastas → `start` (≈6 s fora do ar).
7. nginx: `client_max_body_size 12m → 25m` + bloco ZIP/RAR como download;
   `nginx -t` antes do `reload`.

**Verificação em produção (não só "subiu"):** todas as páginas públicas 200 por
HTTPS de fora da VPS; login real de aluno e de professor com cookie de sessão
(200 em `/meus-dados`, `/minha-area`, `/professor/*`); upload de imagem pelo
painel → servida pelo nginx (200 `image/png`) → `/api/files/peso` devolvendo o
peso real do disco; PNG falso com PHP dentro **recusado** pelos magic bytes;
upload sem token recusado; nenhum erro no `journalctl` do serviço.

**Rollback (≈20 segundos):**
```bash
systemctl stop portal-conecta
mv /var/www/portal-conecta /var/www/portal-conecta-novo
mv /var/www/portal-conecta-old /var/www/portal-conecta
systemctl start portal-conecta
```

**Registrado em:** DECISIONS.md
**Impacto:** produção `portal.ifcoding.com.br` (VPS 198.44.123.154);
build `bOk9YST9RoKglNhieq-2a`; versão anterior guardada em `portal-conecta-old`

---

## 24. Datas no fuso do Brasil (prazo aparecia um dia antes)

**Sintoma relatado:** conferir as datas antes do teste com alunos.

**O que estava errado (três problemas, um deles grave):**

1. A VPS roda em **America/Chicago**. `<input type="date">` manda `"2026-10-10"` e
   `new Date("2026-10-10")` é **meia-noite UTC** — formatado no fuso do servidor,
   aparecia **09/10/2026**. A coordenação digitava 10/10 e via 09/10.
2. Pior que a tela: o prazo **encerrava** em `agora > inscricao_fim`, ou seja, às
   21h de Brasília do dia 9. Quem deixasse para o último dia perdia a inscrição.
3. Timestamps e a regra de **virada de semestre** (`getMonth()` decide quando o
   portal avança o semestre do aluno sozinho) usavam o fuso da máquina — a virada
   de julho/agosto acontecia no dia errado para o Brasil.

**Correção:**

| Onde | O que mudou |
|---|---|
| `src/lib/datas.ts` (novo) | `parseDataDoFormulario` grava data "só dia" ao **meio-dia UTC** (09:00 em Brasília): nesse horário o dia é o mesmo em qualquer fuso entre UTC-12 e UTC+11. Meio-dia *de Brasília* não bastava — às 15:00 UTC, Tóquio já está no dia seguinte (o teste em Tóquio pegou isso). |
| `src/lib/datas.ts` | `fimDoDiaBrasil` / `inicioDoDiaBrasil`: prazo passa a ser **inclusivo** (vale até 23:59:59.999 do dia escolhido); formatação sempre com `timeZone: 'America/Sao_Paulo'` explícito. |
| `src/actions/{admin,professor}.ts` | Toda leitura de data de formulário passa por `parseDataDoFormulario` (8 pontos), com validação de calendário: "31/02" e "13/45" são recusados em vez de "rolar" para outro dia. |
| `src/actions/inscricao.ts` | Verificação de prazo usa início/fim do dia no Brasil. |
| `src/lib/utils.ts`, `minha-area.ts`, `professor.ts` (CSV), `meus-dados.ts`, `minhas-inscricoes.ts` | Formatação no fuso do Brasil em vez do fuso da máquina. |
| `deploy/portal-conecta.service` | `Environment=TZ=America/Sao_Paulo` — alinha `new Date()`, regras de calendário e qualquer formatação residual. |
| `vitest.config.ts` | `env: { TZ: 'America/Sao_Paulo' }`: teste não depende do fuso de quem roda. |
| `prisma/datas-fuso-setup.sql` | Normaliza dados já gravados à meia-noite (soma 12h), idempotente e restrito às colunas de `<input type="date">`. Em produção não havia nenhum caso (os dados de demonstração já eram meio-dia), mas fica pronto para bases antigas. |

**Verificação:** 18 testes novos em `tests/datas.test.ts` — incluindo o mesmo
instante visto de Brasília, Chicago, UTC e Tóquio sempre no mesmo dia; prazo às
22h do último dia ainda dentro; um minuto depois já fora; e `01/07 02:00 UTC`
ainda sendo **junho** no Brasil (virada de semestre). Em produção: o processo
confirma `TZ=America/Sao_Paulo` no `/proc/<pid>/environ`, todas as páginas 200 e,
no runtime novo, `meio-dia UTC → 10/10/2026` contra `meia-noite → 09/10/2026`
(o bug, reproduzido lado a lado).

**Registrado em:** DECISIONS.md
**Impacto:** `src/lib/datas.ts`, `src/lib/utils.ts`, `src/lib/minha-area.ts`,
`src/actions/{admin,professor,inscricao,meus-dados,minhas-inscricoes}.ts`,
`deploy/portal-conecta.service`, `vitest.config.ts`, `prisma/datas-fuso-setup.sql`

---

## 25. Tela branca em `/cadastro` ao criar conta (navegação durante o render)

**Sintoma relatado (05/10/2026, 20:05):** criar conta por e-mail/senha em
`/cadastro` "não funcionava": ao enviar o formulário, a página caía em
`Application error: a client-side exception has occurred (see the browser
console for more information)` — sem header, sem rodapé, sem formulário.
Criar conta pelo Google funcionava (o caminho do Google passa por
`/admin/login`, cujo redirect já estava dentro de `useEffect`).

**Causa (reproduzida de ponta a ponta, lado a lado):**

`src/app/cadastro/page.tsx` chamava `router.replace('/admin')` **no corpo do
componente**, fora de `useEffect`:

```tsx
if (user) { router.replace('/admin'); return null; }
```

`createUserWithEmailAndPassword` autentica na hora, então o `AuthContext`
publica o usuário novo — e ainda faz `router.refresh()` na troca de identidade,
além de gravar o cookie de sessão. O estado do Router muda **no meio** da
renderização de `CadastroPage`; o React aborta com `Minified React error #310`
("Rendered more hooks than during the previous render", estourando dentro do
`useMemo` do próprio Router) e a raiz inteira é substituída pela tela de erro.

| Reprodução (build de produção local, conta descartável) | Resultado |
|---|---|
| Código como está em produção (redirect no render) | conta criada no Firebase + cookie 200 → `React error #310` → URL `/cadastro` e a tela **"Application error: a client-side exception has occurred"** (o print do usuário) |
| Código corrigido (redirect em `useEffect`) | login 200 → `/admin` → `/meus-dados`, conta funcionando e console limpo |

Teste com Chrome headless + CDP preenchendo o formulário de verdade
(`/api/auth/verify-captcha` 200 → `accounts:signUp` 200 → `/api/auth/session`
200). As contas de teste (`teste.dsh.*`, `teste.antigo.*`) foram apagadas depois
no Firebase Auth e no banco local.

**Correções:**

| Onde | O que mudou |
|---|---|
| `src/app/cadastro/page.tsx` | O redirect passa a ser feito em `useEffect`, só depois de `loading === false` — ou seja, quando o `AuthContext` já gravou o cookie de sessão httpOnly (sem isso o layout protegido devolve para `/admin/login`). Mesma correção de `admin/login`/`professor/login` (28/08). A mensagem de sucesso continua aparecendo antes de navegar (estado `contaCriada`). |
| `src/lib/recuperacao-build.ts` + `<script>` inline em `src/app/layout.tsx` | Rede de segurança para uma segunda falha real, do mesmo dia: o deploy blue-green (§23) apaga os chunks do build anterior, e quem está com o portal aberto passa a pedir arquivos que não existem (`ChunkLoadError` + React error #423) — isso também resulta em tela branca. O script é **inline** de propósito (nesse caso é a hidratação que morre, um `useEffect` nunca rodaria) e recarrega a página uma vez: no máximo 1 recarga a cada 30 s e 3 por sessão. |
| `deploy/DEPLOY_BLUE_GREEN.md` (novo) | Runbook do deploy com o que faltava: preservar `.next/static` do build anterior (`cp -rn ... portal-conecta-old/.next/static/.`) e **copiar `public/`**. |

**Como o resto do app está:** `/cadastro` era o único ponto com navegação durante
o render — `AdminShell`, `ProfessorShell`, `professor/projetos/[id]`,
`perfil`, `posts`, `Header` e `ProjetosExplorer` navegam dentro de
`useEffect`/handlers (conferido um por um).

**Achado colateral (produção):** `public/` **não está versionado no git** (aparece
como `?? public/`) e por isso nunca subiu para a VPS — `/favicon.ico`,
`/icons/icon.svg`, `/icons/icon-192.png`, `/icons/icon-512.png`,
`/icons/icon-maskable-512.png` e `/apple-touch-icon.png` respondem **404** em
produção (o `manifest.webmanifest` é gerado pelo Next e respondia 200, então o
PWA ficava sem ícone). Corrigir junto com o próximo deploy (passo 6 do runbook).

**Verificação:** 9 testes novos em `tests/recuperacao-build.test.ts` (falha de
chunk, falha de `<link>` de CSS, promessa rejeitada, erro comum que **não** deve
recarregar, janela de 30 s, teto de 3 recargas, aviso no console) — **463 testes
da suíte passando**; `tsc --noEmit` limpo; `npm run build` ok. Reprodução fim a
fim: com a 1ª requisição do chunk de `/cadastro` falhando, a página se recarrega
sozinha e o formulário aparece (antes: conteúdo da rota vazio, sem aviso nenhum).

**Pendente (depende de acesso à VPS):** ~~subir isto para produção~~ — **feito em
05/10/2026** (ver "Deploy" abaixo). Falta só avaliar `git add public/` para o
diretório parar de ser invisível para o deploy.

**Deploy (05/10/2026, 19:15 CDT / 21:15 BRT):** blue-green na VPS
(`/var/www/portal-conecta`, serviço `portal-conecta.service`, porta 3000 atrás
do nginx), seguindo `deploy/DEPLOY_BLUE_GREEN.md`:

1. backup do código em `/root/portal-conecta-codigo-2026-10-05-1910.tgz`;
2. cópia da árvore para `/var/www/portal-conecta-novo` (sem `node_modules`/`.next`),
   `node_modules` por hard link e `.prisma`/`@prisma` como cópias reais;
3. 3 arquivos de código + `tests/` + `deploy/` + **`public/` inteiro** (nunca
   tinha subido) enviados para a pasta nova;
4. `npm run build` como usuário `portal` (BUILD_ID `887zxvLK3wAiaOVHIqLIf`) —
   o site ficou no ar durante todo o build (a build pediu o Inter em
   `fonts.gstatic.com` e teve uma retentativa, mas terminou `EXIT=0`);
5. `cp -rn` dos chunks do build anterior para dentro do novo (76 chunks js);
6. troca: `stop` → `mv` (`portal-conecta` → `-old`, `-old` → `-old-anterior`) →
   `start` (≈5 s fora do ar).

**Verificação em produção:** todas as páginas testadas 200 (`/`, `/cadastro`,
`/editais`, `/projetos`, `/agenda`, `/busca`, `/admin/login`,
`/professor/login`, `/meus-dados`); `/favicon.ico`, `/icons/icon.svg`,
`/icons/icon-192.png`, `/icons/icon-512.png` e `/apple-touch-icon.png` agora
**200** (eram 404); sem "Application error" no HTML; journal sem erros novos.
E o teste que importa: **cadastro real por e-mail/senha em produção**
(conta descartável `teste.deploy.dsh.*@example.com`, criada via navegador
headless) → `verify-captcha` 200 → `signUp` 200 → `session` 200 → usuário caiu
em `/meus-dados` com a conta funcionando. A conta de teste foi apagada depois no
Firebase Auth e no banco de produção (`DELETE 1` na tabela `"User"`).

**Rollback:** `systemctl stop portal-conecta; mv /var/www/portal-conecta
/var/www/portal-conecta-novo; mv /var/www/portal-conecta-old
/var/www/portal-conecta; systemctl start portal-conecta` (≈20 s).

**Evidência de log do bug (nginx):** às 18:05 CDT (20:05 BRT — o horário do
print) o IP `200.17.101.212` fez `GET /cadastro` (304, HTML do cache),
`POST /api/auth/verify-captcha` 200 e `POST /api/auth/session` 200 — ou seja, a
conta foi criada e o cookie gravado, e a quebra veio logo depois, no cliente,
como reproduzido em `React error #310`.

**Registrado em:** DECISIONS.md
**Impacto:** `src/app/cadastro/page.tsx`, `src/app/layout.tsx`,
`src/lib/recuperacao-build.ts`, `tests/recuperacao-build.test.ts`,
`deploy/DEPLOY_BLUE_GREEN.md`

---

## Resumo de impactos

| Decisão | Impacto | Fase | Notas |
|---|---|---|---|
| Manter Prisma/Firebase | Sem RLS nativa; validação de app | 1+ | Tradeoff: menos segurança de BD, mais controle de app |
| Firebase Auth + NextAuth | Validação `@ifpr.edu.br` em app | 1 | Simples de implementar |
| Enums 7-valores (legados) | Mistura novos/antigos; limpar Fase 2 | 1 | AuthContext usa valores legados |
| StatusProjeto/StatusEdital legados | Dados existentes usam valores antigos | 1 | Migrar dados Fase 2 |
| RLS simulada | Segurança depende de código | 1+ | Requer testes rigorosos |
| Fila manual | Pode estar lenta; MVP ok | 1+ | Escalar se necessário |
| TODO calendário oficial | Dados de exemplo até então | 1 | Não bloqueia MVP |
| Tabelas ausentes (tags, faq, favoritos) | MVP sem features avançadas | 2+ | Adicionar incrementalmente |
| **Hospedagem na VPS própria (Dec. 11)** | Sai Vercel + Supabase; backup passa a ser nosso; VPS vira ponto único de falha | pré-lançamento | Habilita 10MB/5MB e pgvector sem contorno |
| **Professor publica editais (Dec. 12)** | `Edital.projetoId`; admin mantém moderação | pré-lançamento | Substitui fluxo "só admin publica" |
| **Arquivos em disco local (Dec. 13)** | `/files/` servido pelo nginx, público; precisa rota autenticada se um dia for restrito | pré-lançamento | 10MB PDF / 5MB imagem |
| Sync SUAP manual (sem cron, sem conflitos) | Menos automação; exige ação do admin | 5 | Depende de credenciais do responsável; ver §14 |
| **Perfil acadêmico + convocação (Dec. 16)** | 5 colunas novas (`perfis_aluno`, `Inscricao`); semestre calculado na leitura (sem cron); pré-preenchimento da inscrição | pré-lançamento | Aplicar `prisma/perfil-academico-setup.sql`; `db push` continua proibido |
| **Vaga cheia nomeia o ocupante (Dec. 17)** | Bloqueio por cota continua igual; mensagem e telas passam a mostrar quem está selecionado | pré-lançamento | Dados antigos têm mais selecionados do que posições — a tela agora avisa |
| **SUAP: login automático + editais (Dec. 18)** | Login por usuário/senha volta a funcionar (não depende mais do token de 24h); sync de editais declara que a API não os expõe | pré-lançamento | Requer `SUAP_USERNAME`/`SUAP_PASSWORD` no `.env` do servidor; 405/403 = bloqueio por IP |
| **Mídia em post: imagens no texto + anexos, 20 MB por post (Dec. 19)** | Coluna `Post.anexos`; ZIP/RAR aceitos; limite de arquivo sobe de 10/5 MB para 20 MB; nginx 12M → 25M | pré-lançamento | Aplicar `prisma/post-anexos-setup.sql` e recarregar o nginx; vídeo segue por link |
| **Capa do post: imagem ou ícone (Dec. 20)** | Coluna `Post.icone`; upload de capa no painel do professor (que não tinha nenhum); card nunca fica vazio | pré-lançamento | Aplicar `prisma/post-capa-setup.sql` |
| **Arquivos servidos sem depender do nginx (Dec. 21)** | Rota `/files/[...]` no próprio Next, com as regras do conf; nginx segue preferido em produção | pré-lançamento | Sem migração; resolve imagem quebrada em dev/ambiente sem o bloco do nginx |
| **Limites de entrada + posse da sessão no painel (Dec. 22)** | Catálogo único de limites (`src/lib/validacao.ts`); painel passa a exigir cookie de sessão verificado (fecha bypass por e-mail do cliente) | pré-lançamento | Sem migração; painel admin ainda sem os limites de texto |
| **Deploy em produção 05/10 (Dec. 23)** | Blue-green na VPS: build em diretório paralelo, troca de pastas em ~6 s, rollback em 20 s | **no ar** | Estado anterior em `/var/www/portal-conecta-old`; ver Dec. 23 |
| **Datas no fuso do Brasil (Dec. 24)** | `src/lib/datas.ts`: data "só dia" gravada ao meio-dia UTC, prazo inclusivo até o fim do dia, formatação e serviço em `America/Sao_Paulo` | **no ar** | `prisma/datas-fuso-setup.sql` (idempotente; 0 linhas afetadas em produção) |
| **Cadastro quebrava a página (Dec. 25)** | `/cadastro` redireciona em `useEffect` (era `router.replace` durante o render → React error #310 → tela branca ao criar conta); recarga automática quando um chunk do build anterior some; deploy passa a preservar `.next/static` e copiar `public/` | **corrigido no código, falta subir** | `public/` não versionado → favicon e ícones do PWA em 404 em produção; runbook em `deploy/DEPLOY_BLUE_GREEN.md` |

---

**Próximo:** Consultar este arquivo durante implementação; atualizar conforme surgem novas decisões.
