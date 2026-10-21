# Importar o calendário acadêmico na Agenda

Este documento descreve o **modelo de arquivo** aceito pela Agenda, como importar
pelo painel e como o estudante acompanha as datas.

## 1. Onde importar

**Painel → Agenda → "Importar calendário"** (`/admin/agenda/importar`).

A tela funciona em dois passos, de propósito:

1. **Prévia** — mostra quantos eventos vieram, quantos são novos, quantos já
   existem (pela `ref`), o período coberto, a contagem por categoria e por mês, e
   a lista de linhas com problema (com o número da linha);
2. **Confirmar** — grava de fato. Antes de gravar dá para desmarcar
   "atualizar os eventos que já existem".

Arquivos prontos para baixar direto da tela:

| Arquivo | Para que serve |
|---|---|
| `/modelos/calendario-academico-modelo.csv` | modelo com cabeçalho + 2 exemplos |
| `/modelos/calendario-academico-modelo.json` | o mesmo modelo em JSON |
| `/modelos/calendario-ifpr-ivaipora-2026.csv` | **Calendário 2026 do campus, pronto** (110 linhas) |
| `/modelos/calendario-ifpr-ivaipora-2026.json` | o mesmo calendário em JSON |

Os dois últimos são gerados por `tools/gerar-calendario-2026.py` a partir da
planilha classificada (`Calendario_IFPR_Ivaipora_2026_Classificado_REGERADO.xlsx`,
aba "Agenda filtrável").

## 2. O modelo (CSV ou JSON)

Uma linha = um evento. Separador do CSV: `;`, `,` ou TAB (é detectado). Datas em
`DD/MM/AAAA` ou `AAAA-MM-DD`. Linhas começando com `#` são ignoradas.

| Coluna | Obrigatória | O que é |
|---|---|---|
| `ref` | não | Chave única do evento. Repetir a mesma `ref` **atualiza** em vez de duplicar. Sem ela, o sistema gera uma a partir do título e da data. |
| `titulo` | **sim** | Título do evento. |
| `data` | **sim** | Data de início. |
| `dataFim` | não | Fim do período (ex.: férias de 05 a 30). |
| `tipo` | não | Um dos tipos do portal (`FERIADO`, `RECESSO`, `PRAZO_EDITAL`, `INSCRICAO`, `LETIVO_INICIO_FIM`, `CONSELHO_CLASSE`, `REUNIAO`, `FORMACAO`, `RESULTADO`, `EVENTO_CAMPUS`, `EVENTO_PROJETO`, `EVENTO_ACADEMICO`...). Sem ele, é deduzido da categoria. |
| `categoria` | não | Categoria do calendário (ex.: `Feriado / recesso / férias`) — vira um filtro na agenda. |
| `subcategoria` | não | Detalhe da categoria (ex.: `Matrícula / rematrícula`). |
| `publico` | não | Público principal (`Alunos`, `Professores / servidores`, `Comunidade acadêmica`...). |
| `nivel` | não | Curso ou nível (`Geral / Campus`, `Graduação`...). |
| `natureza` | não | `Informativo`, `Prazo`... |
| `interessaAlunos` | não | `Sim`/`Não` — alimenta o filtro "Interessa a alunos". |
| `interessaProfessores` | não | `Sim`/`Não` — alimenta o filtro "Interessa a professores". |
| `descricao` | não | Texto livre. |
| `local` | não | Local do evento. |

Os nomes das colunas são tolerantes: `Título`, `titulo`, `titulo`, `Público
principal`, `publicoAlvo`, `Data`, `dataInicio`... todos são reconhecidos (com ou
sem acento, maiúsculas ou minúsculas).

### Exemplo mínimo

```csv
ref;titulo;data;dataFim;categoria;subcategoria;publico;interessaAlunos;interessaProfessores
cal2026-011;REMATRÍCULA 2026;22/01/2026;26/01/2026;Prazo / edital / burocracia;Matrícula / rematrícula;Cursos Técnicos Integrados;Sim;Sim
cal2026-012;CONFRATERNIZAÇÃO UNIVERSAL - FERIADO NACIONAL;01/01/2026;;Feriado / recesso / férias;Feriado;Alunos e professores;Sim;Sim
```

### Mesmo conteúdo em JSON

```json
[
  {
    "ref": "cal2026-011",
    "titulo": "REMATRÍCULA 2026",
    "data": "22/01/2026",
    "dataFim": "26/01/2026",
    "categoria": "Prazo / edital / burocracia",
    "subcategoria": "Matrícula / rematrícula",
    "publico": "Cursos Técnicos Integrados",
    "interessaAlunos": "Sim",
    "interessaProfessores": "Sim"
  }
]
```

O JSON também aceita um objeto com a chave `eventos`.

## 3. Por que reimportar não duplica

Cada evento importado guarda a `ref` do arquivo em `Evento.origemRef` (coluna
única). Reimportar o mesmo arquivo:

- **atualiza** quem tem a mesma `ref` (corrigiu a planilha? basta importar de novo);
- **cria** só o que é novo.

Os eventos criados à mão no painel não têm `origemRef` e nunca são tocados pela
importação.

## 4. Importar pela linha de comando (operação)

Para subir o calendário inteiro de uma vez, sem abrir o navegador:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' \
  prisma/importar-calendario.ts public/modelos/calendario-ifpr-ivaipora-2026.csv
```

Opções: `--email=alguem@ifpr.edu.br` (autor dos eventos; padrão: primeiro ADMIN),
`--seco` (só analisa e mostra o resumo) e `--nao-atualizar` (não mexe no que já
existe). O script usa **o mesmo parser** da tela (`src/lib/agenda-import.ts`).

## 5. O que o estudante pode fazer na agenda

| Ação | Como |
|---|---|
| Filtrar | busca por texto, tipo, categoria, público, "interessa a alunos/professores", período (próximos 60 dias, este mês, este ano, tudo) |
| Acompanhar **um** evento | botão de sino no card do evento |
| Acompanhar **todos de um filtro** | "Acompanhar os N deste filtro" (usa o filtro que está na tela) |
| Acompanhar **o calendário inteiro** | botão no topo — vale também para o que for importado depois |
| Levar para o seu calendário | "Exportar .ics" (sai igual ao que está na tela; com "só o que eu acompanho" ativo, sai só a seleção) |
| Ver depois | o que é acompanhado aparece também em **Minha área → Favoritos** |

Sem login, os botões levam para `/minha-area` — acompanhamento precisa de conta
para ter onde ser guardado.

Guardado onde: eventos individuais em `Favorito` (`entidade = 'evento'`), o
"calendário inteiro" em `AgendaPreferencia.seguirTudo`.

## 6. Filtros do arquivo .ics

`/api/events/ics` aceita os mesmos filtros da tela:
`?tipo=`, `?categoria=`, `?publico=`, `?interesse=alunos|professores`,
`?periodo=proximos|mes|ano` e `?seguindo=1` (só o que o estudante logado
acompanha; sem login é ignorado).
