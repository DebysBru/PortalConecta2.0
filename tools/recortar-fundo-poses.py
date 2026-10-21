#!/usr/bin/env python3
"""Recorta o fundo das poses em JPEG, gerando versões com transparência.

Por que existe: as poses fotografadas (`*.jpeg` do pacote original) vêm com fundo
de estúdio sólido — #FEFEFE, #F7F7F7, #E6E4E9. Sobre uma faixa **branca** esse
fundo aparece como uma caixinha: a diferença de 1-2 níveis já é visível, e a
compressão WebP ainda cria bandas na área chapada. Resultado: a mascote parece
colada por cima da página (relatado no cabeçalho de /projetos).

Como funciona: o fundo é removido por **inundação a partir das bordas** (flood
fill), e não por "apagar todo pixel claro". Essa diferença é o que preserva a
camiseta branca da IFizinha — ela está dentro da silhueta e nunca é alcançada pela
inundação. No fim a borda ganha um leve esmaecimento para não ficar serrilhada.

Uso: python tools/recortar-fundo-poses.py [origem] [destino]
"""

import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ORIGEM = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Ronan\Downloads\IFIZINHA"
DESTINO = sys.argv[2] if len(sys.argv) > 2 else os.path.join("public", "ifizinha")

# (arquivo de origem, nome de saída, tolerância, esmaecimento da borda)
POSES = [
    ("2.jpeg", "pose-de-costas-recorte.webp", 26, 0.8),
    ("editais em destaque.jpeg", "pose-editais-recorte.webp", 26, 0.8),
    ("projetos e destaque.jpeg", "pose-projetos-recorte.webp", 22, 0.8),
    ("prox eventos e prazos.jpeg", "pose-prazos-recorte.webp", 22, 0.8),
    ("1.jpeg", "pose-apontando-logo-recorte.webp", 22, 0.8),
]


def achar_origem(pasta, nome):
    """O pacote tem nome com acento e espaço — procura sem depender da grafia."""
    if os.path.exists(os.path.join(pasta, nome)):
        return os.path.join(pasta, nome)
    alvo = nome.lower()
    for arquivo in os.listdir(pasta):
        if arquivo.lower() == alvo:
            return os.path.join(pasta, arquivo)
    raise FileNotFoundError(nome)


def fundo_cor(img):
    """Cor do fundo = mediana de uma moldura fina (o sujeito não toca a borda)."""
    a = np.array(img.convert("RGB")).astype(np.int16)
    altura, largura, _ = a.shape
    margem = max(2, int(min(altura, largura) * 0.01))
    faixas = np.concatenate([
        a[:margem, :, :].reshape(-1, 3),
        a[-margem:, :, :].reshape(-1, 3),
        a[:, :margem, :].reshape(-1, 3),
        a[:, -margem:, :].reshape(-1, 3),
    ])
    return np.median(faixas, axis=0)


def recortar(caminho, tolerancia=24, esmaecer=0.8):
    """Devolve RGBA com o fundo (conectado às bordas) transparente."""
    img = Image.open(caminho).convert("RGB")
    dados = np.array(img).astype(np.int16)
    altura, largura, _ = dados.shape
    fundo = fundo_cor(img)

    # Distância L1 até a cor do fundo. `parede` = candidato a fundo.
    distancia = np.abs(dados - fundo).sum(axis=2)
    parede = distancia <= tolerancia

    # Inundação 4-conexa a partir de TODA a borda que é candidata.
    visitado = np.zeros((altura, largura), dtype=bool)
    fila = deque()
    for x in range(largura):
        for y in (0, altura - 1):
            if parede[y, x] and not visitado[y, x]:
                visitado[y, x] = True
                fila.append((y, x))
    for y in range(altura):
        for x in (0, largura - 1):
            if parede[y, x] and not visitado[y, x]:
                visitado[y, x] = True
                fila.append((y, x))

    while fila:
        y, x = fila.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < altura and 0 <= nx < largura and parede[ny, nx] and not visitado[ny, nx]:
                visitado[ny, nx] = True
                fila.append((ny, nx))

    alfa = np.where(visitado, 0, 255).astype(np.uint8)
    mascara = Image.fromarray(alfa, mode="L")
    if esmaecer:
        mascara = mascara.filter(ImageFilter.GaussianBlur(esmaecer))

    saida = img.convert("RGBA")
    saida.putalpha(mascara)

    # Recorta o vazio que sobra em volta (a pose fica "justa" no arquivo).
    caixa = saida.split()[-1].point(lambda v: 255 if v > 8 else 0).getbbox()
    if caixa:
        saida = saida.crop(caixa)
    return saida, float(visitado.mean())


def main():
    os.makedirs(DESTINO, exist_ok=True)
    print(f"{'saída':<36}{'tamanho':<14}{'fundo removido':>16}{'KB':>8}")
    for origem, nome_saida, tolerancia, esmaecer in POSES:
        try:
            caminho = achar_origem(ORIGEM, origem)
        except FileNotFoundError:
            print(f"{nome_saida:<36}origem não encontrada: {origem}")
            continue

        # Reduz antes de recortar: o alvo no site é 800px de largura.
        img = Image.open(caminho)
        if img.width > 800:
            img = img.resize((800, round(img.height * 800 / img.width)), Image.LANCZOS)
            temporario = os.path.join(DESTINO, "_temp.png")
            img.save(temporario)
            caminho = temporario

        recortada, removido = recortar(caminho, tolerancia, esmaecer)
        destino = os.path.join(DESTINO, nome_saida)
        recortada.save(destino, "WEBP", quality=88, method=6)
        print(f"{nome_saida:<36}{recortada.width}x{recortada.height:<8}{removido * 100:>14.1f}%{os.path.getsize(destino) / 1024:>8.1f}")
        if os.path.exists(os.path.join(DESTINO, "_temp.png")):
            os.remove(os.path.join(DESTINO, "_temp.png"))


if __name__ == "__main__":
    main()
