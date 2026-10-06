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

## 5. Limites conhecidos (o que a extração não dá)

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
