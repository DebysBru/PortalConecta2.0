# Controle de acesso e consumo da IFizinha

## Política

- Login obrigatório para perguntar nos dois chats do portal.
- Até 20 perguntas aceitas em qualquer janela móvel de uma hora, por conta.
- Intervalo mínimo de cinco segundos entre perguntas aceitas da mesma conta.
- A cota usa o UID validado pelo Firebase no servidor. E-mail, UID e IP enviados no corpo não definem identidade.
- Contas diferentes na mesma rede escolar têm cotas individuais. A mesma conta mantém sua cota em outros dispositivos ou redes.

Visitantes recebem HTTP 401 e um convite para entrar no portal. Tokens inválidos ou expirados são recusados; não há fallback para cota anônima. A interface mostra o aviso de fase de testes e o link de login, e desabilita o envio sem autenticação.

## Funcionamento

A verificação ocorre antes da recuperação de contexto, geração de embeddings e chamada ao modelo. Perguntas válidas que resultem em pedido de esclarecimento também contam. Uma tentativa bloqueada não aumenta a contagem. Uma pergunta aceita que falhe posteriormente permanece contabilizada, pois pode já ter consumido recursos.

Ao atingir a cota ou o intervalo, a API responde HTTP 429 com mensagem em português, `Retry-After` e `retryAfterSeconds`. A espera da cota horária corresponde à saída da pergunta mais antiga da janela; ela não reinicia em horários fixos.

Os registros ficam no PostgreSQL (`rate_limit_hits`), com chave derivada por hash da identidade. A reserva usa lock transacional compartilhado: processos concorrentes não podem consumir a mesma vaga. Reiniciar a aplicação ou abrir outra aba não zera a cota. Os registros antigos são limpos pela rotina existente.

Os limites globais existentes continuam ativos: 60 atendimentos por minuto e quatro simultâneos por padrão. Assim, contas individuais não eliminam a proteção da capacidade total do serviço. Esta política não impede todo abuso por múltiplas contas e não estabelece orçamento financeiro diário.

## Verificação

Testes automatizados cobrem bordas de cinco segundos, a 20ª/21ª pergunta, cálculo da espera, ausência de consumo nas recusas, identidade verificada e cotas independentes no mesmo IP. O teste de rota confirma que uma recusa não chama a recuperação nem o modelo.

As evidências anteriores de `VALIDACAO_LIMITES_CHAT_VPS.json` registram a primeira implementação por IP, substituída pela política por conta descrita aqui.

Em 23/10/2026 (America/Sao_Paulo), o build `IwhAfY-Nho2ywBAqMTRlB` foi publicado pela rotina blue-green da VPS. As rotas principais e a verificação pública do deploy responderam HTTP 200. Não houve alteração de esquema para esta política.

Resultados: 703 testes automatizados passaram, além do typecheck e do build de produção. Na cópia isolada do banco, dez cenários com duas identidades Firebase reais passaram (`VALIDACAO_CONTAS_CHAT_VPS.json`), incluindo contas no mesmo IP, troca de IP, intervalo, esgotamento independente da cota e liberação da janela. Os 23 cenários de regressão do RAG autenticado também passaram, com limpeza das duas fixtures (`VALIDACAO_RAG_AUTENTICADO_VPS.json`).

No endereço público, sete verificações passaram: aviso e link de login, acesso à página de login, recusas de visitante/token inválido, contas distintas no mesmo IP, bloqueio de repetição imediata e resposta autenticada com Gemini/DeepSeek e quatro fontes (`VALIDACAO_CONTAS_CHAT_PRODUCAO.json`). Os testes que preenchem artificialmente a cota foram feitos somente no clone; em produção foram realizadas requisições normais, sem semear ou apagar contadores.
