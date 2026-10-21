# Editais do Campus Ivaiporã (extração do site do IFPR)

Como os editais do campus são obtidos para o portal — e por que **não** vêm do SUAP.

## 1. O SUAP não tem editais na API

O `openapi.json` do SUAP (93 rotas, conferido em 06/10/2026) **não expõe nenhum
endpoint de edital**. Os únicos endpoints institucionais de projeto são
`/api/extensao/projetos/` e `/api/pesquisa/projetos/`; o campo `edital` que aparece
em cada projeto é um **número interno**, sem rota para consultá-lo. O SUAP tem
editais na interface web (`/pesquisa/editais/`, atrás de login), mas isso não serve
para sincronização.

Ou seja: edital no portal **não tem de onde vir do SUAP** — a sincronização de
editais que existe no painel tenta três endereços que respondem 404 e devolve o
aviso explicando isso.

## 2. Onde os editais realmente estão

No **site institucional**, em páginas que listam os documentos:

| Fonte | O que tem |
|---|---|
| `ifpr.edu.br/ivaipora/documentos-institucionais/editais/` | página oficial de editais do campus |
| `ifpr.edu.br/ivaipora/copex/bolsas/bolsas-2026-2027/` | bolsas (com botões "Acessar Edital") |
| `ifpr.edu.br/ivaipora/sepae/assistencia-estudantil/` | assistência estudantil |
| `ifpr.edu.br/ivaipora/segepe-.../processos-seletivos-AAAA/` | processos seletivos de servidores (PSS) |
| `ifpr.edu.br/ivaipora/nossos-cursos/{fics,ensino-superior,...}/…/processo-de-selecao/` | seleção por curso |
| `ifpr.edu.br/ivaipora/documentos-institucionais/portarias/` | portarias (não é edital — fica de fora por padrão) |

A leitura é feita pela **API REST do WordPress** (`/wp-json/wp/v2/pages?search=edital`),
que devolve o conteúdo das páginas em JSON — sem depender do layout do site.

## 3. WAF e CORS (o detalhe que define a arquitetura)

O site do IFPR está atrás do **mesmo tipo de WAF** do SUAP (`server: awselb/2.0`):

- da **VPS do portal**: `202` + `x-amzn-waf-action: challenge` (bloqueado);
- de uma **rede comum**: `200` normalmente;
- a API REST devolve **`Access-Control-Allow-Origin`** liberando o domínio do portal
  (testado com `Origin: https://portal.ifcoding.com.br` → ecoado na resposta).

Consequência prática: a extração **funciona no navegador** (o admin passa pelo
desafio como usuário normal) e **não funciona rodando na VPS**. Por isso o módulo de
extração é isomórfico (`src/lib/ifpr-editais.ts`, sem `fs`/`Buffer`) e avisa em vez de
devolver lista vazia quando encontra o desafio.

## 4. Como usar

```bash
npm run editais:ifpr -- editais-ivaipora
npm run editais:ifpr -- editais-2026 --ano=2026 --tipos=EDITAL,RETIFICACAO,RESULTADO
npm run editais:ifpr -- tudo --incluir-portarias
```

Gera `.json` (para processar/importar), `.csv` (Excel, separado por `;`) e `.md`.

Opções: `--ano=`, `--tipos=` (EDITAL, RESULTADO, RETIFICACAO, PRORROGACAO, PORTARIA,
OUTRO), `--areas=` (BOLSAS, ASSISTENCIA_ESTUDANTIL, SERVIDORES, FIC, ENSINO_SUPERIOR,
TECNICO, POS_GRADUACAO, CELIF, PESQUISA, EXTENSAO, INSTITUCIONAL, OUTRO) e
`--incluir-portarias`. Por padrão **portarias ficam de fora**.

### Resultado da primeira extração (06/10/2026)

| | |
|---|---|
| Páginas varridas | 177 (170 com documentos) |
| Documentos encontrados | 2.587 |
| Depois de excluir portarias | **1.585** |
| Período | 2011 a 2026 |
| Por tipo | EDITAL 763 · RESULTADO 737 · RETIFICACAO 74 · PRORROGACAO 11 |
| Por área | SERVIDORES 1093 · INSTITUCIONAL 205 · OUTRO 94 · ASSISTENCIA_ESTUDANTIL 64 · BOLSAS 49 · FIC 45 · ENSINO_SUPERIOR 29 · EXTENSAO 5 · CELIF 1 |

## 5. Como importar para o portal

```bash
npm run editais:portal -- editais-ivaipora.json                # grava
npm run editais:portal -- editais-ivaipora.json --seco         # mostra o que faria
npm run editais:portal -- editais-ivaipora.json --ano-desde=2025 --areas=BOLSAS,FIC
npm run editais:portal -- editais-ivaipora.json --incluir-servidores --destaque
```

Padrões: ano ≥ 2024, tipos EDITAL/RESULTADO/RETIFICACAO/PRORROGACAO, **sem** a área
SERVIDORES (PSS gera centenas de documentos por certame) e sem a área OUTRO.

**Idempotência**: a chave é `Edital.origemRef` (a URL do documento). Reimportar
atualiza os mesmos registros em vez de duplicar — verificado: 1ª execução criou 119,
a 2ª atualizou 119 e criou 0.

### O que fica gravado em cada edital

| Campo | De onde vem |
|---|---|
| `titulo` | título do documento (com contexto quando o rótulo do site é genérico) |
| `numero` / `ano` | extraídos do título e do caminho da página |
| `categoria` | área do site → enum do portal (RESULTADO → RESULTADOS, assistência → AUXILIOS, FIC/ensino → ENSINO…) |
| `areaEdital` | a área **real** do site (coluna nova: o enum `categoria` é mais estreito) |
| `setorResponsavel` / `publicoAlvo` | derivados da área (COPEX, SEPAE, SEGEPE, CELIF, Direção de Ensino…) |
| `resumo` | resumo técnico, com a página de origem (rastreabilidade) |
| `resumoSimples` | **resumo da IFizinha** (ver abaixo) |
| `linkOficial` / `arquivoPdfUrl` | o link para o documento original no site do IFPR |
| `fonteOficial` | "Site do IFPR – Campus Ivaiporã" |
| `origemRef` | URL do documento (chave de idempotência) |
| `source` / `review_status` | `IMPORT` / `PUBLICADO` |

### A regra de honestidade do resumo da IFizinha

O site do IFPR **não publica datas, valores nem requisitos** — isso está dentro do
PDF. O resumo, então, fala só do que a extração sabe (tipo, área, ano) e manda abrir
o documento oficial; `traducaoIFizinha.beneficios` fica **vazio de propósito** e o
campo de prazo diz explicitamente que as datas estão no arquivo. É a mesma regra do
prompt de extração por IA que já existia no portal ("nunca invente dados"), e os
testes travam isso (nada de "R$", data ou carga horária inventados).

Por consequência: **o status é uma estimativa pelo ano** (ano corrente → ABERTO,
anterior → ENCERRADO, resultado → RESULTADO_PUBLICADO). Sem as datas oficiais não há
como afirmar que um edital está aberto — a tela avisa isso e o resumo também.

## 6. Filtros da listagem

`/editais` passou a usar `src/components/editais/EditaisExplorer.tsx`, com filtro de
**busca** (título/resumo/ano, sem acento, todas as palavras), **categoria**,
**área**, **ano**, **situação** e ordenação — mais contadores, botão de limpar e
estado vazio com a IFizinha. A filtragem é função pura testada (`filtrarEditais`).

## 7. Limites conhecidos (o que a extração não dá)

- **Datas de inscrição não existem no HTML** — elas estão dentro do PDF. Um edital
  importado para o portal entra com título, link, categoria/área e ano, mas sem
  "inscrições até"; o status (aberto/encerrado) precisa de decisão humana ou de
  leitura do PDF.
- **Rótulos repetidos**: 145 grupos de títulos iguais (mesmo ano) — são arquivos
  diferentes com o mesmo nome (o mesmo edital publicado em dois lugares), e o `url` é
  o que os distingue.
- **PSS domina a lista** (1.093 de 1.585): processos seletivos de servidores geram
  dezenas de documentos por certame. Para o portal, filtrar por área/ano costuma ser
  o caminho (`--areas=BOLSAS,ASSISTENCIA_ESTUDANTIL,FIC,...`).
- **Rótulo genérico** ("📄 Acessar Edital"): quando não há cabeçalho por perto, o
  título é montado com o contexto da página + nome do arquivo
  (`Bolsas 2026/2027 — SEI 4348270 Chamada Interna Especifica`) — identificável, mas
  não é o título oficial do edital.

## 6. Onde está o quê

| Peça | Arquivo |
|---|---|
| Extração (módulo isomórfico) | `src/lib/ifpr-editais.ts` |
| CLI | `prisma/extrair-editais-ifpr.ts` (`npm run editais:ifpr`) |
| Testes (com HTML real do site) | `tests/ifpr-editais.test.ts` + `tests/fixtures/ifpr-pagina-*.json` |
