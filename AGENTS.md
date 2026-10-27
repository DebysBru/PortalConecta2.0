# Portal Conecta — orientação para agentes

## Graphify

- Skill local: `.agents/skills/graphify/SKILL.md`. Leia quando o usuário invocar `$graphify`.
- No PowerShell, execute `./tools/graphify.ps1 <comando>`; o Python está isolado em `.graphify-venv/`.
- Para perguntas sobre arquitetura, dependências ou impacto de alterações, consulte primeiro o grafo existente: `./tools/graphify.ps1 query "<termos do código>" --budget 1200`.
- Use `path` e `explain` para relações específicas. Se a consulta não localizar o que precisa ou o grafo estiver desatualizado, use `rg` e leia os arquivos relevantes.
- Confirme o código antes de editar; o grafo é um índice auxiliar.
- Após mudanças relevantes no código, regenere: `./tools/graphify.ps1 extract . --code-only --no-cluster --max-workers 2`.
- Mantenha o uso padrão local e sem LLM (`--code-only`). Não leia o JSON completo para responder perguntas pontuais.
- Instalação e comandos: `DOCUMENTACAO/GRAPHIFY.md`.
