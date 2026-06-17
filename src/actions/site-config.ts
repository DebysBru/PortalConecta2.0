'use server';

import { db } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/**
 * Configuração padrão do site
 */
const DEFAULT_SITE_CONFIG = {
  hero_titulo: 'Tudo do IFPR traduzido pra você',
  hero_subtitulo: 'Editais, projetos, agenda acadêmica — linguagem simples, informação completa',
  hero_cta_editais: 'Ver Editais Abertos',
  hero_cta_projetos: 'Explorar Projetos',
  hero_cta_chat: 'Falar com a IFizinha',
  numero_editais_destaque: 3,
  numero_projetos_destaque: 3,
  rodape_texto: '© 2026 IFPR Campus Ivaiporã — Portal Conecta',
  rodape_contato: 'contato@ifpr.edu.br',
  rodape_telefone: '(43) 3422-2222',
};

/**
 * Obtém uma configuração específica do site
 */
export async function getSiteConfigAction(chave: string): Promise<any> {
  try {
    const config = await db.siteConfig.findUnique({
      where: { chave },
    });

    if (!config) {
      return DEFAULT_SITE_CONFIG[chave as keyof typeof DEFAULT_SITE_CONFIG];
    }

    return config.valor;
  } catch (error) {
    console.error(`Erro ao buscar config ${chave}:`, error);
    return DEFAULT_SITE_CONFIG[chave as keyof typeof DEFAULT_SITE_CONFIG];
  }
}

/**
 * Obtém todas as configurações do site (merge com defaults)
 */
export async function getAllSiteConfigAction(): Promise<Record<string, any>> {
  try {
    const configs = await db.siteConfig.findMany();
    const result: Record<string, any> = { ...DEFAULT_SITE_CONFIG };

    configs.forEach((config) => {
      result[config.chave] = config.valor;
    });

    return result;
  } catch (error) {
    console.error('Erro ao buscar todas as configs:', error);
    return DEFAULT_SITE_CONFIG;
  }
}

/**
 * Atualiza uma configuração do site (apenas admin)
 */
export async function updateSiteConfigAction(chave: string, valor: any, userId: string) {
  try {
    // Verificar se é admin
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (user?.role !== 'ADMIN') {
      throw new Error('Acesso negado: apenas admin pode alterar configurações');
    }

    const config = await db.siteConfig.upsert({
      where: { chave },
      update: {
        valor,
        updated_by: userId,
        updated_at: new Date(),
      },
      create: {
        chave,
        valor,
        updated_by: userId,
      },
    });

    return config;
  } catch (error) {
    console.error(`Erro ao atualizar config ${chave}:`, error);
    throw error;
  }
}
