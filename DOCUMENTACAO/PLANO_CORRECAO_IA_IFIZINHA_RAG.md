# Plano de correção da IA da IFizinha e do RAG

Data: 22/10/2026 — America/Sao_Paulo.

Estado: implementação local realizada. Consulte `RELATORIO_CORRECOES_IFIZINHA_RAG.md` para evidências, decisões adotadas e pendências de validação semântica/produção.

## 1. Objetivo e limites da análise

Corrigir os 12 pontos da revisão do código, preservando o chat público, a gestão administrativa, o PostgreSQL próprio com pgvector e os documentos existentes. Cada etapa terá uma entrega pequena, testes de regressão e validação no sistema em execução antes de passar à seguinte.

Os achados vieram de análise estática. Não foi verificado o estado do banco, da VPS ou dos provedores. Portanto, a primeira execução de cada etapa deve confirmar o comportamento atual e registrar sua linha de base. Não tratar riscos condicionais como incidentes já comprovados em produção.

O objetivo inicial é tornar o sistema previsível, rastreável e recuperável. Não trocar de modelo, adicionar um banco vetorial externo, adotar outro framework de agentes ou introduzir serviços pagos para resolver problemas que a estrutura atual comporta.

## 2. Arquitetura pretendida

### Atendimento

Requisição validada → controle de consumo → resolução da pergunta no contexto da conversa → recuperação textual e vetorial independentes → seleção de evidências dentro de um orçamento → geração → validação das referências → resposta com fontes e diagnóstico operacional.

A busca textual deve continuar disponível quando o serviço de embeddings falhar. Ausência de evidência não equivale a falha de infraestrutura. O sistema deve distinguir esses estados internamente e usar mensagens adequadas para cada um.

### Ingestão

Identidade administrativa verificada → original persistido ou conteúdo com endereço consultável → extração → chunks determinísticos → enriquecimento opcional → indexação textual/vetorial → verificação → ativação da versão.

A versão atual permanece disponível enquanto a substituta é preparada. Ativar a substituta e desativar a anterior deve ser uma transição curta e atômica no banco; chamadas externas nunca ficam dentro dessa transação.

### Estado e procedência

Separar conceitualmente:

- Etapa de processamento: recebido, extraindo, dividido, enriquecendo, indexando, concluído ou falhou.
- Visibilidade: publicado/ativo ou oculto.
- Capacidade de recuperação: textual e semântica, com estados independentes.
- Procedência do embedding: provedor, modelo, dimensão e versão da composição do texto usado para gerar o vetor.

Antes de criar novos valores no banco, mapear os consumidores atuais de `status`, incluindo painel, importadores e scripts. Preferir evolução aditiva dos campos e compatibilidade temporária a uma renomeação ampla de uma só vez.

## 3. Ordem das entregas

| Etapa | Achado da revisão | Entrega | Dependências |
|---|---|---|---|
| E01 | 1 | Autenticação do upload | Nenhuma |
| E02 | 11 | Proteção das rotas de IA e limites das chamadas | Nenhuma |
| E03 | 2 | Originais e fontes consultáveis | E01 |
| E04 | 3 | Recuperação textual independente | Nenhuma |
| E05 | 4 | Embeddings reais e procedência | E04 |
| E06 | 5 | Estado de indexação confiável | E05 |
| E07 | 6 | Versionamento com ativação segura | E03, E06 |
| E08 | 10 | Cache correto e invalidação | E07 para validar a troca de versão |
| E09 | 8 | Busca estruturada relevante | E04 |
| E10 | 7 | Continuidade de conversa e identidade das fontes | E09 |
| E11 | 9 | Completude das listas e referências | E09, E10 |
| E12 | 12 | Orçamento, qualidade de resposta e avaliação | Etapas anteriores |

E02 antecipa a proteção de consumo porque as demais validações usarão endpoints com chamadas externas. E12 consolida as métricas; registrar duração e resultado básico já nas primeiras etapas.

## 4. Procedimento obrigatório por entrega

1. Confirmar o cenário no código e, quando seguro, no ambiente local em execução. Guardar os resultados anteriores à correção.
2. Implementar somente a etapa corrente e suas dependências estritamente necessárias.
3. Adicionar testes para o comportamento observável e para os caminhos de falha relevantes.
4. Executar os testes direcionados e `npm run typecheck`. Rodar a suíte completa e o build quando a mudança atingir contratos compartilhados, banco ou preparação da entrega.
5. Validar pelo navegador/API contra o aplicativo real e o banco local do projeto. Para a qualidade semântica, incluir chamadas reais ao provedor; mocks não demonstram qualidade de recuperação.
6. Registrar o resultado, a revisão de código testada, os arquivos alterados, a evidência e as limitações. Não declarar corrigido quando a validação necessária ainda estiver pendente.
7. Quando a correção for disponibilizada na VPS pelo fluxo acordado, fazer uma verificação curta na versão efetivamente implantada. O teste local não prova correção em produção.

Não induzir indisponibilidade em produção, remover chaves globais, esgotar cotas ou alterar documentos institucionais para testar falhas. Simular timeouts, erros e concorrência em testes automatizados e em uma instância local isolada. Na VPS, usar consultas de leitura e fixtures públicas autorizadas, claramente identificadas, quando uma gravação for necessária.

Não executar `prisma db push`: há objetos do banco não representados integralmente no schema. Mudanças de banco exigem SQL/migração explícita revisada, backup e verificação de preservação do pgvector e dos demais objetos existentes. Um restore de backup não é o rollback padrão: ele pode descartar gravações posteriores.

## 5. E01 — Autenticar o upload do RAG

**Problema:** `/api/admin/rag/upload` decide a autorização pelo campo `adminEmail`, informado pelo cliente.

**Implementação:**

- Reutilizar `exigirAdmin` de `src/lib/admin-auth.ts` no início do handler, antes de ler o multipart e iniciar operações caras.
- Atualizar o painel RAG para enviar o ID token Firebase em `Authorization: Bearer ...`, seguindo a gestão de documentos já existente.
- Remover `adminEmail` como fonte de identidade. Campos antigos recebidos do cliente não concedem autorização.
- Derivar autor/auditoria da identidade verificada; não registrar token em logs.
- Preservar a distinção entre 401 para identidade ausente/inválida e 403 para usuário autenticado sem permissão.

**Aceite automatizado:** sem token, token inválido e e-mail forjado não chegam à extração, gravação de arquivo, banco documental ou IA. Professor/estudante recebem 403; admin válido consegue avançar.

**Teste real:** enviar o mesmo documento de teste sem sessão, com conta não administrativa e com admin. Os dois primeiros não criam documento/job/arquivo; o terceiro conclui o fluxo esperado.

**Referências:** `src/app/api/admin/rag/upload/route.ts`, `src/lib/admin-auth.ts`, `src/app/admin/(protected)/rag/page.tsx`.

## 6. E02 — Proteger e padronizar as chamadas de IA

**Problema:** chamadas diretas dispersas, sem prazo explícito; chat público sem limite próprio identificado; simplificação de editais sem autorização no handler.

**Implementação:**

- Proteger `/api/ai/ifizinha` com autorização administrativa e atualizar seu cliente. O chat permanece público.
- Aplicar limites por origem confiável/sessão quando disponível, limite global e teto de chamadas simultâneas. Conferir o tratamento de IP atrás do nginx antes de confiar em headers do cliente.
- Reaproveitar o rate limiter existente se suas garantias forem suficientes; verificar atomicidade sob concorrência. Em VPS com mais de um processo, um contador apenas em memória não impõe um limite global.
- Centralizar o transporte em `src/lib/llm.ts`, incluindo mensagens de assistente, modo JSON, uso reportado, motivo de término e identificação da requisição. Preservar um caminho simples para os consumidores que precisam somente de texto.
- Definir orçamento inicial configurável: até 10 segundos para embedding de consulta e até 30 segundos para geração, com teto total de 45 segundos no atendimento. São limites operacionais propostos, a ajustar após medir a latência real.
- Separar política interativa da política de ingestão. Não usar as esperas longas de importação no chat.
- Repetir apenas falhas transitórias elegíveis, respeitando o prazo total e `Retry-After`; não repetir autenticação inválida ou requisição malformada. Cancelar chamadas abandonadas quando possível.
- Tratar JSON inválido, rede, timeout e erro de banco com respostas estáveis. Validar tamanho/tipos antes de trabalho caro e validar por schema a saída estruturada da simplificação.

**Aceite:** 401/403 no recurso administrativo, 429 com orientação de espera no limite, erro controlado em timeout; chamadas não ficam aguardando indefinidamente. Requisições concorrentes não ultrapassam o limite definido.

**Teste real:** simplificação com admin e sem token; chat normal com fornecedor real; falhas induzidas apenas na instância local. Confirmar que um erro de fornecedor não é apresentado como queda da conexão do estudante.

**Referências:** `src/app/api/chat/route.ts`, `src/app/api/ai/ifizinha/route.ts`, `src/lib/llm.ts`, `src/lib/embeddings.ts`, `src/lib/rate-limit.ts`, `src/components/chat/ChatWidget.tsx`.

## 7. E03 — Garantir origem consultável para todo documento utilizado

**Problema:** upload e texto direto podem gerar chunks sem URL; esses resultados são removidos das fontes e do contexto.

**Implementação:**

- Persistir o original do upload pelo armazenamento local existente, com validação de formato e caminho, preenchendo `storagePath`. Reconciliar os limites atuais do RAG e do storage, sem ampliar automaticamente o upload genérico.
- Não tornar todo upload público por acidente. A tela deve deixar explícito que publicar na base do chat público disponibiliza o conteúdo para consulta. Rascunhos e arquivos restritos não entram no contexto público nem ganham download público.
- Para texto direto, oferecer uma página de fonte pública com título, conteúdo original, versão e data. Conteúdo não publicado deve responder como indisponível sem expor o texto.
- Criar um resolvedor único de fontes para documento original, texto direto e projeto sintético. Para o sintético, resolver a página do projeto por identidade/slug atuais, verificando sua publicação.
- Preservar a regra de que uma evidência usada em resposta precisa ser conferível; corrigir a origem em vez de simplesmente remover o filtro de links.
- Limpar arquivos órfãos quando a ingestão abortar e planejar o ciclo de exclusão sem apagar arquivos ainda referenciados.

**Aceite:** upload e texto publicado são recuperados, entram efetivamente no prompt e geram links acessíveis. Documento oculto não fica acessível pela URL direta. PDF exibido corresponde à versão citada.

**Teste real:** fixture com informação exclusiva, por exemplo “código de verificação IFIZINHA-RAG-E03”. Perguntar pelo código, abrir a fonte, ocultar o documento e confirmar sua retirada após invalidação. Usar conteúdo sem dados pessoais.

**Referências:** upload RAG, `src/actions/rag.ts`, `src/lib/file-storage.ts`, `src/lib/fontes-resposta.ts`, `src/lib/projeto-sintetico.ts`.

## 8. E04 — Desacoplar busca textual da geração de embeddings

**Implementação:**

- Permitir recuperação textual sem `queryEmbedding`. Executar o caminho textual independentemente da chamada ao Gemini.
- Quando houver vetor válido, executar busca vetorial e fundir rankings por RRF, preservando a origem de cada resultado e seus escores separados.
- Retornar diagnóstico interno: híbrido, somente textual, somente vetorial, sem evidências ou falha de recuperação. Não expor mensagens técnicas ao público.
- Não converter toda exceção em “nenhum documento encontrado”. Distinguir banco indisponível de pesquisa válida sem resultados.

**Aceite automatizado:** embedding com 429, timeout ou erro não impede documento exato de ser encontrado textualmente. Falha em uma modalidade não descarta sucesso na outra. Falha das duas gera estado de indisponibilidade.

**Teste real:** no app local isolado, forçar falha do provedor de embeddings e consultar um identificador presente na fixture. A resposta deve continuar fundamentada e apontar sua fonte. Depois restaurar e verificar o caminho híbrido.

**Referências:** `buscarRagChunks`, `searchSimilarChunks`, `buscarTextualmente`, `buscarPorVetor`.

## 9. E05 — Eliminar embeddings simulados do fluxo operacional

**Implementação:**

- Manter mocks somente em testes explícitos. Ausência de chave em desenvolvimento/produção significa capacidade textual, não vetor fictício.
- Validar todos os componentes com `Number.isFinite`, dimensão, norma não nula e correspondência entre quantidade de entradas e vetores retornados.
- Persistir procedência real. Não deduzir o modelo gravado apenas da configuração atual ou da dimensão.
- Restringir busca vetorial ao espaço de embedding compatível. Mesmo número de dimensões não torna modelos diferentes comparáveis.
- Unificar a composição de entrada entre indexador e script de pendências: seção, texto e eventual tabela reformulada devem seguir a mesma versão de preparação.
- Inventariar vetores existentes antes de migrar. Não há prova confiável de que um vetor é real apenas por sua forma. Dados de procedência desconhecida exigem reindexação controlada, preservando busca textual.
- Planejar backfill retomável por modelo/versão incompatível, não apenas por `embedding IS NULL`. Controlar a cota compartilhada entre chat e importação.

**Aceite:** documento sem chave nunca aparece como semanticamente indexado; modelo incompatível não participa da busca; resposta parcial ou vetor com valor inválido não é persistido como sucesso.

**Teste real:** indexar uma fixture com provedor real, consultar por paráfrase e inspecionar sua procedência. Na instância isolada sem chave, o cadastro deve ficar textual e continuar pesquisável.

**Referências:** `src/lib/embeddings.ts`, `src/lib/indexador.ts`, `prisma/embedar-chunks-pendentes.ts`, schema RAG.

## 10. E06 — Tornar o resultado de indexação verificável

**Implementação:**

- Fazer `saveChunksWithEmbeddings` devolver um resultado explícito de persistência: quantidade esperada, vetores gravados e falhas. Erro de dados/permissão não pode virar sucesso textual silencioso.
- Se faltar infraestrutura vetorial, registrar capacidade textual e motivo operacional, sem marcar indexação semântica concluída.
- Propagar resultado tipado do indexador ao cadastro e painel; não usar `Promise<void>` com falha absorvida como confirmação de sucesso.
- Confirmar cobertura e compatibilidade dos vetores antes de marcar conclusão. Preservar uma forma de retomar lotes parcialmente processados.
- Atualizar logs de upload apenas com a etapa realmente concluída; distinguir extração bem-sucedida de pipeline concluída.

**Aceite:** falha de gravação, vetor ausente e lote parcial aparecem corretamente no job e documento. A interface não anuncia indexação concluída nesses casos.

**Teste real:** comparar número de chunks ativos elegíveis e vetores compatíveis da fixture; reexecutar sem duplicação. Simular erro de escrita apenas no ambiente isolado.

## 11. E07 — Publicar versões de forma atômica e recuperável

**Implementação:**

- Usar identidade estável de documento; título é editável e não deve ser a chave de versionamento.
- Criar a versão substituta fora da recuperação pública. Preparar chunks e vetores sem alterar a versão ativa.
- Ativar a nova versão na transação final, com controle de concorrência e restrição que impeça duas versões atuais da mesma identidade.
- A primeira versão pode ser publicada explicitamente em modo textual. Uma substituição que perdeu capacidade semântica não deve ocorrer silenciosamente; preservar a anterior ou exigir a decisão explícita de publicar em modo textual.
- Aplicar a mesma estratégia aos projetos sintéticos: evitar apagar chunks da versão atual antes da preparação da nova.
- Jobs precisam de idempotência, tentativa, prazo de execução e retomada. Começar com o fluxo síncrono corrigido; mover ingestão longa para consumidor persistente usando a tabela `Job` em uma entrega própria, antes de aceitar uploads maiores ou concorrência elevada.

**Aceite:** falha e interrupção durante preparo não retiram a versão anterior; duas atualizações concorrentes não geram duas versões atuais. A resposta não mistura chunks de versões diferentes.

**Teste real:** publicar fixture V1, preparar V2 com valor diferente, confirmar que a troca ocorre somente no fim; induzir falha local em V2 e verificar preservação de V1. Validar também a ocultação de projeto sintético.

**Rollback:** reativar a versão anterior por operação controlada e invalidar cache. Preservar histórico para diagnóstico.

## 12. E08 — Corrigir expiração e invalidação de cache

**Implementação:**

- Armazenar `expiresAt` por entrada, respeitando `ttlMs`, e manter limite de memória.
- Invalidar consultas afetadas por publicação, troca de versão, renomeação, ocultação ou exclusão. Conferir tanto actions quanto handlers e scripts.
- Com múltiplos processos, usar revisão da base em banco na chave ou mecanismo de invalidação compartilhada. Não assumir que limpar um `Map` limpa todos os processos.
- Chavear recuperação pela consulta resolvida e pelas versões relevantes, sem misturar respostas finais de conversas distintas.
- Evitar cachear falha transitória como ausência legítima de conteúdo.

**Aceite:** teste com relógio controlado prova expiração em dois minutos quando solicitada; alteração de visibilidade não reapresenta conteúdo antigo na consulta seguinte após a publicação confirmada.

**Teste real:** perguntar, alterar/desativar fixture, repetir imediatamente e após o TTL. Conferir os processos efetivamente usados na VPS.

**Referências:** `src/lib/cache.ts`, operações administrativas RAG, cache de `buscarContexto`.

## 13. E09 — Recuperar registros conforme o pedido

**Implementação:**

- Separar intenção específica (identidade/número), listagem filtrada e descoberta temática. Começar com regras testáveis e banco; não adicionar um classificador LLM a todas as perguntas.
- Em editais, aplicar número/ano/título, categoria e status conforme o pedido; converter vocabulário público para os enums corretos de cada entidade.
- Para “abertos hoje”, considerar prazo e regras de inscrição vigentes, com data atual em America/Sao_Paulo. Datas civis armazenadas à meia-noite não devem ser convertidas de maneira que mudem o dia.
- Combinar filtros de pessoa e tema quando ambos forem solicitados. Não retirar tema silenciosamente quando não houver resultado.
- Buscar nomes também entre vice-coordenadores; distinguir pessoa não identificada de ausência real de projetos.
- Tratar perguntas mistas, negações e termos ambíguos sem depender apenas de `includes` e da primeira regra encontrada.
- Manter busca híbrida para conteúdo documental e respeitar relações de retificação/vigência quando disponíveis. Não tratar “ativo” no índice como prova de validade atual de um edital.

**Aceite:** casos para número exato, nome exato, tema sem resultado, coordenador+tema, vice-coordenador e editais abertos não recebem listas arbitrárias. Informar explicitamente quando a busca for ampliada.

**Teste real:** comparar a resposta com a listagem filtrada do portal e consultas de leitura no banco; conferir datas-limite com exemplos conhecidos.

## 14. E10 — Preservar o assunto e a identidade das fontes na conversa

**Implementação:**

- Construir uma consulta independente a partir da pergunta e de um histórico curto: “E os documentos?” deve carregar a identidade do edital anterior. Usar estado estruturado validado antes de recorrer a uma reescrita por LLM.
- Se a referência for ambígua, pedir esclarecimento em vez de recuperar um assunto arbitrário.
- Transportar identificadores estáveis de fontes/versões; resolver novamente no servidor e verificar visibilidade atual. Dados enviados pelo cliente nunca autorizam acesso nem comprovam fatos.
- Tratar números [1], [2] como referências locais de cada resposta. Converter referências do histórico para identidades estáveis ou remover sua numeração antiga antes de montar o novo prompt.
- Incluir consulta resolvida no cache. Histórico forjado não pode mudar regras ou publicação de documentos.
- Delimitar documentos como dados não confiáveis, separados das instruções. Hoje os trechos são interpolados no system prompt; instruções contidas em uma fonte não devem adquirir autoridade.

**Aceite:** seguimento sobre documento, prazo e inscrição mantém o assunto; troca explícita muda o assunto; referência a documento oculto não recupera conteúdo; uma antiga fonte [1] não vira outra silenciosamente.

**Teste real:** conversa de três turnos sobre uma fixture, troca para outra e retorno à primeira; abrir os links e verificar o documento correspondente em cada turno.

## 15. E11 — Corrigir contagens, recortes e referências

**Implementação:**

- Consultar total e itens com o mesmo filtro. Se houver corte, declarar “mostrando N de M”; reservar “lista completa” para resultado comprovadamente completo.
- Separar perguntas de quantidade das perguntas de listagem. O resumo global não responde contagem filtrada por pessoa, tema ou situação.
- Dar fonte a todo item apresentado. Limitar os itens antes da geração ou oferecer paginação/link da listagem; não cortar referências usadas ao final.
- Associar números por identidade estável, não por nome/título que pode se repetir.
- Conferir referências citadas e rejeitar/remover números inexistentes de forma controlada. Não confundir “documentos recuperados” com “fontes que comprovadamente sustentam esta afirmação”.
- Se o modelo não citar, apresentar fontes recuperadas com rótulo honesto ou tentar uma correção limitada quando necessária; não garantir sustentação apenas porque houve recuperação.

**Aceite:** cenários com mais de seis fontes, mais de 30 projetos, títulos repetidos e número inventado não produzem links ausentes ou promessa falsa de completude.

**Teste real:** comparar contagem, itens e referências com os registros efetivos. Confirmar que cada link citado existe e aponta para o item indicado.

## 16. E12 — Controlar contexto e medir qualidade

**Implementação:**

- Definir orçamento global de entrada, reservado entre instruções, histórico, evidências e saída. Contagem de caracteres por descrição não substitui esse limite.
- Selecionar blocos pela pergunta, evitar trechos redundantes e preservar diversidade. Ajustar número de chunks e eventual recuperação de vizinhos por avaliação, sem aumentar contexto indiscriminadamente.
- Preservar metadados de origem, versão e, quando possível, página/seção durante a extração.
- Corrigir estouro de chunk causado pela inclusão de overlap junto de um parágrafo grande; testar tabelas e linhas curtas em maiúsculas para evitar perda de conteúdo útil.
- Na curadoria, registrar cobertura parcial e evitar chamar de “resumo do documento inteiro” uma análise dos primeiros 16 mil caracteres. Preferir enriquecimento seletivo; múltiplas chamadas só quando o ganho justificar o custo.
- Não usar tabela reformulada por IA como substituição da evidência original. Manter correspondência com o trecho e validar saídas estruturadas em runtime.
- Detectar término por limite de saída; usar resposta menor/paginada para listas extensas em vez de aceitar texto incompleto como concluído.
- Medir temperatura menor em respostas factuais, mantendo a personalidade no prompt. Não presumir melhora sem comparação.
- Registrar por requisição: ID, revisão da base, modo de busca, chunks/documentos selecionados, duração por etapa, uso de tokens quando fornecido, motivo de término e resultado de validação. Não gravar perguntas completas ou dados pessoais indiscriminadamente.

### Conjunto de avaliação

Criar inicialmente 30 perguntas revisadas: 5 de identificador exato, 5 paráfrases, 5 continuações, 5 com filtros/contagens, 5 de ausência/ambiguidade e 5 de prazo/versão/retificação. Para cada uma, registrar evidência esperada, pontos obrigatórios e afirmações proibidas. Acrescentar regressões dos problemas encontrados.

Avaliar separadamente recuperação e geração: o documento esperado entrou no contexto? A resposta usou o trecho correto? Os números e datas estão certos? As fontes abrem e sustentam a afirmação? A resposta admite ausência quando necessário?

**Critérios iniciais de aceite:** todos os testes determinísticos da etapa passam; nenhuma data/valor inventado nos casos críticos revisados; nenhuma referência inexistente; nenhuma regressão conhecida contra a linha de base. Executar os casos críticos de geração pelo menos três vezes para observar variabilidade. O conjunto pequeno é um gate de regressão, não uma garantia estatística de ausência de erros.

Para latência e consumo, registrar mediana e p95 na linha de base e na versão corrigida com condições comparáveis. Só definir metas finais depois dessa medição. Não apresentar o benchmark da Graphify como economia do chat: são sistemas e consumos diferentes.

**Teste real:** executar a bateria com o aplicativo, banco e fornecedores reais no ambiente validado. Revisar manualmente respostas e fontes críticas; testes com mocks complementam essa evidência, não a substituem.

## 17. Registro de execução e decisão de avançar

Atualizar esta tabela a cada entrega, sem marcar correção apenas por ter implementado código.

| Etapa | Implementação | Testes automatizados | Sistema local real | VPS/versão implantada | Evidência e pendências |
|---|---|---|---|---|---|
| E01 | Implementada | Passaram | Autorização real passou | Pendente | Admin, estudante, token inválido e sem token |
| E02 | Implementada | Passaram | Concorrência no banco passou | Pendente | Timeout/retry simulados; provedores pendentes |
| E03 | Implementada | Passaram | Upload/original/visibilidade passaram | Pendente | Corpus histórico precisa inventário de originais |
| E04 | Implementada | Passaram | Recuperação textual real passou | Pendente | Falha Gemini simulada; semântica pendente |
| E05 | Implementada | Passaram | Modo textual confirmado | Pendente | Sem pgvector/chaves; backfill não executado |
| E06 | Implementada | Passaram | Estado textual confirmado | Pendente | Persistência vetorial real pendente |
| E07 | Implementada | Passaram | Troca de versão e visibilidade passaram | Pendente | Worker externo continua entrega futura |
| E08 | Implementada | Passaram | Retirada de acesso imediata passou | Pendente | Contexto não usa cache de processo |
| E09 | Implementada | Passaram | 30 consultas sem exceção | Pendente | Relevância/gabaritos pendentes |
| E10 | Implementada | Passaram | Geração real pendente | Pendente | Assinatura e continuidade testadas automaticamente |
| E11 | Implementada | Passaram | Contagens reais consultadas | Pendente | Sustentação de afirmações geradas pendente |
| E12 | Implementada | Passaram | Bateria de recuperação registrada | Pendente | Build/tipagem passaram; geração/custo pendentes |

Para cada etapa, anexar um registro com: revisão testada, ambiente, horário de Brasília, cenário, esperado, observado, IDs das fixtures, resultado dos comandos, chamadas reais efetuadas e limpeza. Não incluir chaves, cookies ou tokens. Registrar também o procedimento de reversão específico.

**Próxima validação: ambiente com pgvector e provedores reais.** A implantação na VPS e o aceite semântico ainda não foram realizados; o relatório registra os testes e os requisitos para essa etapa.
