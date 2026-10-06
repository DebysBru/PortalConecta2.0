
import { PageHero } from '@/components/layout/PageHero';import React from 'react';
import Link from 'next/link';
import { FolderOpen, ChevronRight, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { listProjetosPublicos } from '@/lib/projetos-publicos';
import {
  normalizarParamsProjetos,
  type ProjetoSearchParams,
} from '@/lib/projetos-filtros';
import { ProjetosExplorer } from './ProjetosExplorer';

// `force-dynamic` é obrigatório aqui: sem ele o Next tenta pré-renderizar esta
// página durante o BUILD, o que dispara consultas ao banco em tempo de
// compilação. Em qualquer ambiente cujo banco não esteja acessível durante o
// build, isso derruba o deploy inteiro com PrismaClientInitializationError:
// "Can't reach database server". As demais páginas públicas (`/`, `/editais`,
// `/agenda`) já tinham esta flag — `/projetos` era a única que faltava.
// (A antiga `revalidate = 300` saiu: a página é dinâmica por ler searchParams.)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Projetos',
  description: 'Diretório completo dos projetos de extensão, pesquisa e ensino do IFPR Campus Ivaiporã.',
};

// Filtro e paginação acontecem no servidor (ROADMAP 1.15b): a página lê os
// searchParams e busca apenas a página atual no banco.
export default async function ProjetosPage({
  searchParams,
}: {
  searchParams: ProjetoSearchParams;
}) {
  const params = normalizarParamsProjetos(searchParams);
  const resultado = await listProjetosPublicos(params);
  const { stats } = resultado;

  return (
    <div className="min-h-screen">
      <PageHero
        trilha={[{ href: '/', label: 'Início' }, { label: 'Projetos' }]}
        etiqueta="Extensão, pesquisa e ensino"
        titulo="Projetos de Extensão"
        descricao="Conheça os projetos que estão transformando o Vale do Ivaí. Pesquisa, extensão e ensino conectando o IFPR à comunidade."
        cor="text-roxo-luminoso"
        icone={<FolderOpen className="h-7 w-7 text-roxo-luminoso" />}
        fundoIcone="bg-roxo-50"
        mascote={{
          nome: 'de-costas',
          dica: 'Estes são os projetos do campus — tem vaga aberta em vários!',
        }}
      >
        {/* Estatísticas em chips claros (antes ficavam sobre a faixa escura) */}
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            { label: 'Em execução', value: stats.emExecucao, cor: 'bg-green-500' },
            { label: 'Inscrições abertas', value: stats.inscricoesAbertas, cor: 'bg-azul-eletrico' },
            { label: 'Total', value: stats.total, cor: 'bg-roxo-luminoso' },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${s.cor}`} aria-hidden />
              <span className="text-lg font-bold text-gray-900">{s.value}</span>
              <span className="text-sm text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>
      </PageHero>

      {/* Conteúdo — fundo próprio e `z-10` para cobrir a sobra da mascote do
          cabeçalho (é o que faz ela terminar exatamente na divisão) */}
      <div className="relative z-10 bg-gray-50">
        <div className="container mx-auto px-4 max-w-7xl py-10">
        <ProjetosExplorer
          projetos={resultado.itens}
          destaques={resultado.destaques}
          total={resultado.total}
          page={resultado.page}
          totalPages={resultado.totalPages}
          filtros={resultado.filtros}
          filtrando={resultado.filtrando}
          params={params}
        />

        {/* CTA Participe */}
        <div className="mt-12 bg-gradient-to-br from-azul-eletrico/5 via-roxo-luminoso/5 to-rosa-vibrante/5 rounded-3xl border border-gray-100 p-8 md:p-10 text-center">
          <div className="w-14 h-14 bg-hero-gradient rounded-2xl flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3">Quer fazer parte de um projeto?</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Entre em contato com o coordenador do projeto ou aguarde os editais de bolsas de extensão!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/editais" className="inline-flex items-center justify-center gap-2 bg-hero-gradient text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-all">
              <Sparkles className="w-5 h-5" />
              Ver Editais de Bolsas
            </Link>
            <Link href="/agenda" className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition-all">
              Ver Eventos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
