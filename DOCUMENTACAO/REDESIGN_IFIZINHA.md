# Redesign visual com a IFizinha — avaliação e plano

**Pedido (06/10/2026):** reformular o visual do site aproveitando a mascote, usando
o mockup apresentado (`Portal Conecta_ IFPR Ivaiporã.png`) como referência, e
dizer onde cada imagem entra.

**Ponto de retorno:** o estado atual está salvo em três lugares — ver
"Backup" no fim deste documento.

---

## 1. Inventário dos assets (`C:\Users\Ronan\Downloads\IFIZINHA`)

22 arquivos, **14,7 MB no total**. A coluna "fundo" foi medida pixel a pixel:

| Arquivo | Dimensões | Fundo | O que é / pose | Uso sugerido |
|---|---|---|---|---|
| `Elemento capa.png` | 1086x1448 | **transparente** | IFizinha de meio corpo com tablet na mão | **Hero** (elemento de capa, dá para sobrepor em qualquer fundo) |
| `5.jpeg` | 1600x685 | cena (campus) | IFizinha com tablet no portão do campus, fundo desfocado | Hero alternativo / banner de topo de seção |
| `6.jpeg` | 1600x685 | cena (campus) | IFizinha de corpo inteiro no portão | Banner largo (faixas de CTA, topo de página interna) |
| `7.jpeg` | 1600x840 | cena (campus) | IFizinha apontando para si mesma, portão à direita | Faixa "Pergunte pra IFizinha"/institucional |
| `1.jpeg` | 1066x1600 | cinza `#F7F7F7` | Corpo inteiro apontando para o logo na camiseta | Seção institucional (sobre o projeto) |
| `2.jpeg` | 1122x1402 | branco `#FDFDFD` | De costas, apontando para o logo nas costas da camiseta | Marca/redes sociais, imagem de compartilhamento |
| `3.jpeg` | 1024x1536 | cinza `#E6E4E9` | De frente, braços ao lado do corpo | Alternativa neutra (hero/seção "sobre") |
| `4.jpeg` | 1254x1254 | branco `#FDFDFD` | **Arte de 404** com o texto "Página não encontrada!" já embutido | Página `not-found` (404) |
| `8.jpeg` | 469x469 | branco `#FEFEFE` | Logo quadrado "Portal Conecta" | Avatar/OG, redes, atalhos |
| `logoPortal.png` | 2172x724 | **transparente** | Logo horizontal (símbolo + "Portal Conecta" + assinatura) | **Header**, rodapé, materiais |
| `editais e projetos.png` | 1122x1402 | **transparente** | Corpo inteiro apontando (para a direita) | Seção de editais/projetos |
| `editais em destaque.jpeg` | 1254x1254 | branco `#FEFEFE` | Com prancheta na mão + joinha | Seção "Editais em destaque" |
| `projetos e destaque.jpeg` | 1254x1254 | cinza `#F7F7F7` | Apresentando com as duas mãos abertas | Seção de projetos |
| `prox eventos e prazos.jpeg` | 1086x1448 | cinza `#F7F7F7` | **Apontando para o relógio de pulso** | Seção "Não deixa passar" (agenda/prazos) |
| `novidades.png` | 1122x1402 | **transparente** | Apresentando com as duas mãos abertas | Seção de novidades/projetos |
| `novidades2.png` | 1086x1448 | **transparente** | Variante da anterior | Alternativa |
| `Pergunte pra Ifizinha.png` | 1448x1086 | **transparente** | Deitada de bruços, mãos no queixo, olhando para a câmera | **Bloco "Pergunte pra IFizinha"** (chat) |
| `iconeEditais.png` | 1254x1254 | **transparente** | Ícone 3D: documento azul + capelo | Card "Editais e Bolsas" |
| `icone_agenda.png` | 1254x1254 | **transparente** | Ícone 3D: calendário | Card "Datas importantes" |
| `icone_projetos.png` | 1254x1254 | **transparente** | Ícone 3D: projeto/pasta | Card "Projetos" |
| `icone_pessoas.png` | 1254x1254 | **transparente** | Ícone 3D: pessoas | Card "Vida no Campus" |
| `icone para o botão do chatbot.jpeg` | 1254x1254 | cor própria (ciano claro) | Ícone do botão do chat | **Botão flutuante** do chat (recortar em círculo) |

**Conclusão prática do inventário:** os **`.png` são recortes com fundo transparente**
(prontos para sobrepor em qualquer fundo) e os **`.jpeg` têm fundo sólido**
(`#F7F7F7`, `#FDFDFD`, `#FEFEFE` ou cena). Isso define onde cada um pode entrar
sem retrabalho — e é a única "regra dura" deste plano:

- fundo transparente → qualquer fundo;
- `#FDFDFD`/`#FEFEFE` → fundo branco (some);
- `#F7F7F7` → fundo `gray-50`/`#F7F7F7` (some) ou recorte manual;
- cena (5/6/7) → faixa com imagem de fundo, não recorte.

---

## 2. Mapa de colocação, seção por seção

Comparando o mockup com o que existe hoje (`src/app/page.tsx`,
`HeroIFizinha.tsx`, `ProjetosGrid.tsx`, `Header.tsx`, `Footer.tsx`,
`ChatWidget.tsx`):

| # | Seção (mockup) | Hoje | Asset | Como entra |
|---|---|---|---|---|
| 1 | Header com logo + botão "Pergunte à IFizinha" | Logo feito com ícone `Sparkles` + texto; sem CTA | `logoPortal.png` | `<Image>` com `priority`, altura 40-48 px; botão rosa novo ao lado do "Ver Editais" |
| 2 | Hero claro com mascote à direita | Hero `bg-hero-gradient` escuro, ocupa `min-h-screen`, card de chat à direita | `Elemento capa.png` (ou `5.jpeg` como fundo) | Trocar o card de chat pela mascote recortada; fundo claro + colagem do campus (5/6/7) |
| 3 | "O que você procura?" — 4 cards de navegação | 4 cards de **estatística** (números) | `iconeEditais`, `icone_agenda`, `icone_projetos`, `icone_pessoas` | Mesma grade (4 colunas), cada card vira link com o ícone 3D no lugar do ícone Lucide |
| 4 | "Traduzindo o burocrátês" (editais) | "Editais em Destaque" (3 cards, ícones Lucide) | `editais em destaque.jpeg` **e/ou** `editais e projetos.png` | Mascote ao lado do título (só em `lg:`), card com badge "Aberto/Em breve" |
| 5 | "Tem muita coisa acontecendo" (projetos) | `<ProjetosGrid />` | `novidades.png` ou `projetos e destaque.jpeg` | Mascote à direita do bloco de cards |
| 6 | "Não deixa passar" (agenda + filtros) | "Próximos Eventos & Prazos" (lista) | `prox eventos e prazos.jpeg` | Mascote apontando para o relógio ao lado dos filtros |
| 7 | "Pergunte pra IFizinha" (chat embutido na página) | Só o chat flutuante (`ChatWidget`) + CTA final em gradiente | `Pergunte pra Ifizinha.png` | **Novo bloco** com a mascote deitada + input + chips de perguntas sugeridas |
| 8 | Rodapé azul-marinho com mascote acenando | Rodapé `gray-950` com mapa, endereço e canais (feito em 06/10) | mascote (7/1) + `logoPortal.png` | Trocar o fundo para o azul da marca e pôr a mascote à direita; **manter o mapa** |
| 9 | Botão flutuante do chat com a cara dela | Círculo com ícone `MessageCircle` | `icone para o botão do chatbot.jpeg` | Avatar redondo (`rounded-full`, 56 px) |
| 10 | (nova) Página 404 | 404 padrão do Next | `4.jpeg` | `src/app/not-found.tsx` com a arte (texto já embutido) |

Sugestão de destino dos arquivos no repositório (nomes em português, sem espaços):

```
public/ifizinha/
  hero-tablet.png            (Elemento capa)
  hero-campus-1.jpg          (5.jpeg)   hero-campus-2.jpg (6)
  apontando.jpg              (1)   marca-costas.jpg (2)   neutra.jpg (3)
  editais.jpg                (editais em destaque)
  projetos.jpg               (projetos e destaque / novidades)
  agenda-relogio.jpg         (prox eventos e prazos)
  chat-deitada.png           (Pergunte pra Ifizinha)
  icone-editais.png  icone-agenda.png  icone-projetos.png  icone-pessoas.png
  avatar-chat.jpg
  logo-portal.png            (logoPortal)
  arte-404.jpg               (4.jpeg)
```

---

## 3. O que muda de verdade (estrutura e tema)

1. **Hero deixa de ser escuro.** Hoje é um gradiente de tela cheia; no mockup é
   claro, com a mascote e o campus. Isso puxa ajustes no Header (que hoje muda
   de cor conforme o scroll) e no contraste dos textos.
2. **Bloco de estatísticas vira navegação.** Os 4 números (editais, projetos,
   usuários, eventos) viram 4 cards com ícone 3D. Decisão a tomar: manter os
   números dentro dos cards (bom para credibilidade) ou tirá-los.
3. **Dois blocos novos na home:** "O que você procura?" (se for separado da
   estatística) e "Pergunte pra IFizinha" (chat embutido, reaproveitando o
   endpoint `/api/chat` que o `ChatWidget` já usa hoje).
4. **Filtros na agenda** (Todos/Alunos/Professores/Eventos/Editais) — o mockup
   mostra; hoje a home lista os próximos eventos sem filtro.
5. **Rodapé** passa de `gray-950` para o azul-marinho da marca e ganha a
   mascote. O mapa que entrou hoje pode continuar (é útil e o mockup não
   contradiz) — só reorganiza.
6. **Paleta não muda**: `azul #2F52D3`, `roxo #7B24C7`, `rosa #E83D89`,
   `ciano #17A2B8`, `dourado #FFD700` já estão no `tailwind.config.ts`, com
   gradientes, glows e animações (`float`, `sparkle`). O que muda é a
   **proporção**: muito mais branco/cinza-claro, gradiente só em botões,
   badges e detalhes.

---

## 4. Requisitos técnicos (não é opcional)

### 4.1 Otimização das imagens — hoje são 14,7 MB

Nenhum arquivo pode ir para produção como está. Alvo por peça (WebP; AVIF onde
compensar), já pensando em telas 2x:

| Peça | Exibição | Exportar | Peso alvo |
|---|---|---|---|
| Hero (mascote) | até ~448 px de largura | 900x1200 WebP | ≤ 150 KB |
| Banner de campus (5/6/7) | largura total | 1920x820 WebP | ≤ 200 KB |
| Mascotes de seção | ~380 px | 800x1000 WebP | ≤ 120 KB cada |
| Ícones 3D | 64-80 px | 192x192 WebP c/ alfa | ≤ 20 KB cada |
| Arte 404 | ~500 px | 1000x1000 WebP | ≤ 130 KB |
| Avatar do chat | 56 px | 160x160 WebP | ≤ 12 KB |
| OG (compartilhamento) | 1200x630 | 1200x630 JPEG | ≤ 150 KB |

Orçamento da home: **~500-600 KB de imagem** no total. Hoje, só o
`Pergunte pra Ifizinha.png` pesa 2 MB.

Ferramentas: `next/image` (com `sizes` correto e `priority` **só** no hero),
`loading="lazy"` no resto. A conversão dá para fazer aqui mesmo com Pillow
(Python já disponível na máquina) — inclusive o recorte circular do avatar.

### 4.2 Fundos: o que pode e o que não pode

- JPEG `#F7F7F7` sobre fundo branco = retângulo cinza visível. Ou a seção usa
  `bg-[#F7F7F7]`/`gray-50`, ou o arquivo precisa de recorte.
- Recorte automático **não** funciona bem aqui: a camiseta e o tênis são
  brancos, então remover "tudo que é claro" abriria buracos na roupa. Se a
  intenção é usar um JPEG sobre gradiente, o certo é pedir o PNG transparente
  (ou fazer a máscara à mão).
- Enquanto isso, os `.png` transparentes cobrem todas as posições "sobre
  gradiente" (hero, chat, ícones, logo) — dá para começar o redesign sem
  depender de recorte nenhum.

### 4.3 Acessibilidade e detalhes

- `alt` descritivo nas imagens de conteúdo e `alt=""`/`aria-hidden` nas
  decorativas (as poses da mascote são decorativas na maior parte das seções).
- Contraste: texto sobre a colagem do campus precisa de véu/overlay.
- Respeitar `prefers-reduced-motion` nas animações `float`/`sparkle` (hoje elas
  rodam sempre).
- No mobile, esconder 2 de cada 3 mascotes (senão a página vira álbum) — a
  regra do mockup de "uma mascote por seção" funciona bem em `lg:`, mas em
  telas pequenas o conteúdo precisa vir primeiro.
- `openGraph.images` no `layout.tsx` (hoje não existe): usar 5/6/7 recortado em
  1200x630 — é o que aparece quando o link é compartilhado no WhatsApp.
- Favicon/ícones do PWA: hoje são da marca antiga; gerar de novo a partir do
  `logoPortal.png` (o `public/icons/*` foi versionado hoje, então atualizar é
  simples).

---

## 5. Ordem de execução sugerida

| Fase | Conteúdo | Depende de | Situação |
|---|---|---|---|
| **0** | Backup + assets otimizados em `public/ifizinha/` + componente `<MascoteIFizinha>` | nada | ✅ **feito (06/10)** |
| **1** | Header (logo real + botão "Pergunte à IFizinha") e rodapé azul-marinho com a mascote | fase 0 | ✅ **feito (06/10)** |
| **2** | Home: hero claro, 4 cards com ícones 3D, mascotes nas seções de editais/projetos/agenda, bloco "Pergunte pra IFizinha" | fases 0-1 | pendente |
| **3** | Páginas internas (editais, projetos, agenda, login/cadastro) + 404 com a arte + avatar do botão do chat | fase 2 | pendente |
| **4** | Metadados: OG image, ícones do PWA, revisão de contraste | fase 3 | pendente (o `og-portal.jpg` já está gerado) |

### O que a Fase 0 e a Fase 1 entregaram

**Fase 0 — assets** (`tools/otimizar-assets-ifizinha.py`, idempotente):

- 22 arquivos originais (14,7 MB) → **25 arquivos em `public/ifizinha/` (1,9 MB no
  total, e cada página carrega só o que usa)**. Ícone 3D: 837 KB → 8 KB.
- `manifest.json` com dimensões e peso de cada arquivo gerado.
- `MascoteIFizinha` (`src/components/ifizinha/MascoteIFizinha.tsx`) centraliza o
  uso: nome do asset, `alt` (vazio = decorativa), `prioridade` (só o hero),
  `somenteDesktop`, e marca em cada asset se o fundo é `transparente`,
  `branco` ou `cinza` — a regra de encaixe da §4.2 vira dado, não folclore.
- Decisão de servir **direto** (`unoptimized`): os arquivos já saem no tamanho
  de exibição e o servidor não tem `sharp`, então o `/_next/image` cairia no
  fallback do Next gastando CPU da VPS a cada requisição.

**Fase 1 — header e rodapé:**

- Header **sempre claro** (antes era transparente sobre o hero escuro) com o
  logo oficial (`logo-completo.webp`), mantendo **todos** os links e estados:
  navegação, "Ver Editais", notificações, Minha área, Meus Dados, painel do
  Admin/Professor, Sair/Entrar e o menu mobile.
- Botão **"Pergunte à IFizinha"**: no desktop (ícone a partir de `md`, com
  rótulo a partir de `lg` para não apertar o header) e no menu mobile. Ele abre
  o `ChatWidget` por evento (`src/lib/ifizinha-chat.ts`) — sem contexto novo no
  layout, sem estado duplicado.
- Rodapé azul-marinho (`azul-950`) com a mascote decorativa em `xl`, o logo
  oficial numa placa clara (o nome do logo é azul-marinho e sumiria no fundo) e
  **tudo que já existia preservado**: mapa, endereço, canais, navegação, barra
  final — inclusive os testes de `tests/rodape-institucional.test.ts`.
- Avatar do botão do chat agora é a cara da IFizinha (`avatar-chat.webp`).

**Verificação da Fase 0/1:** 475 testes em 30 arquivos; `tsc --noEmit` limpo;
`next build` ok; conferência com Chrome headless (CDP) em desktop (1440) e
mobile (390): logo e mascote carregam (`naturalWidth` > 0), o clique no botão
do header **abre o chat**, o menu mobile mostra os dois botões e **nenhum erro
ou aviso no console**.

### O que ficou de fora (de propósito)

- O hero da home continua escuro: ele é o coração da Fase 2, e mexer nele agora
  significaria refazer duas vezes.
- O `logo-simbolo` (só o anel) não foi gerado: o anel e o "P" de "Portal" se
  encostam no antialias, então o recorte automático sempre trazia um pedaço da
  letra. Com o header claro, o lockup completo resolve.

---

## 6. Riscos

1. **Peso da página** — o maior risco. Sem otimizar, a home sai de ~100 KB de
   HTML para 3-4 MB de imagem.
2. **Recorte dos JPEG** — se o plano depender de recortar os JPEG, entra
   trabalho manual/design; o plano acima evita isso.
3. **Excesso de mascote** — 8 poses na mesma página cansa; o mockup usa uma por
   seção, com propósito.
4. **Texto embutido em imagem** (arte de 404) — não pode ser reaproveitada em
   outro lugar nem traduzida.
5. **Regressão funcional** — o redesign mexe em componentes que hoje carregam
   dados reais (editais, eventos, config do admin). Toda seção nova precisa
   continuar vindo do banco, não virar texto fixo.

---

## 7. Backup — como voltar para a versão de hoje

Três camadas independentes:

| Camada | O que é | Como restaurar |
|---|---|---|
| Git | commit `0125b6a` + tag `pre-redesign-2026-10-06` | `git checkout pre-redesign-2026-10-06` (ou `git reset --hard 0125b6a` para voltar `main`) |
| Arquivo | `C:\Users\Ronan\Documents\GitHub\portal-conecta-snapshot-2026-10-06.tgz` (384 arquivos, 839 KB, só código) | `tar xzf ... -C <destino>` |
| Produção | build `CaA2WYgwrI0QuGuwzy73p` no ar + `/var/www/portal-conecta-old` na VPS + tarballs em `/root` | `bash /root/troca-portal.sh` / `bash /root/rollback-portal.sh` |

Depois do redesign, o mesmo esquema vale: cada fase entra com commit próprio,
então dá para voltar fase por fase.
