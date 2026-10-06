/**
 * Limites de tamanho da captura do SUAP.
 *
 * Este módulo existe separado (e **sem nenhum import**) porque o valor é usado
 * dos dois lados: no servidor, validando a Server Action; e no navegador, avisando
 * antes de enviar o arquivo. Importar essa constante de `@/lib/suap-import`
 * arrastaria o cliente da API do SUAP para o bundle do navegador — e ele usa
 * `fs/promises`, o que quebra o build com "Module not found: Can't resolve
 * 'fs/promises'" (aconteceu em 06/10/2026, no commit do limite de 12 MB).
 *
 * Escala dos limites, para não repetir o problema que originou tudo isso:
 *
 * - nginx do portal: 25 MB;
 * - Server Actions do Next (`next.config.js`): 16 MB;
 * - **este valor: 12 MB** — fica abaixo do framework de propósito, para que quem
 *   responde com mensagem clara seja o portal, e não um 413 do Next.
 */
export const LIMITE_CAPTURA_BYTES = 12 * 1024 * 1024;
