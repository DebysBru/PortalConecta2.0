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

## Logs e diagnóstico de erros (produção)

Em caso de erro do sistema, **o primeiro lugar a analisar é o journal do serviço na VPS** (`198.44.123.154`). O portal não grava arquivo `.log` próprio: o Next.js escreve em stdout/stderr e o systemd guarda no journal (`SyslogIdentifier=portal-conecta`).

```bash
journalctl -u portal-conecta -n 200 --no-pager
journalctl -u portal-conecta --since "2026-10-26 15:00" --no-pager | grep -i -E "error|erro|falha"
```

- **Formato:** o código usa `createLogger('modulo')` (`src/lib/logger.ts`), que emite uma linha JSON por evento (`timestamp`, `level`, `modulo`, `mensagem`). Filtre por módulo com `grep '"modulo":"nome"'`.
- **Fuso:** o servidor está em `America/Chicago` (CDT, UTC-5). Some 2 horas para obter o horário de Brasília.
- **Retenção curta:** não existe `/var/log/journal`, então o journal é volátil, tem limite de tamanho e hoje alcança só cerca de 1 a 2 dias (o registro mais antigo do serviço era de 26/10/2026 15:18 em 27/10). Consulte logo depois de a falha acontecer.
- **Lacuna conhecida (27/10/2026):** as Server Actions de admin/professor/RAG capturam a exceção e devolvem só uma mensagem amigável; o erro real quase nunca chega ao journal. Falha na extração de PDF de edital (limite de IA, resposta truncada) também não é registrada. A tabela `AuditLog` só recebe registros das ações do estudante (inscrições e pedido de dados).
- **Ruído esperado:** `Failed to find Server Action "..."` logo após um deploy significa aba aberta de antes da publicação; é só recarregar a página.

Outras fontes, nesta ordem, conforme o sintoma:

| Sintoma | Onde olhar |
|---|---|
| Deploy falhou ou rollback automático | Artefato `deploy-vps-<run_id>` (`deploy-vps.log`) na execução do workflow "Deploy na VPS" e `bash /var/www/portal-conecta/deploy/deploy-vps.sh estado` |
| Site fora do ar, 502/504 | `/var/log/nginx/portal.ifcoding.com.br.error.log` e `/var/log/nginx/error.log`, depois `systemctl status portal-conecta --no-pager` |
| Quantas vezes a IA foi chamada | Tabela `rate_limit_hits` (chave `ai:<escopo>:<hash>`; `criado_em` está no fuso do servidor) |
| Importação do SUAP | Tabela `SyncLog` |
| Ações do estudante em inscrições | Tabela `AuditLog` |
