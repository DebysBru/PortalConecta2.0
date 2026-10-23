# Validação e implantação da IFizinha na VPS

Data: 22/10/2026, noite em America/Sao_Paulo (registros UTC de 23/10).

## Resultado

Build `bNe_rpWX7vvMlwxkvnsed` publicado em https://portal.ifcoding.com.br pelo script blue-green existente. O build anterior foi preservado. Rotas `/`, `/editais`, `/projetos`, `/agenda` e `/cadastro` responderam HTTP 200 após a troca; a verificação pública também passou.

Antes da publicação, uma cópia isolada do PostgreSQL foi restaurada em `portal_conecta_rag_validation_20261023`. A aplicação de validação escutou somente em `127.0.0.1:3003`; esse serviço foi desligado após os testes. Não foram criados documentos de teste no banco de produção.

Os 23 cenários de `VALIDACAO_RAG_VPS.json` passaram com Firebase, Gemini, DeepSeek e pgvector reais. Incluem autorização, ingestão indexada, recuperação exclusivamente vetorial, substituição V1/V2, bloqueio de fonte antiga/oculta, reativação e três repetições de pergunta e continuação. As duas fixtures foram removidas do clone.

## Produção

Aplicados os três índices aditivos de `prisma/rag-integridade-setup.sql`, após confirmar ausência de identidades duplicadas. Não houve `db push` nem reaplicação do SQL histórico de pgvector.

Originais privados: `/var/lib/portal/rag-originals`, usuário `portal`, permissão 700. `AI_TRUST_PROXY=1` foi habilitado depois de conferir a sobrescrita de `X-Real-IP` pelo nginx e restringir o Node a `127.0.0.1:3000`. Essa restrição está no drop-in `/etc/systemd/system/portal-conecta.service.d/rag-proxy.conf`.

Evidência pública: `VALIDACAO_RAG_PRODUCAO.json`. O chat respondeu HTTP 200 com provedor real; upload anônimo retornou 401. A consulta por edital inexistente não inventou resultado. A resposta sobre cursos identificou a antiguidade da fonte recuperada e não a apresentou como oferta vigente. Isso também evidencia uma pendência de qualidade: recuperar e priorizar fontes atuais precisa ser avaliado depois da reindexação, com gabaritos revisados.

## Reindexação em andamento

Inventário inicial: 3.508 documentos e 32.016 chunks, todos com vetor, porém sem assinatura de procedência. Esses vetores antigos não foram declarados compatíveis por inferência.

Lote inicial de 32 chunks reindexado com Gemini real, sem falhas. Os 31.984 restantes foram encaminhados ao serviço imediato `portal-rag-reindex`, em lotes de 32, vazão de 80 chunks/minuto, memória máxima de 600 MB e prioridade reduzida. O limitador compartilhado do provedor permanece ativo. O job para após três falhas consecutivas e pode ser retomado; não modifica o texto original. No ritmo nominal, a carga restante exige cerca de 6h40, podendo demorar mais por latência/cota. Não registrar a base como concluída antes de conferir o contador final.

Consultar na VPS:

```bash
systemctl status portal-rag-reindex --no-pager
journalctl -u portal-rag-reindex -n 30 --no-pager
```

Para interromper: `systemctl stop portal-rag-reindex`. Para retomar, executar `npm run rag:embedar -- --lote=32 --rpm=80` no diretório da aplicação com o usuário do serviço. As assinaturas persistidas fazem a retomada pular os chunks já compatíveis. A busca textual continua disponível durante esse processo.

## Backup e reversão

- Banco antes da implantação: `/root/portal-rag-before-20261023.dump`.
- Configuração anterior: `/root/portal-env-before-rag-20261023` e `/root/portal-service-before-rag-20261023.txt` (não versionar nem copiar seus conteúdos para relatórios).
- Logs: `/root/rag-validation-build.log`, `/root/rag-production-deploy.log`, `/root/rag-production-backfill.log`.
- Reversão da aplicação: rotina `bash deploy/deploy-vps.sh rollback`, na VPS. Índices são aditivos. Não restaurar o banco inteiro para desfazer somente o deploy.

O aceite dos fluxos testados está concluído. A reindexação histórica completa, a avaliação semântica de todo o corpus e a revisão humana das respostas continuam abertas. Não há garantia de ausência de alucinações ou percentual demonstrado de economia de tokens.
