# Importar projetos do SUAP

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
3. cole o conteúdo de [`public/modelos/capturar-projetos-suap.js`](../public/modelos/capturar-projetos-suap.js)
   (ou use o botão **"Copiar o código da captura"** em Painel → SUAP → Importar) e
   aperte Enter. O script faz `GET` em `/api/extensao/projetos/` e
   `/api/pesquisa/projetos/` **do próprio SUAP**, pagina até o fim e junta tudo;
4. o JSON fica na área de transferência (se o navegador bloquear, ele baixa um
   `.json`).

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
| Script de captura (roda no navegador) | `public/modelos/capturar-projetos-suap.js` |
| Parser/validação da captura | `src/lib/suap-import.ts` |
| Actions do painel (prévia + confirmar) | `src/actions/suap-import.ts` |
| Tela de importação | `src/app/admin/(protected)/suap/importar/` |
| Gravação (mapeamento do SUAP → portal) | `aplicarProjetosDoSuap` em `src/lib/suap-sync.ts` |
| CLI | `prisma/importar-projetos-suap.ts` (`npm run db:suap`) |
| Testes | `tests/suap-import.test.ts` |
