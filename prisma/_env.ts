/**
 * Carrega `.env.local` / `.env` em `process.env` para os scripts de linha de
 * comando deste projeto.
 *
 * Por que existe: os scripts rodam com `ts-node`, e nem o `ts-node` nem o
 * Prisma Client leem `.env` automaticamente (só o CLI do Prisma lê — e é por
 * isso que `npx prisma db push` funciona e um `new PrismaClient()` cru explode
 * com "Environment variable not found: DATABASE_URL"). Sem isto, todo script
 * teria que ser chamado como `DATABASE_URL=... npm run ...`.
 *
 * O carregamento acontece JÁ NA IMPORTAÇÃO do módulo, de propósito: em
 * CommonJS os `import` viram `require` na ordem em que aparecem, então basta
 * importar este arquivo primeiro para que os módulos seguintes (que leem
 * `process.env.GEMINI_API_KEY` no topo, como `src/lib/embeddings.ts`) já
 * enxerguem os valores.
 *
 * Variáveis já definidas no ambiente vencem — é o que permite sobrescrever
 * `DATABASE_URL` no deploy sem editar arquivo.
 */

import fs from 'node:fs';
import path from 'node:path';

const ARQUIVOS = ['.env.local', '.env'];

export function carregarEnv(): void {
  for (const arquivo of ARQUIVOS) {
    const caminho = path.join(process.cwd(), arquivo);
    if (!fs.existsSync(caminho)) continue;

    for (const linha of fs.readFileSync(caminho, 'utf8').split(/\r?\n/)) {
      const achado = linha.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (!achado) continue;

      let valor = achado[2].trim();
      if (
        (valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))
      ) {
        valor = valor.slice(1, -1);
      }

      if (!process.env[achado[1]]) process.env[achado[1]] = valor;
    }
  }
}

carregarEnv();
