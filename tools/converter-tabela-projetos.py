#!/usr/bin/env python3
"""Converte uma tabela markdown de projetos do SUAP no JSON que o portal importa.

Por que existe: a captura pelo navegador
(`public/modelos/capturar-projetos-suap.js`) devolve o JSON pronto, mas às vezes o
que se tem em mãos é uma **tabela resumida** (ID, título, situação, datas,
coordenação) vinda de uma consulta ou de um relatório. Este script transforma essa
tabela no mesmo formato aceito por Painel → SUAP → "Importar do SUAP" e pelo CLI
`npm run db:suap`.

O que ele NÃO inventa: a tabela não diz se o projeto é de extensão ou de pesquisa,
então tudo entra como `extensao` (o `--fonte=pesquisa` existe para o caso de a
tabela ser de pesquisa). Se a origem importa para você, capture pelo script do
navegador — ele marca a fonte e ainda traz `resumo` e e-mail do coordenador.

Uso:
    python tools/converter-tabela-projetos.py entrada.md saida.json [--fonte=extensao]
"""

import argparse
import json
import os
import re
import sys
from datetime import date, datetime

CABECALHO_ESPERADO = ["id", "projeto", "situacao", "inicio", "fim", "coordenador"]

# "Situação" da tabela → texto que o portal entende (o mapeamento para o enum
# StatusProjeto acontece depois, em mapStatusProjeto)
SITUACOES = {
    "em execução": "Em execução",
    "em execucao": "Em execução",
    "concluído": "Concluído",
    "concluido": "Concluído",
    "suspenso": "Suspenso",
    "cancelado": "Cancelado",
}


def sem_acento(texto: str) -> str:
    import unicodedata

    return "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    ).lower().strip()


def limpar(celula: str) -> str:
    """Tira o `|`, espaços e o escape de pipe do markdown."""
    return celula.strip().replace("\\|", "|")


def como_iso(valor: str) -> str | None:
    """Aceita AAAA-MM-DD e DD/MM/AAAA; devolve AAAA-MM-DD."""
    texto = valor.strip()
    if not texto or texto in {"-", "—"}:
        return None
    for formato in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(texto, formato).date().isoformat()
        except ValueError:
            continue
    return None


def achar_colunas(cabecalho: list[str]) -> dict[str, int]:
    """Mapeia cada campo esperado para o índice da coluna, tolerando variações.

    O cabeçalho real traz `Coordenador(a)`, `Situação`, `Início`... — então o
    casamento é por **prefixo sem acento** ("coordenador" casa com
    "coordenador(a)", "coordenadora", "coordenador"). Foi um bug real: sem isso a
    coluna de coordenação vinha vazia na conversão.
    """
    mapa: dict[str, int] = {}
    for campo in CABECALHO_ESPERADO:
        for indice, nome in enumerate(cabecalho):
            if nome.startswith(campo):
                mapa[campo] = indice
                break
    return mapa


def ler_tabela(caminho: str):
    """Devolve (linhas, problemas): cada linha é um dicionário já normalizado."""
    linhas: list[dict] = []
    problemas: list[str] = []
    vistos: set[int] = set()

    with open(caminho, encoding="utf-8-sig") as arquivo:
        conteudo = arquivo.read().splitlines()

    cabecalho = None
    colunas: dict[str, int] | None = None
    for numero, bruta in enumerate(conteudo, start=1):
        linha = bruta.strip()
        if not linha.startswith("|"):
            continue

        celulas = [limpar(c) for c in linha.strip("|").split("|")]

        # Linha separadora do markdown (`|---|---|`)
        if all(re.fullmatch(r":?-{2,}:?", c) for c in celulas if c != ""):
            continue

        # Cabeçalho da tabela
        if cabecalho is None:
            candidato = [sem_acento(c) for c in celulas]
            if candidato[:2] == CABECALHO_ESPERADO[:2]:
                cabecalho = candidato
                continue
            problemas.append(f"linha {numero}: tabela sem cabeçalho reconhecível (esperado: {' | '.join(CABECALHO_ESPERADO)})")
            return [], problemas

        if len(celulas) < 3:
            problemas.append(f"linha {numero}: menos de 3 colunas")
            continue

        # Mapeia as colunas pelo cabeçalho, tolerando ordem e variações de nome
        if colunas is None:
            colunas = achar_colunas(cabecalho)
        valor = {}
        for campo, indice in colunas.items():
            valor[campo] = celulas[indice] if indice < len(celulas) else ""

        id_bruto = re.sub(r"\D", "", valor.get("id", ""))
        if not id_bruto:
            problemas.append(f"linha {numero}: sem ID numérico")
            continue
        id_projeto = int(id_bruto)
        if id_projeto in vistos:
            problemas.append(f"linha {numero}: ID {id_projeto} repetido (ignorado)")
            continue

        titulo = valor.get("projeto", "").strip()
        if len(titulo) < 3:
            problemas.append(f"linha {numero}: título vazio ou curto demais")
            continue

        situacao_bruta = valor.get("situacao", "").strip()
        situacao = SITUACOES.get(sem_acento(situacao_bruta), situacao_bruta or None)

        inicio = como_iso(valor.get("inicio", ""))
        fim = como_iso(valor.get("fim", ""))
        if valor.get("inicio", "").strip() and not inicio:
            problemas.append(f"linha {numero}: data de início inválida ({valor['inicio'].strip()})")
        if valor.get("fim", "").strip() and not fim:
            problemas.append(f"linha {numero}: data final inválida ({valor['fim'].strip()})")

        vistos.add(id_projeto)
        linhas.append(
            {
                "id": id_projeto,
                "titulo": titulo,
                "situacao": situacao,
                "dt_inicio": inicio,
                "dt_final": fim,
                "nome_coordenador": valor.get("coordenador", "").strip() or None,
            }
        )

    if cabecalho is None:
        problemas.append("nenhuma tabela markdown encontrada no arquivo")

    return linhas, problemas


def main():
    parser = argparse.ArgumentParser(description="Converte tabela markdown de projetos no JSON de importação do portal.")
    parser.add_argument("entrada", help="arquivo .md com a tabela")
    parser.add_argument("saida", help="arquivo .json a gerar")
    parser.add_argument("--campus", default="IVAIPODG", help="sigla do campus (padrão: IVAIPODG)")
    parser.add_argument("--campus-nome", default="Ivaiporã", help="nome do campus")
    parser.add_argument("--fonte", default="extensao", choices=["extensao", "pesquisa"], help="fonte dos projetos da tabela")
    args = parser.parse_args()

    linhas, problemas = ler_tabela(args.entrada)
    if not linhas:
        print("Nenhum projeto lido.", file=sys.stderr)
        for problema in problemas:
            print(f"  - {problema}", file=sys.stderr)
        sys.exit(1)

    projetos = [
        {
            "id": linha["id"],
            "titulo": linha["titulo"],
            "resumo": None,
            "dt_inicio": linha["dt_inicio"],
            "dt_final": linha["dt_final"],
            "situacao": linha["situacao"],
            "campus_id": None,
            "campus_sigla": args.campus,
            "campus_nome": args.campus_nome,
            "nome_coordenador": linha["nome_coordenador"],
            "email_coordenador": None,
        }
        for linha in linhas
    ]

    pacote = {
        "origem": f"conversao-tabela:{os.path.basename(args.entrada)}",
        "geradoEm": datetime.now().isoformat(timespec="seconds"),
        "campus": args.campus,
        "fonte": args.fonte,
        "resumo": {args.fonte: len(projetos), "total": len(projetos)},
        args.fonte: projetos,
        # A outra fonte vai vazia para o arquivo já ter as duas chaves que o
        # importador do portal espera.
        ("pesquisa" if args.fonte == "extensao" else "extensao"): [],
    }

    with open(args.saida, "w", encoding="utf-8") as arquivo:
        json.dump(pacote, arquivo, ensure_ascii=False, indent=2)
        arquivo.write("\n")

    por_situacao: dict[str, int] = {}
    for projeto in projetos:
        chave = projeto["situacao"] or "(sem situação)"
        por_situacao[chave] = por_situacao.get(chave, 0) + 1

    datas = [p["dt_inicio"] for p in projetos if p["dt_inicio"]]
    print(f"lidos: {len(projetos)} projeto(s) de {args.entrada}")
    print(f"por situação: {por_situacao}")
    if datas:
        print(f"período: {min(datas)} a {max(datas)}")
    print(f"campus: {args.campus} | fonte marcada: {args.fonte}")
    if problemas:
        print(f"\n{len(problemas)} aviso(s):")
        for problema in problemas[:15]:
            print(f"  - {problema}")
    print(f"\ngravado: {args.saida} ({os.path.getsize(args.saida) / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
