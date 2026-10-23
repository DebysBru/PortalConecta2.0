# Correções da IFizinha e do RAG — implementação e validação

Data de execução: 22/10/2026, horário de Brasília.

As correções estão no checkout local. Não houve implantação na VPS. O estado abaixo distingue implementação, testes automatizados, aplicação local em execução e validação semântica com provedores.

## Resultado e limites do ambiente

- PostgreSQL local: `127.0.0.1:5433`, com 3.272 documentos antes das fixtures.
- Firebase real disponível: identidade administrativa e identidade de estudante usadas nos testes de autorização, sem alterar papéis.
- Gemini e DeepSeek: chaves ausentes no ambiente local. Nenhuma geração de resposta ou embedding com esses provedores foi realizada nesta execução.
- O banco local não tem a coluna `chunks_kb.embedding`. A recuperação real exercitada foi textual.
- A indisponibilidade de configuração foi confirmada na API e no navegador. HTTP 503 neste caso é o resultado correto, não evidência de qualidade da geração.
- Fixtures identificadas por marcador aleatório, documentos e jobs associados foram removidos ao terminar os testes.

## Entregas realizadas

| Etapa | Implementação | Evidência local | Validação ainda necessária |
|---|---|---|---|
| E01 | Upload exige token Firebase verificado antes do multipart; painel envia Bearer token | Testes de regressão e API real com admin, estudante, sem token e token inválido | Conferir versão implantada na VPS |
| E02 | Transporte comum, timeout total, retries transitórios, limite global/por origem e leases no banco; simplificação e extração de edital protegidas | Testes de erros e autorização; teste real de seis reservas simultâneas com limite dois: duas aceitas e quatro recusadas | Respostas dos provedores e headers do nginx efetivamente implantado |
| E03 | Original fora do storage público; download condicionado ao documento ativo; página de fonte para texto; fontes nas duas interfaces de chat | Upload TXT, download original, abertura da página e retirada de acesso após ocultação/substituição | PDF/DOCX/planilha representativos e migração de originais históricos que não foram preservados |
| E04 | Texto começa independentemente do embedding; recuperação vetorial opcional; falha total não vira ausência de resultados | Testes de falha do Gemini/banco e consultas textuais contra o corpus local | Timeout/429 controlado em ambiente com provedores configurados |
| E05 | Sem vetores simulados; validação completa e cardinalidade; assinatura de modelo/preparação; cota compartilhada por chave; backfill retomável de incompatíveis | Testes de vetores inválidos e lote incompleto; cadastro real fica em modo textual sem chave | pgvector, provedores e reindexação controlada de vetores históricos |
| E06 | Gravação vetorial não mascara erro; indexador retorna capacidade ou propaga falha; estado textual explícito no painel | Testes de persistência parcial, falha externa, sucesso e ausência de chave; estado textual confirmado no banco real | Persistência vetorial e contagem em ambiente com pgvector |
| E07 | Nova versão preparada oculta; troca atômica sob lock; proteção contra concorrência e perda silenciosa de capacidade; importador e sintéticos preservam versão anterior | Testes de concorrência/ativação e ciclo real V1 → V2 → ocultação → reativação | Interrupção de ingestão longa em ambiente isolado e worker persistente, se necessário para a carga |
| E08 | TTL por entrada corrigido; contexto público deixa de usar cache de processo; fontes revalidadas no banco | Relógio controlado e mudança imediata de visibilidade no aplicativo | Medição de carga na VPS antes de introduzir cache compartilhado |
| E09 | Contagens e listas usam o mesmo filtro; status/prazos, pessoa+tema, vice-coordenador, assunto específico, números e títulos explícitos | Testes de filtros e 30 consultas reais de recuperação | Relevância semântica, casos institucionais de retificação e revisão humana da bateria |
| E10 | Estado curto assinado, com consulta e IDs de documento; referências antigas removidas do histórico; fontes ocultas não são reutilizadas | Testes de assinatura, expiração, adulteração, continuidade e ocultação | Conversas com geração real, incluindo troca e ambiguidade de assunto |
| E11 | Recorte declarado, total filtrado separado, referências por item e sem corte das fontes efetivamente citadas; números inválidos removidos | Testes com mais de seis referências e contagens reais filtradas | Conferir se cada afirmação gerada é sustentada pelo trecho, não apenas se o número existe |
| E12 | Orçamento de evidências e entrada total, diversidade de trechos, overlap limitado, curadoria parcial explícita e métricas de uso/duração/término | Build, tipagem, regressões e relatório das 30 consultas | Avaliação de respostas reais com gabaritos revisados; custo e latência do fluxo completo |

## Decisões de implementação

1. **Compatibilidade:** não foi alterado o schema Prisma. Procedência, estado da publicação e identidade da versão ficam nos campos existentes e no JSON de metadados. Foram adicionados apenas índices SQL revisáveis.
2. **Originais privados:** os arquivos novos usam `RAG_PRIVATE_ROOT`, fora de `STORAGE_ROOT`. A rota de download consulta a visibilidade a cada requisição e usa `no-store`. Não é necessário expor essa pasta no nginx.
3. **Versões explícitas:** o painel oferece seleção do documento a substituir. Documentos novos não são agrupados por coincidência de título. Rebaixar uma versão indexada para modo textual exige uma escolha explícita no formulário.
4. **Reativação e reversão:** uma versão já publicada pode voltar a ficar ativa quando não há outra ativa. Havendo uma versão atual diferente, a operação administrativa deve informar `substituirId` para uma troca intencional; a transação confere essa identidade antes de substituir.
5. **Cache:** o cache genérico continua existindo, com TTL corrigido. O contexto do chat não é cacheado em memória, porque uma invalidação de outro processo não chegaria a esse cache. Isso prioriza a retirada imediata de conteúdo; uma revisão compartilhada da base pode ser acrescentada após medição de carga.
6. **Orçamento:** o contexto usa um teto conservador em bytes UTF-8 e preserva blocos inteiros. A requisição completa é limitada a 32.000 bytes; histórico antigo é removido antes de comprometer evidências. Não se apresentou esse limite como contagem exata de tokens do fornecedor.
7. **Procedência:** vetores sem assinatura compatível não entram no ranking vetorial. A busca textual permanece disponível. A troca exige inventário e backfill, não a atribuição retroativa de uma procedência que não foi comprovada.
8. **Curadoria:** resumos cobrem os trechos efetivamente enviados. A composição do embedding usa seção e texto original; uma tabela reescrita por IA não substitui o original na representação semântica.
9. **Ingestão:** o fluxo continua síncrono, como previsto para a primeira entrega do plano. A tabela de jobs registra as etapas; ainda não foi criado um consumidor externo com retomada automática após reinício do processo. Antes de aumentar volume e concorrência de uploads longos, essa entrega continua recomendada.

## Evidências reproduzíveis

Resultado final: **692 testes passaram em 52 arquivos**; tipagem da aplicação e dos scripts aprovada; build isolado aprovado. No smoke test da aplicação real, **15 cenários passaram** e um grupo semântico ficou explicitamente pendente por configuração ausente. O teste de concorrência do banco aceitou duas e recusou quatro das seis reservas simultâneas, conforme o limite configurado. As duas fixtures documentais foram limpas ao final de cada execução.

O resumo estruturado das evidências está em `VALIDACAO_RAG_LOCAL.json`.

Comandos executados ou disponibilizados na raiz do projeto:

```powershell
npm test
npm run typecheck
npx tsc --project tsconfig.scripts.json --noEmit

# Build isolado, sem sobrescrever o servidor local existente
$env:NEXT_BUILD_DIR = '.next-rag-check'
npx next build
npx next start --hostname 127.0.0.1 --port 3002

# Executar em outro terminal, contra o aplicativo e banco locais
npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register tools/verificar-rag-real.ts
npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register tools/verificar-limites-ia.ts
npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register tools/avaliar-rag-recuperacao.ts
```

O comando habitual `npm run build` inicialmente encontrou um bloqueio de arquivo do Windows no `prisma generate`, porque o servidor local já utilizava a DLL do Prisma. Como não houve mudança de schema, o cliente existente foi mantido e a validação usou `npx next build`. Esse caminho passou. Não foi encerrado o servidor preexistente na porta 3001.

Os scripts de teste real recusam banco/aplicativo remoto por padrão. O smoke test obtém tokens Firebase das identidades existentes, sem imprimir credenciais, e limpa somente as fixtures com seu marcador. Se os provedores estiverem configurados e o pgvector disponível, também verifica código e prazo da fixture em três repetições de conversa. Esses cenários semânticos permanecem pendentes nesta execução.

Artefatos locais de evidência:

- `.local-test/vitest-rag-correcoes.txt`: saída da suíte.
- `.local-test/build-rag-correcoes.txt`: saída do build.
- `.local-test/rag-real-results.txt`: cenários da API real.
- `.local-test/rag-ui-sem-chave.png`: interface mostrando indisponibilidade controlada.
- `DOCUMENTACAO/AVALIACAO_RECUPERACAO_RAG_LOCAL.json`: resultados das 30 consultas de recuperação, sem geração.

O relatório JSON identifica as avaliações humanas como pendentes. As cinco entradas de “continuação-base” são perguntas iniciais para avaliar recuperação, não conversas completas já aprovadas.

## Resultados da recuperação local

Na última bateria registrada: 30 consultas, nenhuma exceção de recuperação; mediana de 1.275 ms e p95 de 2.088 ms. São tempos de busca/contexto em um único ambiente, sem Gemini/DeepSeek, e não medem a resposta completa ou demonstram melhoria contra a versão anterior.

Números e títulos explicitamente inexistentes passaram a retornar zero fontes. O assunto específico de teletransporte também deixou de receber documentos genéricos. Uma pergunta ampla sobre um “torneio de xadrez de Marte” ainda recuperou documentos relacionados a termos da pergunta: isso exige avaliar a abstinência da geração e calibrar a recuperação com gabaritos, não declarar acurácia a partir da ausência de exceções.

## Banco e implantação

Backup local criado antes dos índices: `.local-test/pg/rag-before-integridade.dump`.

Aplicado somente no PostgreSQL local: `prisma/rag-integridade-setup.sql`. Os índices restringem uma versão ativa por identidade gerenciada e auxiliam o filtro de procedência. Não houve `db push`, instalação de extensão ou alteração de coluna vetorial.

Antes da implantação na VPS:

1. Fazer inventário de coluna/extensão pgvector, assinaturas existentes, duplicatas de identidades ativas e versão do código implantado.
2. Criar backup atual e aplicar a migração aditiva revisada. Se houver duplicatas, resolver explicitamente; não apagar/desativar documentos automaticamente para forçar o índice.
3. Configurar `RAG_PRIVATE_ROOT` em diretório persistente fora da árvore de releases e da pasta pública, com escrita para o usuário do serviço. Exemplo: `/var/lib/portal/rag-originals`. Não acrescentar uma localização pública do nginx para essa pasta.
4. Conferir que o proxy sobrescreve `X-Real-IP` e que o Node só pode ser acessado através dele antes de habilitar `AI_TRUST_PROXY=1`. Sem confiança explícita, o orçamento público é compartilhado para impedir burla por header forjado.
5. Configurar limites conforme a capacidade real: `AI_RPM_ORIGIN`, `AI_RPM_GLOBAL`, `AI_CONCURRENCY`, `EMBEDDING_RPM`; configurar um `CHAT_STATE_SECRET` próprio se desejado.
6. Implantar pela rotina existente, verificar autorização e fontes, e executar uma avaliação semântica com fixtures autorizadas em ambiente apropriado. Não executar scripts locais contra produção apenas removendo sua proteção de host.
7. Reindexar o corpus incompatível de maneira retomável com `npm run rag:embedar`, começando por um lote pequeno e observando a cota compartilhada. Não marcar vetores históricos como confiáveis só por terem 1536 dimensões.

Não reaplicar cegamente o arquivo histórico `pgvector-setup.sql`: ele inclui instruções de RLS herdadas da infraestrutura antiga. Conferir a infraestrutura real e preparar a migração apropriada se algo estiver ausente.

## Reversão

- Manter a revisão anterior do aplicativo disponível pelo fluxo de deploy existente.
- Para conteúdo, preferir a troca administrativa intencional para uma versão anterior, preservando o histórico. Não restaurar todo o banco para desfazer uma publicação.
- Índices são aditivos; não é necessário removê-los para reverter apenas a aplicação. Avaliar a compatibilidade do código anterior que fazia atualizações no lugar antes de voltar a executar importações.
- Não apagar a pasta privada entre releases. Backup e restauração dos originais precisam acompanhar o banco.

## Atualização: validação na VPS

Após a escolha do ambiente pelo usuário, as correções foram publicadas no portal. Os 23 cenários da VPS passaram com Gemini, DeepSeek, Firebase e pgvector reais, e o chat público foi conferido. Detalhes, evidências, backup e limites dessa validação estão em `DOCUMENTACAO/VALIDACAO_IFIZINHA_VPS.md`. A reindexação histórica foi iniciada e ainda precisa terminar; as limitações locais descritas acima permanecem como registro daquela etapa.

## Pendências de aceite final

Os fluxos reais descritos no relatório da VPS foram aprovados. Permanecem pendentes a conclusão da reindexação e a avaliação semântica ampla com gabaritos revisados. Não foram prometidas redução percentual de tokens, ausência de alucinações ou aprovação de toda a base documental.
