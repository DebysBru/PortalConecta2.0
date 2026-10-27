# Graphify no Portal Conecta

Graphify 0.9.94 está instalado em um ambiente Python isolado do projeto.
A skill do Codex fica em `.agents/skills/graphify/`; o guia de navegação fica em `AGENTS.md`.

## Reinstalar em outro checkout (PowerShell, Python 3.10+)

```powershell
python -m venv .graphify-venv
.\.graphify-venv\Scripts\python.exe -m pip install "graphifyy[sql]==0.9.94"
```

Os arquivos da skill já acompanham o projeto. Não é necessário instalar globalmente,
alterar o PATH, configurar chaves de API ou modificar dependências npm.

## Criar ou atualizar o mapa

Execute na raiz do projeto:

```powershell
.\tools\graphify.ps1 extract . --code-only --no-cluster --max-workers 2
```

Esse comando usa parsing local do código, sem extração semântica por LLM.
O grafo fica em `graphify-out/graph.json`. O modo inicial não cria comunidades
nem relatório visual. `.graphifyignore` exclui dependências, uploads, artefatos
e configurações locais. O ambiente Python e os grafos são ignorados pelo Git.

## Consultar

```powershell
.\tools\graphify.ps1 query "auth" --budget 1200
.\tools\graphify.ps1 explain "nomeDoSimbolo"
.\tools\graphify.ps1 path "simboloA" "simboloB"
```

Use nomes de símbolos ou termos presentes no código: a consulta local não é um
chat semântico. Valide os resultados no código; relações dinâmicas e convenções
do Next.js podem não estar representadas. Regenere após alterações relevantes.

No Codex, invoque `$graphify`. As instruções específicas do projeto em `AGENTS.md`
adaptam os exemplos Bash da skill para o PowerShell e o ambiente local.

Fonte: https://github.com/Graphify-Labs/graphify (pacote PyPI `graphifyy`).
