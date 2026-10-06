#!/usr/bin/env python3
"""Gera o modelo de importação da Agenda e o dataset do Calendário 2026.

Entrada: a planilha `Calendario_IFPR_Ivaipora_2026_Classificado_REGERADO.xlsx`,
aba **"Agenda filtrável"** (239 linhas dia-evento, uma por dia marcado), que é a
versão já classificada do Calendário Acadêmico do Campus Ivaiporã.

Saídas (em `public/modelos/`):
- `calendario-academico-modelo.csv` / `.json` — modelo com cabeçalho + exemplos,
  para qualquer pessoa montar o próprio arquivo;
- `calendario-ifpr-ivaipora-2026.csv` / `.json` — o calendário de 2026 pronto para
  importar pelo botão "Importar calendário" do painel.

Por que agrupar: a planilha tem **uma linha por dia** (239), mas o modelo `Evento`
do portal tem `data` + `dataFim`. Dias consecutivos do mesmo evento viram **um**
evento com intervalo; datas soltas do mesmo evento (ex.: "1, 15 e 30") viram um
evento por data, com sufixo no `ref` para a importação continuar idempotente.

Colunas do CSV (separador `;`, para abrir direto no Excel pt-BR):

    ref;tipo;titulo;descricao;data;dataFim;categoria;subcategoria;publico;nivel;natureza;interessaAlunos;interessaProfessores;local

`tipo` é opcional: quando vem vazio, o importador deduz do par
categoria/subcategoria (mesma tabela de regras usada aqui em `mapear_tipo`).

Uso: python tools/gerar-calendario-2026.py [planilha] [destino]
"""

import csv
import json
import os
import sys
from datetime import date, datetime, timedelta

import openpyxl

PLANILHA = sys.argv[1] if len(sys.argv) > 1 else (
    r"C:\Users\Ronan\Downloads\Calendario_IFPR_Ivaipora_2026_Classificado_REGERADO.xlsx"
)
DESTINO = sys.argv[2] if len(sys.argv) > 2 else os.path.join("public", "modelos")
ABA = "Agenda filtrável"

COLUNAS = [
    "ref", "tipo", "titulo", "descricao", "data", "dataFim", "categoria",
    "subcategoria", "publico", "nivel", "natureza", "interessaAlunos",
    "interessaProfessores", "local",
]

# categoria/subcategoria da planilha -> TipoEvento do portal (prisma/schema.prisma).
# As chaves de subcategoria têm prioridade sobre as de categoria.
TIPO_POR_SUBCATEGORIA = {
    "feriado": "FERIADO",
    "recesso": "RECESSO",
    "férias escolares/docentes": "RECESSO",
    "matrícula / rematrícula": "INSCRICAO",
    "edital / processo seletivo": "PRAZO_EDITAL",
    "resultados / registros acadêmicos": "RESULTADO",
    "vida acadêmica do estudante": "PRAZO_EDITAL",
    "formação pedagógica": "FORMACAO",
    "conselho de classe": "CONSELHO_CLASSE",
    "planejamento coletivo": "REUNIAO",
    "reunião com responsáveis": "REUNIAO",
    "entrega docente": "PRAZO_EDITAL",
    "calendário letivo": "LETIVO_INICIO_FIM",
    "evento acadêmico / científico / cultural": "EVENTO_ACADEMICO",
    "mostra / orientação acadêmica": "EVENTO_ACADEMICO",
    "evento de curso / egressos": "EVENTO_PROJETO",
    "evento de curso": "EVENTO_PROJETO",
    "evento esportivo / competição": "EVENTO_CAMPUS",
    "data comemorativa / institucional": "EVENTO_CAMPUS",
}

TIPO_POR_CATEGORIA = {
    "feriado / recesso / férias": "RECESSO",
    "prazo / edital / burocracia": "PRAZO_EDITAL",
    "gestão pedagógica / docente": "REUNIAO",
    "atividade acadêmica": "LETIVO_INICIO_FIM",
    "data comemorativa / institucional": "EVENTO_CAMPUS",
    "evento específico de curso": "EVENTO_PROJETO",
}


def mapear_tipo(categoria, subcategoria):
    chave_sub = (subcategoria or "").strip().lower()
    if chave_sub in TIPO_POR_SUBCATEGORIA:
        return TIPO_POR_SUBCATEGORIA[chave_sub]
    chave_cat = (categoria or "").strip().lower()
    return TIPO_POR_CATEGORIA.get(chave_cat, "EVENTO_CAMPUS")


def como_data(valor):
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    if isinstance(valor, str) and valor.strip():
        texto = valor.strip()
        for formato in ("%d/%m/%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(texto, formato).date()
            except ValueError:
                continue
    return None


def agrupar_intervalos(datas):
    """Converte uma lista de datas em faixas contíguas: [(inicio, fim), ...]."""
    ordenadas = sorted(set(datas))
    faixas = []
    inicio = anterior = ordenadas[0]
    for dia in ordenadas[1:]:
        if dia - anterior == timedelta(days=1):
            anterior = dia
            continue
        faixas.append((inicio, anterior))
        inicio = anterior = dia
    faixas.append((inicio, anterior))
    return faixas


def ler_planilha(caminho):
    wb = openpyxl.load_workbook(caminho, data_only=True)
    ws = wb[ABA]
    linhas = list(ws.iter_rows(values_only=True))
    cabecalho = [str(c).strip() if c is not None else "" for c in linhas[3]]
    indice = {nome: i for i, nome in enumerate(cabecalho)}

    por_evento = {}
    for linha in linhas[4:]:
        if not linha or linha[0] in (None, ""):
            continue
        dia = como_data(linha[indice["Data"]])
        if not dia:
            continue
        id_evento = linha[indice["ID evento"]]
        chave = str(id_evento) if id_evento not in (None, "") else f"sem-id-{dia.isoformat()}"
        registro = por_evento.setdefault(chave, {"datas": [], "celulas": linha})
        registro["datas"].append(dia)
        registro["celulas"] = linha
    return por_evento


def montar_eventos(por_evento):
    eventos = []
    for numero, (chave, dados) in enumerate(sorted(por_evento.items(), key=lambda kv: min(kv[1]["datas"])), start=1):
        linha = dados["celulas"]
        col = lambda nome: linha[[c for c in range(len(linha))][0]]  # placeholder (substituído abaixo)
        eventos.append((chave, dados, numero))
    return eventos


def main():
    os.makedirs(DESTINO, exist_ok=True)
    wb = openpyxl.load_workbook(PLANILHA, data_only=True)
    ws = wb[ABA]
    linhas = list(ws.iter_rows(values_only=True))
    cabecalho = [str(c).strip() if c is not None else "" for c in linhas[3]]
    idx = {nome: i for i, nome in enumerate(cabecalho)}

    por_evento = {}
    for linha in linhas[4:]:
        if not linha or linha[0] in (None, ""):
            continue
        dia = como_data(linha[idx["Data"]])
        if not dia:
            continue
        id_evento = linha[idx["ID evento"]]
        chave = str(id_evento) if id_evento not in (None, "") else f"s/{dia.isoformat()}"
        registro = por_evento.setdefault(chave, {"datas": [], "linha": linha})
        registro["datas"].append(dia)
        registro["linha"] = linha

    registros_csv = []
    for chave, dados in sorted(por_evento.items(), key=lambda kv: (min(kv[1]["datas"]), kv[0])):
        linha = dados["linha"]
        valor = lambda nome: ("" if linha[idx[nome]] in (None, "") else str(linha[idx[nome]]).strip())
        categoria = valor("Categoria")
        subcategoria = valor("Subcategoria")
        faixas = agrupar_intervalos(dados["datas"])
        for posicao, (inicio, fim) in enumerate(faixas, start=1):
            sufixo = "" if len(faixas) == 1 else f"-{posicao}"
            registros_csv.append({
                "ref": f"cal2026-{int(chave):03d}{sufixo}" if chave.isdigit() else f"cal2026-{chave}{sufixo}",
                "tipo": mapear_tipo(categoria, subcategoria),
                "titulo": valor("Evento / descrição oficial"),
                "descricao": "",
                "data": inicio.strftime("%d/%m/%Y"),
                "dataFim": "" if fim == inicio else fim.strftime("%d/%m/%Y"),
                "categoria": categoria,
                "subcategoria": subcategoria,
                "publico": valor("Público principal"),
                "nivel": valor("Curso / nível"),
                "natureza": valor("Natureza da ação"),
                "interessaAlunos": valor("Interessa alunos?"),
                "interessaProfessores": valor("Interessa professores?"),
                "local": "",
            })

    # Dataset completo (2026)
    caminho_csv = os.path.join(DESTINO, "calendario-ifpr-ivaipora-2026.csv")
    with open(caminho_csv, "w", newline="", encoding="utf-8-sig") as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=COLUNAS, delimiter=";")
        escritor.writeheader()
        escritor.writerows(registros_csv)

    caminho_json = os.path.join(DESTINO, "calendario-ifpr-ivaipora-2026.json")
    with open(caminho_json, "w", encoding="utf-8") as arquivo:
        json.dump(registros_csv, arquivo, ensure_ascii=False, indent=2)

    # Modelo com exemplos (para quem for montar o próprio arquivo)
    exemplo = registros_csv[:3] + [
        {
            "ref": "exemplo-1",
            "tipo": "PRAZO_EDITAL",
            "titulo": "Encerramento das inscrições do Edital 01/2026",
            "descricao": "Último dia para enviar a documentação pelo portal.",
            "data": "30/10/2026",
            "dataFim": "",
            "categoria": "Prazo / edital / burocracia",
            "subcategoria": "Edital / processo seletivo",
            "publico": "Alunos",
            "nivel": "Geral / Campus",
            "natureza": "Prazo",
            "interessaAlunos": "Sim",
            "interessaProfessores": "Não",
            "local": "Portal Conecta",
        },
        {
            "ref": "exemplo-2",
            "tipo": "EVENTO_CAMPUS",
            "titulo": "Semana da Ciência e Tecnologia",
            "descricao": "",
            "data": "10/11/2026",
            "dataFim": "13/11/2026",
            "categoria": "Evento específico de curso",
            "subcategoria": "Evento acadêmico / científico / cultural",
            "publico": "Comunidade acadêmica",
            "nivel": "Geral / Campus",
            "natureza": "Informativo",
            "interessaAlunos": "Sim",
            "interessaProfessores": "Sim",
            "local": "Campus Ivaiporã",
        },
    ]
    caminho_modelo = os.path.join(DESTINO, "calendario-academico-modelo.csv")
    with open(caminho_modelo, "w", newline="", encoding="utf-8-sig") as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=COLUNAS, delimiter=";")
        escritor.writeheader()
        escritor.writerows(exemplo)

    caminho_modelo_json = os.path.join(DESTINO, "calendario-academico-modelo.json")
    with open(caminho_modelo_json, "w", encoding="utf-8") as arquivo:
        json.dump(exemplo, arquivo, ensure_ascii=False, indent=2)

    print(f"eventos na planilha (dias): {sum(len(d['datas']) for d in por_evento.values())}")
    print(f"eventos consolidados: {len(por_evento)}")
    print(f"linhas geradas no CSV: {len(registros_csv)}")
    print()
    for nome in (caminho_modelo, caminho_modelo_json, caminho_csv, caminho_json):
        print(f"  {nome}  ({os.path.getsize(nome) / 1024:.1f} KB)")
    print()
    print("amostra:")
    for registro in registros_csv[:4]:
        print("  ", " | ".join([registro["ref"], registro["tipo"], registro["data"], registro["dataFim"] or "-", registro["titulo"][:52]]))


if __name__ == "__main__":
    main()
