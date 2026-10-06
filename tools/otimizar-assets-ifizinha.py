#!/usr/bin/env python3
"""Otimiza os assets da IFizinha para `public/ifizinha/`.

Por que este script existe (ver DOCUMENTACAO/REDESIGN_IFIZINHA.md):
- os 22 arquivos originais somam 14,7 MB e nenhum pode ir para produção como
  está (um ícone de 1254x1254 que aparece em 64 px pesa 800 KB);
- o `sharp` NÃO está instalado (nem local, nem na VPS), então o `/_next/image`
  cai no fallback do Next — que funciona, mas gasta CPU da VPS a cada
  requisição. Pré-otimizar aqui deixa o site servir o arquivo direto.

Regra de fundo (medida pixel a pixel):
- `.png` de origem = recorte com transparência → mantém alfa (WebP com alfa);
- `.jpeg` de origem = fundo sólido → entra só em seção com o mesmo tom
  (#F7F7F7 → gray-50, #FDFDFD/#FEFEFE → branco) ou como faixa/cena.

Uso:
    python tools/otimizar-assets-ifizinha.py [origem] [destino]
"""

import glob
import json
import os
import sys

from PIL import Image

ORIGEM = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Ronan\Downloads\IFIZINHA"
DESTINO = sys.argv[2] if len(sys.argv) > 2 else os.path.join("public", "ifizinha")

RELATORIO = []


def buscar(padrao):
    """Resolve o arquivo de origem por padrão (evita nome acentuado no código)."""
    achados = sorted(glob.glob(os.path.join(ORIGEM, padrao)))
    if not achados:
        raise FileNotFoundError(f"nenhum arquivo casou com {padrao!r} em {ORIGEM}")
    return achados[0]


def abrir(padrao, modo="RGBA"):
    return Image.open(buscar(padrao)).convert(modo)


def redimensionar(img, largura_alvo):
    altura = round(img.height * largura_alvo / img.width)
    return img.resize((largura_alvo, altura), Image.LANCZOS)


def quadrado(img, lado):
    """Recorta o conteúdo visível e centraliza num quadrado (alfa preservado)."""
    caixa = img.getbbox()
    if caixa:
        img = img.crop(caixa)
    escala = min(lado / img.width, lado / img.height)
    novo = img.resize(
        (max(1, round(img.width * escala)), max(1, round(img.height * escala))),
        Image.LANCZOS,
    )
    base = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    base.paste(novo, ((lado - novo.width) // 2, (lado - novo.height) // 2), novo)
    return base


def salvar(img, nome, qualidade=88, formato="WEBP"):
    caminho = os.path.join(DESTINO, nome)
    if formato == "WEBP":
        img.save(caminho, "WEBP", quality=qualidade, method=6)
    else:
        img = img.convert("RGB")
        img.save(caminho, "JPEG", quality=qualidade, optimize=True, progressive=True)
    RELATORIO.append(
        {
            "arquivo": nome,
            "dimensoes": f"{img.width}x{img.height}",
            "kb": round(os.path.getsize(caminho) / 1024, 1),
        }
    )


def recorte_central(img, largura, altura):
    proporcao = largura / altura
    if img.width / img.height > proporcao:
        nova_largura = round(img.height * proporcao)
        x = (img.width - nova_largura) // 2
        img = img.crop((x, 0, x + nova_largura, img.height))
    else:
        nova_altura = round(img.width / proporcao)
        y = (img.height - nova_altura) // 2
        img = img.crop((0, y, img.width, y + nova_altura))
    return img.resize((largura, altura), Image.LANCZOS)


def main():
    os.makedirs(DESTINO, exist_ok=True)

    # ── Marca ────────────────────────────────────────────────────────────────
    # O header usa o lockup completo (`logo-completo`), como no mockup. Não
    # geramos um "só símbolo": o anel e o "P" de "Portal" se encostam no
    # antialias, então o recorte automático sempre trazia um pedaço da letra —
    # e com o header claro o lockup inteiro lê bem.
    logo = abrir("logoPortal.png")
    salvar(redimensionar(logo, 1400), "logo-completo.webp", 90)
    salvar(quadrado(abrir("8.jpeg"), 512), "logo-quadrado.webp", 90)

    # ── Mascote (recortes com transparência) ─────────────────────────────────
    salvar(redimensionar(abrir("Elemento capa.png"), 900), "mascote-hero.webp", 84)
    salvar(redimensionar(abrir("novidades.png"), 800), "mascote-apresentando.webp", 88)
    salvar(redimensionar(abrir("novidades2.png"), 800), "mascote-relogio.webp", 88)
    salvar(redimensionar(abrir("editais e projetos.png"), 800), "mascote-apontando.webp", 88)
    salvar(redimensionar(abrir("Pergunte pra Ifizinha.png"), 900), "mascote-chat.webp", 88)

    # ── Ícones 3D (aparecem em 64-80 px → 192 px cobre tela 2x) ──────────────
    salvar(quadrado(abrir("iconeEditais.png"), 192), "icone-editais.webp", 90)
    salvar(quadrado(abrir("icone_agenda.png"), 192), "icone-agenda.webp", 90)
    salvar(quadrado(abrir("icone_projetos.png"), 192), "icone-projetos.webp", 90)
    salvar(quadrado(abrir("icone_pessoas.png"), 192), "icone-pessoas.webp", 90)
    salvar(quadrado(abrir("icone para o bot*chatbot*"), 160), "avatar-chat.webp", 90)

    # ── Arte de 404 (texto já embutido na imagem) ────────────────────────────
    salvar(redimensionar(abrir("4.jpeg"), 1000), "arte-404.webp", 88)

    # ── Poses com fundo sólido: só onde o fundo da seção casa ────────────────
    salvar(redimensionar(abrir("1.jpeg"), 800), "pose-apontando-logo.webp", 86)  # #F7F7F7
    salvar(redimensionar(abrir("2.jpeg"), 800), "pose-de-costas.webp", 86)  # #FDFDFD
    salvar(redimensionar(abrir("3.jpeg"), 800), "pose-neutra.webp", 86)  # #E6E4E9
    salvar(redimensionar(abrir("editais em destaque.jpeg"), 800), "pose-editais.webp", 86)  # #FEFEFE
    salvar(redimensionar(abrir("projetos e destaque.jpeg"), 800), "pose-projetos.webp", 86)  # #F7F7F7
    salvar(redimensionar(abrir("prox eventos e prazos.jpeg"), 800), "pose-prazos.webp", 86)  # #F7F7F7

    # ── Cenas do campus (faixas de fundo) ────────────────────────────────────
    salvar(redimensionar(abrir("5.jpeg", "RGB"), 1600), "banner-campus-1.webp", 82)
    salvar(redimensionar(abrir("6.jpeg", "RGB"), 1600), "banner-campus-2.webp", 82)
    salvar(redimensionar(abrir("7.jpeg", "RGB"), 1600), "banner-campus-3.webp", 82)

    # ── Imagem de compartilhamento (WhatsApp/redes) ──────────────────────────
    salvar(recorte_central(abrir("7.jpeg", "RGB"), 1200, 630), "og-portal.jpg", 82, "JPEG")

    print(f"{'arquivo':<28}{'dimensoes':<14}{'KB':>8}")
    for item in RELATORIO:
        print(f"{item['arquivo']:<28}{item['dimensoes']:<14}{item['kb']:>8}")
    total = sum(item["kb"] for item in RELATORIO)
    print(f"{'TOTAL':<28}{'':<14}{total:>8.1f}")

    with open(os.path.join(DESTINO, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(RELATORIO, fh, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
