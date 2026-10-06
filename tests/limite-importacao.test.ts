import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIMITE_CAPTURA_BYTES, tamanhoEmBytes } from '@/lib/suap-import';

const require = createRequire(import.meta.url);
const nextConfig = require('../next.config.js');

/**
 * Coerência dos limites de tamanho na importação do SUAP.
 *
 * Contexto (06/10/2026): o admin tentou importar uma captura grande e recebeu
 * **500 com digest** em vez de uma explicação. Motivo: o limite de corpo das
 * Server Actions do Next é **1 MB** por padrão, e a nossa checagem no código
 * estava em 8 MB — ou seja, o framework recusava a requisição (statusCode 413,
 * "Body exceeded 1 MB limit") antes de o nosso código rodar.
 *
 * A regra que este teste protege: o limite do framework tem de ser **maior** que
 * o nosso, para que quem responda com mensagem clara seja o portal.
 */
describe('limites da importação do SUAP', () => {
  const configurado = nextConfig.experimental?.serverActions?.bodySizeLimit;

  it('o Next está configurado para aceitar mais que o padrão de 1 MB', () => {
    expect(configurado, 'bodySizeLimit ausente em next.config.js').toBeDefined();
    const mb = String(configurado).toLowerCase().endsWith('mb')
      ? Number.parseFloat(String(configurado)) * 1024 * 1024
      : Number(configurado);
    expect(mb, 'bodySizeLimit ainda no padrão de 1 MB').toBeGreaterThan(1024 * 1024);
  });

  it('o limite do framework é maior que o nosso (senão o 500 volta)', () => {
    const mb = String(configurado).toLowerCase().endsWith('mb')
      ? Number.parseFloat(String(configurado)) * 1024 * 1024
      : Number(configurado);
    expect(mb).toBeGreaterThan(LIMITE_CAPTURA_BYTES);
  });

  it('o nosso limite é razoável (entre 2 MB e 32 MB)', () => {
    expect(LIMITE_CAPTURA_BYTES).toBeGreaterThanOrEqual(2 * 1024 * 1024);
    expect(LIMITE_CAPTURA_BYTES).toBeLessThanOrEqual(32 * 1024 * 1024);
  });

  it('conta bytes de verdade, e não caracteres (acento ocupa mais de um byte)', () => {
    // "ção" tem 3 caracteres e 5 bytes em UTF-8
    expect(tamanhoEmBytes('ção')).toBe(5);
    expect(tamanhoEmBytes('Ivaiporã')).toBeGreaterThan('Ivaiporã'.length);
    // e um conteúdo grande é medido acima do limite corretamente
    expect(tamanhoEmBytes('a'.repeat(LIMITE_CAPTURA_BYTES + 1))).toBeGreaterThan(LIMITE_CAPTURA_BYTES);
  });

  it('o componente de cliente importa a constante do módulo neutro, não do cliente do SUAP', () => {
    // Regressão de 06/10/2026: o cliente importava de `@/lib/suap-import`, que
    // puxa `@/lib/suap-api` (usa `fs/promises`) para o bundle do navegador — o
    // build falhava com "Module not found: Can't resolve 'fs/promises'".
    const cliente = readFileSync(
      join(process.cwd(), 'src', 'app', 'admin', '(protected)', 'suap', 'importar', 'ImportarSuapClient.tsx'),
      'utf8',
    );
    expect(cliente).toContain("from '@/lib/suap-limites'");
    expect(cliente).not.toMatch(/from '@\/lib\/suap-import'/);

    // e o módulo neutro não pode ganhar imports (é o que o mantém seguro nos dois lados)
    const limites = readFileSync(join(process.cwd(), 'src', 'lib', 'suap-limites.ts'), 'utf8');
    expect(limites).not.toMatch(/^\s*import\s/m);
  });
});
