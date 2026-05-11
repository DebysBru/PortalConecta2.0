import React from 'react';
import Link from 'next/link';
import { BookOpen, Clock, Search, Filter, AlertCircle, ChevronRight, Sparkles, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateShort, getDaysUntil, getStatusLabel, getStatusColor, getCategoryColor } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editais',
  description: 'Todos os editais do IFPR Campus Ivaiporã traduzidos pela IFizinha — linguagem simples, informação completa.',
};

// Dados mock para o MVP
const editais = [
  {
    id: '1',
    titulo: 'Auxílio Estudantil – Programa de Assistência Estudantil 2025',
    slug: 'auxilio-estudantil-2025',
    categoria: 'AUXILIOS',
    resumo: 'Concessão de auxílios financeiros para estudantes em vulnerabilidade socioeconômica: Auxílio Permanência (R$350), Auxílio Transporte (R$200) e Auxílio Alimentação (R$150).',
    dataEncerramento: new Date('2025-08-15'),
    status: 'ENCERRA_BREVE',
    destaque: true,
    visualizacoes: 342,
  },
  {
    id: '2',
    titulo: 'Edital PROEX 01/2025 – Bolsas de Extensão',
    slug: 'proex-bolsas-extensao-2025',
    categoria: 'BOLSAS',
    resumo: 'Seleção de estudantes para recebimento de bolsas de extensão no valor de R$400/mês para participação em projetos de extensão do IFPR Campus Ivaiporã.',
    dataEncerramento: new Date('2025-08-31'),
    status: 'ATIVO',
    destaque: true,
    visualizacoes: 218,
  },
  {
    id: '3',
    titulo: 'Edital PIBIC 02/2025 – Programa Institucional de Bolsas de Iniciação Científica',
    slug: 'pibic-iniciacao-cientifica-2025',
    categoria: 'PESQUISA',
    resumo: 'Seleção de estudantes para o Programa de Iniciação Científica, com bolsas de R$700/mês para desenvolvimento de projetos de pesquisa orientados por docentes.',
    dataEncerramento: new Date('2025-09-15'),
    status: 'ATIVO',
    destaque: true,
    visualizacoes: 156,
  },
  {
    id: '4',
    titulo: 'Seleção de Projetos de Extensão 2025/2026',
    slug: 'selecao-projetos-extensao-2025',
    categoria: 'EXTENSAO',
    resumo: 'Chamada para submissão de propostas de projetos de extensão para o período 2025-2026, com possibilidade de financiamento de até R$5.000 por projeto aprovado.',
    dataEncerramento: new Date('2025-10-30'),
    status: 'ATIVO',
    destaque: false,
    visualizacoes: 89,
  },
];

const categorias = ['Todas', 'BOLSAS', 'AUXILIOS', 'PESQUISA', 'EXTENSAO', 'ENSINO', 'ESTAGIOS', 'EVENTOS', 'RESULTADOS'];

export default function EditaisPage() {
  const editaisAtivos = editais.filter((e) => e.status === 'ATIVO' || e.status === 'ENCERRA_BREVE');

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="bg-hero-gradient pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center gap-2 text-white/70 text-sm mb-4">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">Editais</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center border border-white/30 flex-shrink-0">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Editais & Oportunidades</h1>
              <p className="text-white/80 text-lg max-w-2xl">
                Todos os editais do IFPR Ivaiporã traduzidos pela IFizinha.
                Linguagem simples, estrutura clara — você entende tudo.
              </p>
            </div>
          </div>

          {/* IFizinha tip */}
          <div className="mt-8 bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/20 max-w-2xl flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">✨</span>
            <div>
              <p className="text-white font-semibold text-sm mb-0.5">Dica da IFizinha</p>
              <p className="text-white/80 text-sm">
                Cada edital tem duas abas: a versão simplificada que preparei com carinho,
                e o edital original completo. Sempre confirme os detalhes no documento oficial, tá?
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas urgentes */}
      {editaisAtivos.some((e) => getDaysUntil(e.dataEncerramento) <= 7) && (
        <div className="bg-orange-50 border-b border-orange-100">
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

      {/* Conteúdo principal */}
      <div className="container mx-auto px-4 max-w-7xl py-10">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Buscar editais..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select className="pl-3 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico bg-white">
              {categorias.map((cat) => (
                <option key={cat} value={cat}>{cat === 'Todas' ? 'Todas as categorias' : getStatusLabel(cat)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Categorias pills */}
        <div className="flex gap-2 flex-wrap mb-8">
          {categorias.map((cat) => (
            <button
              key={cat}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                cat === 'Todas'
                  ? 'bg-azul-eletrico text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat === 'Todas' ? 'Todas' : getStatusLabel(cat)}
            </button>
          ))}
        </div>

        {/* Resultado count */}
        <p className="text-sm text-gray-500 mb-6">
          Mostrando <strong className="text-gray-900">{editais.length}</strong> editais
        </p>

        {/* Lista de editais */}
        <div className="space-y-4">
          {editais.map((edital) => {
            const daysLeft = getDaysUntil(edital.dataEncerramento);
            const isUrgent = daysLeft <= 7 && daysLeft > 0;
            const isExpired = daysLeft <= 0;

            return (
              <Link
                key={edital.id}
                href={`/editais/${edital.slug}`}
                className="block group"
              >
                <div className={`bg-white rounded-2xl border p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                  isUrgent ? 'border-orange-200 ring-1 ring-orange-100' :
                  isExpired ? 'border-gray-100 opacity-70' :
                  'border-gray-100 hover:border-azul-eletrico/30'
                }`}>
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {edital.destaque && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-dourado-ifizinha bg-yellow-50 border border-yellow-200 px-2.5 py-1 rounded-full">
                            <Sparkles className="w-3 h-3" />
                            Destaque
                          </span>
                        )}
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getCategoryColor(edital.categoria)}`}>
                          {getStatusLabel(edital.categoria)}
                        </span>
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(edital.status)}`}>
                          {getStatusLabel(edital.status)}
                        </span>
                        {isUrgent && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full animate-pulse">
                            <AlertCircle className="w-3 h-3" />
                            {daysLeft === 1 ? 'Último dia!' : `${daysLeft} dias restantes!`}
                          </span>
                        )}
                      </div>

                      <h2 className="font-bold text-gray-900 text-lg leading-snug mb-2 group-hover:text-azul-eletrico transition-colors">
                        {edital.titulo}
                      </h2>

                      <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">
                        {edital.resumo}
                      </p>
                    </div>

                    {/* Side info */}
                    <div className="flex md:flex-col items-center md:items-end gap-4 md:gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Encerra em</p>
                        <p className={`text-sm font-semibold ${isUrgent ? 'text-orange-600' : 'text-gray-700'}`}>
                          {formatDateShort(edital.dataEncerramento)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-xs text-gray-400 hidden md:block">{edital.visualizacoes} visualizações</div>
                        <div className="w-9 h-9 rounded-xl bg-azul-eletrico/10 flex items-center justify-center group-hover:bg-azul-eletrico transition-colors">
                          <ChevronRight className="w-4 h-4 text-azul-eletrico group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* IFizinha tag */}
                  <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-azul-eletrico font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-dourado-ifizinha" />
                      Versão IFizinha disponível
                    </div>
                    <span className="text-gray-200">•</span>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <ExternalLink className="w-3 h-3" />
                      Edital original
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
