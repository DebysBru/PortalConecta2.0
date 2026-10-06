#!/usr/bin/env python3
"""Gera os ícones do portal (PWA, favicon, Apple) a partir do logo da marca.

Por que existe: os ícones em `public/icons/` e o `favicon.ico` ainda eram a marca
antiga (um quadrado em gradiente com uma estrelinha), de antes do redesign. Aqui
eles são refeitos a partir do **símbolo** do logo oficial — o anel com o mosaico
do IF — que é o que se reconhece em 16 px.

Decisões:
- fundo branco: o símbolo é multicolorido (azul/roxo/rosa/verde) e sumiria sobre o
  gradiente da marca; no branco ele lê bem e combina com `background_color` do
  manifest;
- o ícone `maskable` usa 60% do lado para o símbolo (a zona segura do Android é
  80%, então sobra folga nos recortes circular/squircle);
- o símbolo é isolado por **componente conectada** (BFS no canal alfa), porque o
  anel e o "P" de "Portal" se encostam no antialias: cortar por fração da largura
  ou por coluna vazia sempre trazia um pedaço da letra.

Uso: python tools/gerar-icones-portal.py [origem-logo.png] [destino]
"""

import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ORIGEM = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Ronan\Downloads\IFIZINHA\logoPortal.png"
DESTINO = sys.argv[2] if len(sys.argv) > 2 else os.path.join("public", "icons")

RAIZ_PUBLICA = os.path.dirname(DESTINO.rstrip("/\\")) or "public"

RELATORIO = []


def recortar_simbolo(caminho, limite_alfa=200, passo=2, faixa_texto=(850, 230)):
    """Bounding box da componente conectada do símbolo (o anel), sem o texto.

    O anel e o "P" de "Portal" **se encostam** no arquivo original (mesmo com
    limite de alfa 200, o BFS atravessa), então depois de achar a componente
    apagamos a faixa onde o texto vive — x >= 850 e y >= 230 no logo de 2172x724,
    medido: a bolinha superior direita do anel termina em y ~ 200 e o texto começa
    em x ~ 900.
    """
    img = Image.open(caminho).convert("RGBA")
    largura, altura = img.size
    mascara = img.split()[-1].point(lambda v: 255 if v >= limite_alfa else 0)

    # Trabalha numa versão reduzida (o BFS em Python é lento em 1,5 M de pixels);
    # a máscara já está binarizada, então reduzir não cria pontes de antialias.
    w, h = max(1, largura // passo), max(1, altura // passo)
    pequena = mascara.resize((w, h), Image.BOX).load()

    semente = None
    for x in range(w):
        for y in range(h):
            if pequena[x, y] > 0:
                semente = (x, y)
                break
        if semente:
            break
    if not semente:
        raise SystemExit("não encontrei o símbolo no logo informado")

    visto = bytearray(w * h)
    fila = deque([semente])
    visto[semente[1] * w + semente[0]] = 1
    x0 = x1 = semente[0]
    y0 = y1 = semente[1]

    while fila:
        x, y = fila.popleft()
        x0, x1 = min(x0, x), max(x1, x)
        y0, y1 = min(y0, y), max(y1, y)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visto[ny * w + nx] and pequena[nx, ny] > 0:
                visto[ny * w + nx] = 1
                fila.append((nx, ny))

    margem = 3
    caixa = (
        max(0, (x0 - margem) * passo),
        max(0, (y0 - margem) * passo),
        min(largura, (x1 + margem + 1) * passo),
        min(altura, (y1 + margem + 1) * passo),
    )
    recorte = img.crop(caixa)

    # Apaga o que sobrou do texto (o "P") e reajusta a caixa ao que restou.
    dados = np.array(recorte)
    limite_x = max(0, faixa_texto[0] - caixa[0])
    limite_y = max(0, faixa_texto[1] - caixa[1])
    dados[limite_y:, limite_x:, 3] = 0
    recorte = Image.fromarray(dados)

    sobra = recorte.split()[-1].getbbox()
    if sobra:
        recorte = recorte.crop(sobra)
    return recorte, caixa


def em_fundo_branco(simbolo, lado, ocupacao):
    """Símbolo centralizado num quadrado branco ocupando `ocupacao` do lado."""
    alvo = max(1, round(lado * ocupacao))
    escala = min(alvo / simbolo.width, alvo / simbolo.height)
    redimensionado = simbolo.resize(
        (max(1, round(simbolo.width * escala)), max(1, round(simbolo.height * escala))),
        Image.LANCZOS,
    )
    base = Image.new("RGB", (lado, lado), (255, 255, 255))
    base.paste(
        redimensionado,
        ((lado - redimensionado.width) // 2, (lado - redimensionado.height) // 2),
        redimensionado,
    )
    return base


def salvar(img, caminho):
    img.save(caminho)
    RELATORIO.append((os.path.relpath(caminho), f"{img.width}x{img.height}", round(os.path.getsize(caminho) / 1024, 1)))


def main():
    os.makedirs(DESTINO, exist_ok=True)
    simbolo, caixa = recortar_simbolo(ORIGEM)
    print(f"símbolo recortado: {simbolo.width}x{simbolo.height} (caixa {caixa} em {ORIGEM})")

    salvar(em_fundo_branco(simbolo, 192, 0.82), os.path.join(DESTINO, "icon-192.png"))
    salvar(em_fundo_branco(simbolo, 512, 0.82), os.path.join(DESTINO, "icon-512.png"))
    # maskable: 0.60 deixa o símbolo bem dentro da zona segura de 80%
    salvar(em_fundo_branco(simbolo, 512, 0.60), os.path.join(DESTINO, "icon-maskable-512.png"))

    fonte = em_fundo_branco(simbolo, 512, 0.82)
    fonte.resize((180, 180), Image.LANCZOS).save(os.path.join(RAIZ_PUBLICA, "apple-touch-icon.png"))
    fonte.resize((32, 32), Image.LANCZOS).save(
        os.path.join(RAIZ_PUBLICA, "favicon.ico"),
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    RELATORIO.append(("apple-touch-icon.png", "180x180", round(os.path.getsize(os.path.join(RAIZ_PUBLICA, "apple-touch-icon.png")) / 1024, 1)))
    RELATORIO.append(("favicon.ico", "16/32/48", round(os.path.getsize(os.path.join(RAIZ_PUBLICA, "favicon.ico")) / 1024, 1)))

    print(f"\n{'arquivo':<34}{'tamanho':<12}{'KB':>7}")
    for nome, tamanho, kb in RELATORIO:
        print(f"{nome:<34}{tamanho:<12}{kb:>7}")


if __name__ == "__main__":
    main()
