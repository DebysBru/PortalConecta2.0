import type { MetadataRoute } from 'next';
import { db } from '@/lib/prisma';

/**
 * sitemap.xml (gerado pelo Next em `/sitemap.xml`).
 *
 * Lista as páginas públicas fixas e, do banco, os editais e projetos que estão
 * publicados — a **mesma régua de visibilidade** das próprias páginas
 * (`review_status: 'PUBLICADO'` e sem soft delete), senão o sitemap anunciaria
 * link que responde 404.
 *
 * `revalidate` de 1 hora: o sitemap é consultado por robô, não por gente, e não
 * vale uma ida ao banco a cada requisição.
 */
export const revalidate = 3600;

const BASE = 'https://portal.ifcoding.com.br';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixas: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/editais`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/projetos`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/agenda`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/busca`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/cadastro`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const [editais, projetos] = await Promise.all([
      db.edital.findMany({
        where: { review_status: 'PUBLICADO', deleted_at: null },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 500,
      }),
      db.projeto.findMany({
        where: { review_status: 'PUBLICADO', deleted_at: null },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 500,
      }),
    ]);

    return [
      ...fixas,
      ...editais.map((e) => ({
        url: `${BASE}/editais/${e.slug}`,
        lastModified: e.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...projetos.map((p) => ({
        url: `${BASE}/projetos/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ];
  } catch {
    // Banco fora do ar não pode derrubar o sitemap: as páginas fixas continuam.
    return fixas;
  }
}
