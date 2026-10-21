import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Mesmo alias do tsconfig.json ("@/*" -> "./src/*")
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    // Fuso do Brasil fixado nos testes: o portal exibe datas no fuso de Brasília
    // e a lógica de semestre usa o mês brasileiro (src/lib/datas.ts). Sem isto, o
    // resultado dependeria do fuso da máquina de quem roda os testes — foi
    // exatamente o que causou o bug do prazo aparecer um dia antes em produção
    // (a VPS roda em America/Chicago).
    env: { TZ: 'America/Sao_Paulo' },
  },
});
