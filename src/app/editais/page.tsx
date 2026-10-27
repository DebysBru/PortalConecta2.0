import React from 'react';
import { BookOpen, AlertCircle, Sparkles } from 'lucide-react';
import { getDaysUntil } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { EDITAL_PUBLICO_WHERE } from '@/lib/editais-publicos';
import { withCache } from '@/lib/cache';
import { garantirStatusEditaisAtualizado } from '@/lib/editais-status';
import { PageHero } from '@/components/layout/PageHero';
import { EditaisExplorer, type EditalListado } from '@/components/editais/EditaisExplorer';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Revalidar a cada 5 minutos

export const metadata: Metadata = {
  title: 'Editais',
  description: 'Todos os editais do IFPR Campus Ivaiporã traduzidos pela IFizinha — linguagem simples, informação completa.',
};

export default async function EditaisPage() {
  // Antes da lista: se algum status mudou, o cache dela é invalidado aqui.
  await garantirStatusEditaisAtualizado();
  const editais = await withCache('editais:published', () => prisma.edital.findMany({
    // Fonte única da regra "edital visível ao público" (src/lib/editais-publicos.ts).
    where: EDITAL_PUBLICO_WHERE,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      titulo: true,
      slug: true,
      categoria: true,
      resumoSimples: true,
      resumo: true,
      dataEncerramento: true,
      status: true,
      destaque: true,
      visualizacoes: true,
      ano: true,
      areaEdital: true,
      linkOficial: true,
      updatedAt: true,
    },
  }), 5 * 60 * 1000);

  // A serialização de Date acontece na fronteira server/client: a lista vai como
  // string ISO e o explorador converte de volta quando precisa de dias restantes.
  const listados: EditalListado[] = editais.map((edital) => ({
    ...edital,
    dataEncerramento: edital.dataEncerramento ? edital.dataEncerramento.toISOString() : null,
    updatedAt: edital.updatedAt.toISOString(),
  }));

  const editaisAtivos = editais.filter(
    (e) => e.status === 'ABERTO' || e.status === 'EM_ANALISE' || e.status === 'PRAZO_RECURSO'
  );

  return (
    <div className="min-h-screen">
      <PageHero
        trilha={[{ href: '/', label: 'Início' }, { label: 'Editais' }]}
        etiqueta="Oportunidades"
        titulo="Editais & Oportunidades"
        descricao="Todos os editais do IFPR Ivaiporã traduzidos pela IFizinha. Linguagem simples, estrutura clara — você entende tudo."
        icone={<BookOpen className="h-7 w-7 text-azul-eletrico" />}
        fundoIcone="bg-azul-50"
        mascote={{
          nome: 'hero',
          dica: 'Todo edital tem uma versão explicada por mim — é só abrir!',
        }}
      >
        {/* Dica da IFizinha (fundo claro, como no resto do portal) */}
        <div className="mt-6 flex max-w-2xl items-start gap-3 rounded-2xl border border-purple-100 bg-gradient-to-br from-blue-50 to-purple-50 p-4">
          <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-roxo-luminoso" />
          <div>
            <p className="mb-0.5 text-sm font-semibold text-gray-900">Dica da IFizinha</p>
            <p className="text-sm leading-relaxed text-gray-600">
              Cada edital tem duas abas: a versão simplificada que preparei com carinho, e o edital
              original completo. Sempre confirme os detalhes no documento oficial, tá?
            </p>
          </div>
        </div>
      </PageHero>

      {/* Alertas urgentes */}
      {editaisAtivos.some((e) => e.dataEncerramento && getDaysUntil(e.dataEncerramento) <= 7) && (
        <div className="relative z-10 bg-orange-50 border-b border-orange-100">
          <div className="container mx-auto px-4 max-w-7xl py-3">
            <div className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-medium">
                <strong>Atenção:</strong> Há editais encerrando em breve! Confira abaixo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo principal — fundo próprio e `z-10` para cobrir a sobra da
          mascote do cabeçalho (é o que faz ela terminar exatamente na divisão) */}
      <div className="relative z-10 bg-gray-50">
        <div className="container mx-auto px-4 max-w-7xl py-10">
          <EditaisExplorer editais={listados} />
        </div>
      </div>
    </div>
  );
}
