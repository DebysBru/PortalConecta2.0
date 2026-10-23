/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite validar um build isolado sem sobrescrever o servidor local em uso.
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
    // A importação do SUAP manda a captura inteira como argumento de Server
    // Action, e o padrão do Next é **1 MB** — uma captura sem filtro de campus
    // passa disso com folga. Sem isto o usuário recebia um 500 com digest em vez
    // de uma explicação (foi o caso do digest 1301235869, em 06/10/2026).
    //
    // Escala dos limites: nginx do portal aceita 25 MB, o Next passa a aceitar
    // 16 MB e a nossa própria checagem barra em 12 MB
    // (LIMITE_CAPTURA_BYTES, em src/lib/suap-import.ts). O limite do framework
    // fica ACIMA do nosso de propósito: assim quem responde com mensagem clara é
    // o nosso código, e não um erro de infraestrutura.
    serverActions: { bodySizeLimit: '16mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
      ],
    },
  ],
};

module.exports = nextConfig;
