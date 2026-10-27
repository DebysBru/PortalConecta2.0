# Importar do SUAP

> **Rotina semanal (use esta):** Painel Master → SUAP → **Carga semanal**
> (`/admin/suap/carga`). Um script, uma colagem, e só o que é novo entra. O resto
> deste documento explica o porquê e os detalhes.

## 0. Carga semanal: editais + projetos numa colagem

O que o admin faz, uma vez por semana (o passo a passo também está no painel):

1. no painel, **Copiar o código da captura**;
2. abrir o SUAP logado → `F12` → Console → colar (no Chrome/Edge, na primeira vez,
   digitar `allow pasting`) → Enter;
3. quando aparecer `✅ Captura pronta`, voltar ao painel, colar o resultado no passo 2
   e **Conferir**;
4. a prévia mostra novos × já existentes; **Importar**.

O script (`public/modelos/capturar-suap-semanal.js`) lê, só com `GET` e na sessão do
admin:

| Fonte | Como |
|---|---|
| `/pesquisa/editais/` | HTML da lista, filtrada por campus (`uo`) |
| `/projetos/editais/` | idem (editais de projetos de extensão) |
| `/projetos_ensino/editais/` | idem (editais de projetos de ensino) |
| projetos de extensão e pesquisa | API do SUAP, como na seção 3 |

**"Só os novos":** a página injeta no código copiado a lista do que o portal já tem
(`window.__portalConectaConhecidos`, montada em `src/lib/suap-carga-contexto.ts`) e o
script descarta esses itens. O servidor confere de novo ao gravar
(`somenteNovos`, padrão), então um arquivo antigo ou "cru" não atualiza nem duplica
nada. Atualizar o existente é uma caixa a marcar na prévia (e, dentro dela,
"sobrescrever edições manuais").

**Por que não há corte por data:** os cartões de edital do SUAP **não mostram ID nem
data de publicação**. Um edital novo pode ter inscrições que já começaram, então
filtrar por "depois da última carga" o perderia. A data da última carga aparece no
guia como informação (e avisa se passou de 8 dias), mas quem decide o que entra é a
identidade.

**Identidade do edital** (`chaveEdital`, igual no script e no servidor — travada em
`tests/suap-captura-script.test.ts`): `suap-edital:<fonte>:<título-normalizado>:<ano
da abertura das inscrições>`, gravada em `Edital.origemRef`. Se o SUAP renomear um
edital, ele chega como novo (o painel avisa em "Se der problema").

**O que fica gravado** (`mapearEditalSuap`): título, descrição, datas reais de
inscrição/resultado/recurso, status calculado por elas, categoria pela fonte
(pesquisa → Pesquisa, projetos → Extensão, ensino → Ensino). O link do PDF **não é
guardado**: o SUAP serve o arquivo por um endereço assinado que expira em minutos e
exige login; o botão do edital aponta para a lista no SUAP. O texto da IFizinha só
repete o que o cartão diz e manda abrir o edital oficial.

**Status que acompanha as datas:** a carga só grava editais novos, então o status
(`ABERTO`, `EM_ANALISE`, `RESULTADO_PUBLICADO`, `ENCERRADO`...) é recalculado depois,
sozinho, sobre as datas gravadas (`src/lib/editais-status.ts`). Não há agendador na
VPS: a conta roda quando alguém abre a home, `/editais` ou um edital, no máximo a cada
10 minutos por processo (poucas dezenas de registros, consulta barata), e invalida o
cache da lista e do chat se algo mudou. A regra é a mesma da importação
(`statusPelasDatas`) — inscrições, fim das inscrições e resultado; o período de
recurso do SUAP não entra (já veio incoerente e o portal não guarda o início dele),
então `PRAZO_RECURSO` não é atribuído a editais do SUAP. Edital **editado à mão** no
portal depois da última carga não é tocado: o status dele passa a ser do admin.

**Falhas:** o script nunca gera "arquivo vazio de aparência normal". Se um grupo
inteiro (as 3 listas, ou os 2 endpoints de projetos) falha, ele fica de fora do JSON e
o `problemas` explica; se nada pôde ser lido, só há um alerta. Se o layout do SUAP
mudar, o script lança erro dizendo qual lista (e a parte que funcionou ainda pode ser
importada).

| Peça | Arquivo |
|---|---|
| Script (navegador) | `public/modelos/capturar-suap-semanal.js` |
| Leitura/identidade/status/mapeamento de editais | `src/lib/suap-editais.ts` |
| Leitura do pacote (editais + projetos) | `src/lib/suap-carga.ts` |
| Lista de conhecidos + última carga | `src/lib/suap-carga-contexto.ts` |
| Gravação (`aplicarEditaisDoSuap`, `somenteNovos`) | `src/lib/suap-sync.ts` |
| Status automático pelas datas | `src/lib/editais-status.ts` (+ `tests/editais-status.test.ts`) |
| Actions (prévia + confirmar) | `src/actions/suap-carga.ts` |
| Tela + guia | `src/app/admin/(protected)/suap/carga/` |
| Testes | `tests/suap-editais.test.ts`, `tests/suap-carga-gravacao.test.ts`, `tests/suap-captura-script.test.ts` |

A lista de editais do SUAP é HTML, não API: foi verificado em 27/10/2026 contra o
HTML real de `/projetos/editais/` e `/projetos_ensino/editais/`; a de
`/pesquisa/editais/` presume o mesmo modelo de cartões e, se divergir, o script avisa
qual lista falhou.

---

## Histórico: importar projetos do SUAP (seções 1 a 5)

Este documento explica **por que** a sincronização automática do SUAP parou de
funcionar, o que a API realmente oferece e **como trazer os projetos hoje**.

## 1. O que está bloqueando (medido, 06/10/2026)

O `suap.ifpr.edu.br` está atrás de um **AWS WAF com desafio de CAPTCHA**. Do
servidor do portal, **toda** requisição volta com:

```
HTTP 405 · server: awselb/2.0 · x-amzn-waf-action: captcha
página: "Human Verification" (challenge.js + captcha.js)
```

| Origem da requisição | `GET /api/openapi.json` | `GET /api/extensao/projetos/` |
|---|---|---|
| VPS do portal (198.44.123.154) | 405 + CAPTCHA | 405 + CAPTCHA |
| Rede comum (navegador/estação) | 200 | 401 `{"detail":"Unauthorized"}` ← resposta legítima da API |

Inclusive `/` e `/robots.txt` são desafiados a partir da VPS. Ou seja, **o bloqueio
acontece antes de a API avaliar qualquer credencial**: nenhum token (JWT, OAuth2,
token pessoal de 24h) contorna isso, e **não era problema de token** quando o
painel dizia "o token não funciona".

> Consequência prática: `GET /api/extensao/projetos/` e `GET /api/pesquisa/projetos/`
> dão 405 **com página HTML de CAPTCHA**, e não 401 — é assim que se distingue
> "WAF bloqueou" de "faltou credencial".

## 2. O que a API do SUAP oferece (schema real, 93 endpoints)

O schema está em `https://suap.ifpr.edu.br/api/openapi.json` (OpenAPI 3.1.0,
"SUAP API 1.0.0") e responde de uma rede comum. Esquemas de autenticação:

| Esquema | Tipo | Uso |
|---|---|---|
| `JWTAuth` | bearer | `POST /api/token/pair` (usuário + senha) → access/refresh |
| `OAuth2TokenAuth` | bearer | fluxo OAuth2 |
| `SessionAuth` | cookie `sessionid` | a sessão do navegador logado |
| `TrustedAppAuth` | bearer | **aplicação confiável** — é o caminho servidor-a-servidor oficial |

Endpoints de projeto (os que o portal usa):

| Endpoint | Resposta |
|---|---|
| `GET /api/extensao/projetos/` (param `page`) | `PagedProjetoSchema` → `results, count, next, previous` |
| `GET /api/pesquisa/projetos/` (param `page`) | idem |

Campos de cada projeto (`ProjetoSchema`): `id, titulo, resumo, dt_inicio, dt_final,
situacao, edital, campus_id, campus_sigla, campus_nome, campus_nome_formatado,
nome_coordenador, email_coordenador, content_type`.

**A API não filtra por campus** — o filtro por `campus_sigla` é feito no portal
(padrão `SUAP_CAMPUS_SIGLA=IVAIPODG`).

## 3. Como importar hoje: captura pelo navegador

Como o navegador do usuário passa pelo WAF (e já tem a sessão do SUAP), a captura é
feita lá — **sem token nenhum**:

1. Entre no SUAP normalmente;
2. `F12` → aba **Console**;
3. cole o conteúdo de [`public/modelos/capturar-suap-semanal.js`](../public/modelos/capturar-suap-semanal.js)
   (ou use o botão **"Copiar o código da captura"** em Painel → SUAP → Importar) e
   aperte Enter. O script faz `GET` em `/api/extensao/projetos/` e
   `/api/pesquisa/projetos/` **do próprio SUAP**, pagina até o fim e junta tudo;
4. o JSON fica na área de transferência (se o navegador bloquear, ele baixa um
   `.json`).

### Se o que você tem é uma tabela, não a captura

Às vezes o que chega é uma **tabela resumida** (ID, título, situação, datas,
coordenação) em vez do JSON da captura. O conversor transforma essa tabela no mesmo
formato aceito aqui:

```bash
python tools/converter-tabela-projetos.py projetos.md projetos.json
python tools/converter-tabela-projetos.py projetos.md projetos.json --fonte=pesquisa --campus=IVAIPODG
```

O que ele **não** inventa: a tabela não diz se o projeto é de extensão ou de
pesquisa, então tudo entra como `extensao` (a menos que se use `--fonte=pesquisa`) —
o portal vai rotular todos como "Extensão". A tabela também não traz `resumo`, então
os cards ficam sem descrição. Quando a captura pelo navegador estiver disponível, ela
é melhor: traz a fonte certa, o resumo, o e-mail da coordenação e o `edital`.

Valide sempre antes de importar — este comando mostra o que seria gravado:

```bash
npm run db:suap -- projetos.json --seco
```

### O script já traz só o campus (IVAIPODG)

A lista do SUAP **não é filtrada por campus** pela API (o parâmetro documentado é
só `page`), então o script resolve isso por conta própria, em duas etapas:

1. ele **testa** se a API aceita `campus_sigla=IVAIPODG` (o total devolvido cai e a
   página vem só com o campus). Se aceitar, usa o filtro do servidor;
2. se a API ignorar o filtro, ele percorre as páginas e **filtra no navegador**.

Nos dois casos o JSON final tem **somente** os projetos do campus configurado. Medido
com a API simulada (2.500 projetos por fonte, 10% do campus):

| Cenário | Projetos no arquivo | Requisições | Tamanho |
|---|---|---|---|
| API aceita o filtro de campus | 250 extensão + 250 pesquisa | 10 | 42 KB |
| API ignora o filtro (filtra no navegador) | 250 + 250 | 52 | 43 KB |
| Paginação de 20 em 20 | 30 + 30 | 32 | 5 KB |

Para capturar outro campus sem editar o arquivo, rode antes no Console:

```js
window.__portalConectaCampus = 'SIGLA'
```

Se nenhum projeto do campus aparecer, o script avisa e **lista as siglas que
encontrou** no SUAP (em vez de devolver um arquivo vazio sem explicação).

Depois, no portal: **Painel → SUAP → "Importar do SUAP"** → cole (ou envie o
arquivo) → **conferir a captura** (prévia com totais por fonte, situação e campus,
mais os itens com problema) → **Importar**.

Pela linha de comando (útil na VPS, sem navegador):

```bash
npm run db:suap -- caminho/projetos-suap-2026-10-06.json            # grava
npm run db:suap -- caminho/projetos-suap-2026-10-06.json --seco     # só analisa
npm run db:suap -- arquivo.json --forcar --campus=IVAIPODG          # sobrescreve edições manuais
```

### O que a importação garante

- **Idempotência**: a chave é o `suapId`, derivado de **fonte + id do SUAP**
  (`src/lib/suap-identidade.ts`) — o mesmo projeto em extensão e pesquisa não
  colide, e reimportar **atualiza** em vez de duplicar (verificado: 1ª execução
  criou 2, a 2ª atualizou 2 e criou 0).
- **Filtro por campus**: só entram projetos do campus configurado; o resto é
  ignorado e o relatório diz quantos.
- **Edição manual preservada**: se o projeto foi editado no portal depois do último
  sync, ele **não** é sobrescrito (a menos que se marque "forçar"), e o relatório
  lista quais foram preservados.
- **Arquivo com BOM** (salvo no Bloco de Notas/PowerShell) é aceito — o BOM é
  removido antes do parse.
- Formatos aceitos: `{extensao: [...], pesquisa: [...]}` (captura), lista simples
  (com `_fonte` por item), `{results: [...]}` cru paginado, ou qualquer um deles
  dentro de `{projetos: ...}`.

## 4. A solução definitiva (lado do IFPR)

Para a sincronização automática voltar, a TI/equipe do SUAP precisa **liberar o IP
do portal no WAF** (ou registrar o portal como *Trusted App*). Pedido técnico:

- **IP de origem**: `198.44.123.154` (VPS do Portal Conecta, Campus Ivaiporã);
- **Rotas**: `GET /api/extensao/projetos/` e `GET /api/pesquisa/projetos/`
  (paginadas por `page`);
- **Autenticação pretendida**: `JWTAuth` (`POST /api/token/pair`) com conta de
  serviço, ou `TrustedAppAuth` se preferirem emitir um token de aplicação;
- **Finalidade**: manter o catálogo de projetos de extensão e pesquisa do campus
  Ivaiporã atualizado no portal institucional do campus;
- **Hoje o sintoma é**: `405` + página "Human Verification"
  (`x-amzn-waf-action: captcha`) para **qualquer** rota, inclusive `/robots.txt`.

Enquanto isso não acontece, a captura pelo navegador resolve — e continua útil
depois, como alternativa quando o SUAP estiver instável.

## 5. Onde está o quê

| Peça | Arquivo |
|---|---|
| Script de captura (roda no navegador) | `public/modelos/capturar-suap-semanal.js` |
| Parser/validação da captura | `src/lib/suap-import.ts` |
| Actions do painel (prévia + confirmar) | `src/actions/suap-carga.ts` |
| Tela de importação (agora redireciona para a Carga semanal) | `src/app/admin/(protected)/suap/importar/` |
| Gravação (mapeamento do SUAP → portal) | `aplicarProjetosDoSuap` em `src/lib/suap-sync.ts` |
| CLI | `prisma/importar-projetos-suap.ts` (`npm run db:suap`) |
| Testes | `tests/suap-import.test.ts` |
