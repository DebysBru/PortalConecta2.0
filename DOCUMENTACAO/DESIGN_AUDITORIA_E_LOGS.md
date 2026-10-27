# Desenho: auditoria de ações e registro de erros

Data: 2026-10-27 · Status: **aguardando aprovação** · Quem pediu: Ronan (administração do portal)

## 1. Intenção e por quê

O portal publica dados institucionais do IFPR Campus Ivaiporã. Hoje quase nada do que professores, gerentes de projeto e administradores fazem deixa rastro de **quem** fez **o quê** e **quando**, e os erros dessas operações somem. Dois problemas reais motivaram o pedido:

1. **Diagnóstico.** O administrador teve falhas ao inserir editais e ao subir PDF no RAG da IFizinha. Em 27/10/2026 só foi possível ver que houve 3 tentativas de extração de PDF (tabela `rate_limit_hits`); a mensagem real do erro não estava em lugar nenhum. As Server Actions de admin/professor/RAG capturam a exceção e devolvem só texto amigável, e o journal da VPS é volátil e guarda ~1–2 dias.
2. **Responsabilização.** Um gerente de projeto poderia publicar informação falsa numa página institucional sem que o administrador consiga apontar a autoria. A necessidade expressa foi: saber **o nome do autor ou o e-mail usado**.

Estado atual relevante (verificado no código em 27/10/2026):
- Existe a tabela `AuditLog` (`user_id`, `acao`, `entidade`, `entidade_id`, `detalhes`, `ip`, `created_at`). Só duas rotinas do **estudante** escrevem nela: `src/actions/minhas-inscricoes.ts` e `src/actions/meus-dados.ts`.
- Há 27 ações em `src/actions/admin.ts`, 29 em `professor.ts`, 6 em `rag.ts`, além de `site-config.ts`, `suap-import.ts` e as rotas `src/app/api/admin/editais/extract-pdf`, `src/app/api/admin/rag/upload|docs` e `src/app/api/files/upload`, sem nenhum registro de autoria.
- `AuditLog.user` usa `onDelete: SetNull`: excluir a conta apaga a autoria do registro.
- A tela "Limpar dados" (`src/lib/limpeza-tables.ts`, `limparTabelas` em `src/actions/admin.ts`) lista `auditLogs` como tabela apagável.
- Existe um logger estruturado (`src/lib/logger.ts`, uma linha JSON por evento), sem uso nas ações de admin/professor.

## 2. Objetivos

- G1. Cada criação, edição, exclusão, publicação ou envio de arquivo feito por admin, professor ou gerente fica registrado com: nome, e-mail e papel de quem agiu, a ação, o alvo (projeto/edital/etc.), os **nomes dos campos alterados**, o IP e o horário.
- G2. Cada **falha** dessas operações fica registrada com quem tentou, em que etapa falhou e a mensagem técnica real.
- G3. O Administrador Geral consulta tudo numa tela com **tabela e filtros** (decisão do usuário: formato A).
- G4. Os registros não podem ser apagados nem editados por nenhuma tela do portal; só a retenção automática remove registros antigos.
- G5. Entrar em produção na VPS (migração SQL, retenção automática, deploy), com verificação.

## 3. Não objetivos

- Não guardar o texto anterior/posterior das alterações (decisão do usuário: pesa demais). Só os nomes dos campos.
- Não guardar senhas, tokens, chaves de API nem o conteúdo das conversas dos estudantes com a IFizinha.
- Não há exportação (CSV) na primeira versão.
- Não há imutabilidade no nível do banco: quem tem acesso de administrador ao PostgreSQL continua podendo alterar a tabela. O alvo é impedir que **usuários do portal** apaguem provas.
- Não substitui o log do servidor (journal); complementa.

## 4. Anti-objetivos (seria fracasso mesmo "funcionando")

- Falha ao gravar o log **não** pode desfazer nem travar a operação do usuário (mesmo padrão já usado em `registrarAuditoria` de `minhas-inscricoes.ts`).
- Gerente/coordenador não pode ver nem alterar logs, nem os do próprio projeto.
- O registro não pode depender de um e-mail digitado no cliente: a autoria vem da **sessão verificada**.
- A tela não pode ficar lenta com o volume (paginação no servidor, índices).

## 5. Decisões do usuário (tomadas na conversa)

1. Identificar o autor por **nome ou e-mail** da conta usada.
2. **Não** guardar o texto anterior.
3. Tela em **tabela com filtros** (formato A do mockup: colunas Quando, Quem [nome + e-mail], Ação [+ campos alterados], Onde, Resultado; filtros por pessoa/e-mail, projeto, ação, resultado e período; clique na linha abre IP, papel, etapa e erro técnico).
4. O "Limpar dados" **não** pode apagar os logs; só retenção automática.
5. Retenção: **2 anos** para as ações dos usuários e **90 dias** para os erros técnicos.
6. Quer colocar **em produção**.

## 6. Desenho

### 6.1 Dados: estender `AuditLog` (minha decisão: reaproveitar a tabela)

Novo arquivo `prisma/auditoria-setup.sql`, **idempotente** (padrão do projeto; `prisma db push` é proibido — Decisão 11), e o mesmo no `schema.prisma`. Todas as colunas novas aceitam nulo ou têm padrão, para não quebrar as linhas existentes:

| Coluna | Tipo | Uso |
|---|---|---|
| `ator_email` | text | e-mail da sessão verificada |
| `ator_nome` | text | nome na hora da ação (cópia, não relação) |
| `ator_papel` | text | papel na hora (ADMIN, PROFESSOR, gerente…) |
| `resultado` | text, padrão `'SUCESSO'` | `SUCESSO`, `FALHA` ou `NEGADO` (sem permissão) |
| `projeto_id` | text | projeto afetado, quando houver |
| `rotulo` | text | nome/título do alvo na hora (ex.: nome do projeto ou título do edital), para registros de itens excluídos continuarem identificáveis |
| `campos` | text[], padrão vazio | só os **nomes** dos campos alterados |
| `etapa` | text | onde falhou (ex.: `leitura_pdf`, `ia`, `gravacao`) |
| `erro` | text | mensagem técnica, truncada em ~1000 caracteres, sem segredos |

Índices: `(created_at)`, `(ator_email, created_at)`, `(projeto_id, created_at)`, `(resultado, created_at)`.
O SQL também preenche `ator_email`/`ator_nome` das linhas antigas a partir de `"User"` (onde `user_id` existir).
Horário: gravar sempre pela aplicação (Prisma, UTC) e **exibir em `America/Sao_Paulo`** com `src/lib/datas.ts`. Não confiar em `DEFAULT CURRENT_TIMESTAMP` (o PostgreSQL da VPS está em `America/Chicago`).

### 6.2 Captura: um ponto central

`src/lib/auditoria.ts` (nome é decisão do construtor):
- `registrarAtividade({ acao, entidade, entidadeId, projetoId, rotulo, campos, resultado, etapa, erro })`: **nunca lança**; resolve o ator pela sessão verificada (`getVerifiedServerSession`), o IP pelos cabeçalhos; em caso de falha ao gravar, usa `createLogger('auditoria')` e segue.
- Um envoltório para Server Actions (por exemplo `comAuditoria(acao, opcoes, fn)`) que executa a ação, grava `SUCESSO` quando devolve `ok: true` e `FALHA` (com `erro`) quando devolve `ok: false` ou lança, **sem mudar o retorno** da ação. A ideia é cobrir as ~65 ações sem reescrever cada corpo.
- Toda `FALHA` e `NEGADO` também vai para `createLogger(...).error/warn` (o journal continua útil em tempo real).
- Quando o e-mail enviado pelo cliente não bate com a sessão, registrar `NEGADO`.

Nomes de ação: `entidade.verbo`, em português (`projeto.editar`, `edital.criar`, `edital.extrair_pdf`, `vaga.excluir`, `post.criar`, `rag.documento.excluir`, `usuario.papel_alterar`, `gestor.definir`, `inscricao.csv_exportar`, `limpeza.executar`, `suap.importar`, `site_config.editar`).

**Escopo da cobertura** (todas as ações que alteram dados ou arquivos): admin (editais, projetos, posts, eventos, usuários, limpeza), professor/gerente (projeto, página, gestores, inscrições [status, abrir/fechar, exportar CSV], vagas, editais, posts), RAG (documentos e PDFs), importação do SUAP, configurações do site e as rotas de upload/extração de PDF. Leituras comuns (listagens) não entram.

**Erros da extração de PDF** (`extract-pdf/route.ts`): registrar cada falha com a etapa (`leitura_pdf`, `ia`, `resposta_truncada`, `json_invalido`, `limite_ia`) e a classe do erro; hoje só o JSON inválido é logado.

**Privacidade:** `rotulo` guarda nome de projeto/título de edital; **não** guarda nome de estudante. Em ações sobre inscrições, registrar só o id da inscrição e o projeto.

### 6.3 Tela `/admin/auditoria`

- Acesso **somente Administrador Geral**, checado no servidor (mesma regra de `limparTabelas`: `isAdministradorGeral`). Link no menu do admin.
- Tabela como no mockup A: Quando (Brasília), Quem (nome + e-mail), Ação (+ campos alterados), Onde, Resultado. Falhas em destaque (vermelho). Clique na linha mostra IP, papel, etapa e erro técnico.
- Filtros: pessoa/e-mail (contém), projeto, ação, resultado (Todos/Sucesso/Falha/Negado), período (24 h, 7 dias, 30 dias, intervalo).
- Paginação no servidor (50 por página), consulta usando os índices.
- Somente leitura: nenhum botão de editar/apagar.

### 6.4 Proteção e retenção

- Remover `auditLogs` de `src/lib/limpeza-tables.ts` (e de qualquer outra lista que permita apagá-lo) e **cobrir com teste** para que não volte.
- Nenhuma Server Action ou rota apaga `AuditLog`, exceto a retenção.
- A autoria vem das colunas `ator_*` (cópia), então excluir a conta não apaga a autoria.
- **Retenção automática** diária (minha decisão: timer do systemd na VPS, versionado em `deploy/`, executando um SQL):
  `DELETE FROM "AuditLog" WHERE (resultado = 'FALHA' AND created_at < now() - interval '90 days') OR created_at < now() - interval '2 years'`.
  `SUCESSO` e `NEGADO` ficam 2 anos (minha decisão para `NEGADO`: tentativa de acesso indevido é ação de usuário, não erro técnico). A execução registra no journal quantas linhas removeu.

### 6.5 Produção (G5)

1. Aplicar `prisma/auditoria-setup.sql` na VPS (psql como no restante do projeto), com **confirmação do Ronan antes de tocar no banco de produção**, e conferir colunas/índices.
2. Instalar o timer de retenção e rodar uma vez em modo de verificação (contagem sem apagar) antes de ativar.
3. Publicar: push na `main`; o workflow para na guarda de migração SQL (mudou `prisma/*.sql`), então disparar **Run workflow** marcando `pular_guardas` **depois** de aplicar o SQL.
4. Verificar: fazer uma edição e uma falha propositada num projeto de teste e ver as duas linhas na tela; conferir o journal.
5. Atualizar a seção "Logs e diagnóstico" do `AGENTS.md` (hoje afirma a lacuna que este trabalho fecha).

## 7. Testes esperados

- `registrarAtividade` nunca lança, mesmo com o banco falhando; grava `ator_*` da sessão, não do argumento.
- O envoltório não altera o retorno da ação; `ok:false` e exceção viram `FALHA` com `erro` truncado.
- `auditLogs` não aparece em `limpeza-tables` e `limparTabelas` não o apaga.
- A tela e a consulta recusam quem não é Administrador Geral (gerente, professor, estudante).
- Retenção: SQL remove `FALHA` > 90 dias e qualquer registro > 2 anos, e preserva o restante (teste com datas forjadas).
- `typecheck` e a suíte atual (723 testes) continuam passando.

## 8. Deixado ao construtor

Nome e assinatura exatos das funções; como agrupar as ~65 ações no envoltório; componente da tabela/filtros (seguir o estilo dos painéis admin existentes); texto dos rótulos; detalhes do script do timer.

## 9. Pendências e riscos conhecidos

- **Fuso das tabelas.** O serviço roda com `TZ=America/Sao_Paulo` (`deploy/portal-conecta.service`), o PostgreSQL com `America/Chicago` e o `journalctl` exibe no fuso do sistema (CDT). A nota do `AGENTS.md` sobre o fuso de `rate_limit_hits.criado_em` não foi confirmada e deve ser corrigida na etapa 5.
- **LGPD e registros antigos.** Os registros que já existem em `AuditLog` (pedidos de dados e inscrições de estudantes) passariam a seguir a regra de 2 anos. Confirmar se algum deles exige prazo diferente.
- **Volume.** Cada ação gera uma linha; estimativa de volume baixo (portal institucional), mas o índice e a retenção existem por precaução.
