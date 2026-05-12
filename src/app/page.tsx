import React from 'react';
import Link from 'next/link';
import {
  Sparkles, FolderOpen, ChevronRight,
  Clock, ArrowRight, Users, FileText, Star, Zap, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatDateShort, getDaysUntil, getStatusLabel, getStatusColor, getCategoryColor
} from '@/lib/utils';
import { HeroIFizinha } from '@/components/sections/HeroIFizinha';
import { ProjetosGrid } from '@/components/sections/ProjetosGrid';

// Dados mock para o MVP (substituir por fetch do Prisma quando o banco estiver conectado)
const editaisDestaque = [
  {
    id: '1',
    titulo: 'Auxílio Estudantil – Programa de Assistência Estudantil 2025',
    slug: 'auxilio-estudantil-2025',
    categoria: 'AUXILIOS',
    resumo: 'Auxílios financeiros para estudantes em vulnerabilidade socioeconômica: Permanência (R$350), Transporte (R$200) e Alimentação (R$150).',
    dataEncerramento: new Date('2025-08-15'),
    status: 'ENCERRA_BREVE',
  },
  {
    id: '2',
    titulo: 'Edital PROEX 01/2025 – Bolsas de Extensão',
    slug: 'proex-bolsas-extensao-2025',
    categoria: 'BOLSAS',
    resumo: 'Seleção de estudantes para bolsas de extensão de R$400/mês para participação em projetos do campus.',
    dataEncerramento: new Date('2025-08-31'),
    status: 'ATIVO',
  },
  {
    id: '3',
    titulo: 'Edital PIBIC 02/2025 – Iniciação Científica',
    slug: 'pibic-iniciacao-cientifica-2025',
    categoria: 'PESQUISA',
    resumo: 'Bolsas de R$700/mês para desenvolvimento de pesquisa científica com orientação de docentes.',
    dataEncerramento: new Date('2025-09-15'),
    status: 'ATIVO',
  },
];

const proximosEventos = [
  { id: '1', titulo: 'Prazo Final – Auxílio Estudantil', data: new Date('2025-08-15'), tipo: 'PRAZO_EDITAL' },
  { id: '2', titulo: 'Prazo Final – Bolsas de Extensão', data: new Date('2025-08-31'), tipo: 'PRAZO_EDITAL' },
  { id: '3', titulo: 'Semana de Ciência e Tecnologia IFPR', data: new Date('2025-09-08'), tipo: 'EVENTO_CAMPUS' },
  { id: '4', titulo: 'Prazo Final – PIBIC 02/2025', data: new Date('2025-09-15'), tipo: 'PRAZO_EDITAL' },
];

const stats = [
  { label: 'Editais Ativos', value: '4', icon: FileText, color: 'text-azul-eletrico', bg: 'bg-azul-eletrico/10' },
  { label: 'Projetos em Execução', value: '25+', icon: FolderOpen, color: 'text-roxo-luminoso', bg: 'bg-roxo-luminoso/10' },
  { label: 'Estudantes Beneficiados', value: '300+', icon: Users, color: 'text-rosa-vibrante', bg: 'bg-rosa-vibrante/10' },
  { label: 'Editais Traduzidos', value: '12', icon: Sparkles, color: 'text-ciano-claro', bg: 'bg-ciano-claro/10' },
];

const tipoEventoConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PRAZO_EDITAL: { label: 'Prazo', color: 'bg-red-100 text-red-700', icon: <AlertCircle className="w-3 h-3" /> },
  EVENTO_CAMPUS: { label: 'Campus', color: 'bg-blue-100 text-blue-700', icon: <Star className="w-3 h-3" /> },
  EVENTO_PROJETO: { label: 'Projeto', color: 'bg-purple-100 text-purple-700', icon: <Zap className="w-3 h-3" /> },
};

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <HeroIFizinha />

      {/* === ESTATÍSTICAS === */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center text-center p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all group"
              >
                <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <p className={`text-3xl font-black ${stat.color} mb-1`}>{stat.value}</p>
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === EDITAIS EM DESTAQUE === */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between mb-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-6 bg-hero-gradient rounded-full" />
                <p className="text-sm font-semibold text-azul-eletrico uppercase tracking-wider">Oportunidades</p>
              </div>
              <h2 className="text-3xl font-black text-gray-900">Editais em Destaque</h2>
              <p className="text-gray-500 mt-1">Traduzidos pela IFizinha — linguagem simples, informação completa</p>
            </div>
            <Link
              href="/editais"
              className="hidden md:flex items-center gap-1.5 text-azul-eletrico font-semibold hover:gap-3 transition-all text-sm"
            >
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {editaisDestaque.map((edital, index) => {
              const daysLeft = getDaysUntil(edital.dataEncerramento);
              const isUrgent = daysLeft <= 7 && daysLeft > 0;

              return (
                <Link
                  key={edital.id}
                  href={`/editais/${edital.slug}`}
                  className="group block"
                >
                  <div className={`bg-white rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl h-full flex flex-col ${
                    isUrgent ? 'border-orange-200 ring-2 ring-orange-100' : 'border-gray-100 hover:border-azul-eletrico/30'
                  }`}>
                    {isUrgent && (
                      <div className="flex items-center gap-1.5 text-orange-600 text-xs font-semibold mb-3 bg-orange-50 rounded-lg px-3 py-1.5 w-fit">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Encerra em {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}!
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex gap-2 flex-wrap">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getCategoryColor(edital.categoria)}`}>
                          {getStatusLabel(edital.categoria)}
                        </span>
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(edital.status)}`}>
                          {getStatusLabel(edital.status)}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-azul-eletrico/10 flex items-center justify-center flex-shrink-0 group-hover:bg-azul-eletrico group-hover:text-white transition-colors">
                        <ChevronRight className="w-4 h-4 text-azul-eletrico group-hover:text-white" />
                      </div>
                    </div>

                    <h3 className="font-bold text-gray-900 text-base leading-snug mb-3 group-hover:text-azul-eletrico transition-colors flex-1">
                      {edital.titulo}
                    </h3>

                    <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2">
                      {edital.resumo}
                    </p>

                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-auto pt-3 border-t border-gray-50">
                      <Clock className="w-3.5 h-3.5" />
                      Encerra: {formatDateShort(edital.dataEncerramento)}
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-azul-eletrico font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-dourado-ifizinha" />
                      Ver versão IFizinha
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 text-center md:hidden">
            <Link href="/editais">
              <Button variant="outline" className="w-full max-w-xs">
                Ver todos os editais
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <ProjetosGrid />

      {/* === PRÓXIMOS EVENTOS === */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between mb-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-6 bg-hero-gradient rounded-full" />
                <p className="text-sm font-semibold text-rosa-vibrante uppercase tracking-wider">Agenda</p>
              </div>
              <h2 className="text-3xl font-black text-gray-900">Próximos Eventos & Prazos</h2>
              <p className="text-gray-500 mt-1">Não perca nenhuma data importante</p>
            </div>
            <Link
              href="/agenda"
              className="hidden md:flex items-center gap-1.5 text-rosa-vibrante font-semibold hover:gap-3 transition-all text-sm"
            >
              Agenda completa
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {proximosEventos.map((evento) => {
              const config = tipoEventoConfig[evento.tipo] ?? { label: evento.tipo, color: 'bg-gray-100 text-gray-700', icon: null };
              const daysLeft = getDaysUntil(evento.data);

              return (
                <div
                  key={evento.id}
                  className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all p-4 flex items-center gap-4"
                >
                  {/* Date badge */}
                  <div className="flex-shrink-0 w-14 h-14 bg-gray-50 rounded-xl flex flex-col items-center justify-center border border-gray-100">
                    <p className="text-xl font-black text-gray-900 leading-none">
                      {evento.data.getDate().toString().padStart(2, '0')}
                    </p>
                    <p className="text-xs text-gray-500 font-medium uppercase">
                      {evento.data.toLocaleString('pt-BR', { month: 'short' })}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">
                      {evento.titulo}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                        {config.icon}
                        {config.label}
                      </span>
                      {daysLeft > 0 && daysLeft <= 30 && (
                        <span className={`text-xs font-medium ${daysLeft <= 7 ? 'text-red-600' : 'text-gray-500'}`}>
                          {daysLeft === 1 ? 'Amanhã!' : `Em ${daysLeft} dias`}
                        </span>
                      )}
                    </div>
                  </div>

                  {daysLeft <= 7 && daysLeft > 0 && (
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 text-center md:hidden">
            <Link href="/agenda">
              <Button variant="outline" className="w-full max-w-xs">
                Ver agenda completa
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* === IFIZINHA CTA FINAL === */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="bg-hero-gradient rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
            </div>
            <div className="relative">
              <div className="text-5xl mb-4">✨</div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                Ainda com dúvidas sobre algum edital?
              </h2>
              <p className="text-white/85 text-lg max-w-xl mx-auto mb-8">
                Cada edital no Portal Conecta tem uma tradução especial minha — a versão IFizinha!
                Linguagem simples, estrutura clara, sem enrolação.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/editais"
                  className="inline-flex items-center justify-center gap-2 bg-white text-azul-eletrico font-bold px-8 py-4 rounded-xl hover:bg-white/90 transition-all shadow-lg text-base"
                >
                  <Sparkles className="w-5 h-5" />
                  Ver Editais com a IFizinha
                </Link>
                <Link
                  href="/projetos"
                  className="inline-flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/25 transition-all border border-white/30 text-base"
                >
                  <FolderOpen className="w-5 h-5" />
                  Conhecer os Projetos
                </Link>
              </div>
              <p className="text-white/60 text-xs mt-6">
                * Confira sempre o edital oficial — a versão IFizinha é um resumo para facilitar seu entendimento.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
