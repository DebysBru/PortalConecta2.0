import type { MetadataRoute } from 'next';

/**
 * robots.txt (gerado pelo Next em `/robots.txt`).
 *
 * Antes disso o endereço respondia **404** em produção (aparecia no log do
 * nginx), e sem `Sitemap:` o Google não descobria as páginas sozinho.
 *
 * O que fica de fora: áreas autenticadas (`/admin`, `/professor`, `/meus-dados`,
 * `/minha-area`), a API e os arquivos enviados (`/files/` são PDFs e imagens de
 * posts — conteúdo para humano, não para índice de busca).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/professor', '/meus-dados', '/minha-area', '/api/', '/files/'],
      },
    ],
    sitemap: 'https://portal.ifcoding.com.br/sitemap.xml',
    host: 'https://portal.ifcoding.com.br',
  };
}
