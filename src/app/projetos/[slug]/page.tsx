import React from 'react';
import Link from 'next/link';
import { ChevronRight, Users, Mail, Instagram, Globe, ArrowLeft, BookOpen, Calendar, ArrowRight } from 'lucide-react';
import { getStatusLabel, getStatusColor } from '@/lib/utils';
import type { Metadata } from 'next';

const projetos: Record<string, {
  id: string; nome: string; coordenador: string; area: string;
  corPrimaria: string; status: string; slug: string; descricao: string;
  email?: string; instagram?: string; site?: string;
}> = {
  'marketing-digital-solidario': {
    id: '1', nome: 'Marketing Digital Solidário', coordenador: 'Onivaldo Flores Junior',
    area: 'Marketing Digital', corPrimaria: '#2F52D3', status: 'EM_EXECUCAO',
    slug: 'marketing-digital-solidario', instagram: '@mktdigitalsolidario',
    descricao: 'O Marketing Digital Solidário é um projeto de extensão do IFPR Campus Ivaiporã que capacita estudantes em marketing digital e comunicação, promovendo o desenvolvimento de habilidades práticas e apoio a organizações sociais da região do Vale do Ivaí.\n\nO projeto atua em duas frentes principais: a capacitação interna dos estudantes (com formações em design, redes sociais, produção de conteúdo e gestão de campanhas) e a prestação de serviços gratuitos de marketing digital para ONGs, associações e pequenos empreendedores locais.\n\nAtualmente, o projeto é responsável pelo Portal Conecta IFPR e pela persona IFizinha, iniciativas que democratizam o acesso à informação institucional para estudantes.',
  },
  'mais-empatia': {
    id: '2', nome: 'Mais Empatia', coordenador: 'Aline Spaciari Matioli',
    area: 'Psicologia e Saúde Mental', corPrimaria: '#E83D89', status: 'EM_EXECUCAO',
    slug: 'mais-empatia',
    descricao: 'O Mais Empatia é um projeto voltado ao desenvolvimento da empatia e habilidades socioemocionais na comunidade escolar. Por meio de rodas de conversa, dinâmicas e intervenções artísticas, o projeto promove saúde mental e bem-estar entre estudantes do IFPR e das escolas parceiras.\n\nO projeto trabalha com temáticas como escuta ativa, resolução de conflitos, diversidade e inclusão, contribuindo para um ambiente escolar mais acolhedor e saudável para todos.',
  },
  'ao-infinito-e-alem-astronomia-para-todos': {
    id: '3', nome: 'Ao Infinito e Além: Astronomia para Todos', coordenador: 'Adriano Jose Ortiz',
    area: 'Ciências e Astronomia', corPrimaria: '#7B24C7', status: 'EM_EXECUCAO',
    slug: 'ao-infinito-e-alem-astronomia-para-todos',
    descricao: 'Democratizando o acesso à astronomia por meio de atividades práticas, observações noturnas e oficinas educativas para a comunidade do Vale do Ivaí.\n\nO projeto realiza sessões de observação do céu com telescópios, palestras sobre astronomia básica, astrofísica e exploração espacial, além de visitas às escolas da região. Todas as atividades são abertas à comunidade, sem custo, buscando despertar o interesse pela ciência e pela astronomia em pessoas de todas as idades.',
  },
  'nea-vale-do-ivai': {
    id: '4', nome: 'NEA Vale do Ivaí', coordenador: 'Gisele Fernanda Mouro',
    area: 'Agroecologia', corPrimaria: '#2E7D32', status: 'EM_EXECUCAO',
    slug: 'nea-vale-do-ivai',
    descricao: 'O Núcleo de Estudos em Agroecologia (NEA) Vale do Ivaí promove práticas sustentáveis de produção agrícola, conectando saberes tradicionais e científicos na região.\n\nO projeto desenvolve pesquisas em agroecologia, realiza oficinas com agricultores familiares e produz materiais educativos sobre produção orgânica, permacultura e segurança alimentar. Também mantém um espaço demonstrativo de agroecologia no campus.',
  },
};

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const projeto = projetos[params.slug];
  if (!projeto) return { title: 'Projeto não encontrado' };
  return { title: projeto.nome, description: projeto.descricao.slice(0, 160) };
}

export default function ProjetoPage({ params }: { params: Params }) {
  const projeto = projetos[params.slug];

  if (!projeto) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Projeto não encontrado</h1>
          <p className="text-gray-500 mb-6">Este projeto pode não ter página individual ainda ou o link está incorreto.</p>
          <Link href="/projetos">
            <button className="inline-flex items-center gap-2 bg-azul-eletrico text-white font-semibold px-6 py-3 rounded-xl hover:bg-azul-eletrico/90 transition-all">
              Ver todos os projetos
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const paragrafos = projeto.descricao.split('\n\n');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="pt-20 pb-10" style={{ background: `linear-gradient(135deg, ${projeto.corPrimaria} 0%, ${projeto.corPrimaria}cc 100%)` }}>
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-2 text-white/70 text-sm mb-6">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/projetos" className="hover:text-white transition-colors">Projetos</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white truncate max-w-48">{projeto.nome}</span>
          </div>

          <div className="flex items-start gap-5">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-2xl flex items-center justify-center text-white font-black text-3xl border border-white/30 flex-shrink-0">
              {projeto.nome.charAt(0)}
            </div>
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(projeto.status)}`}>
                  {getStatusLabel(projeto.status)}
                </span>
                <span className="bg-white/20 text-white text-sm font-medium px-3 py-1 rounded-full">
                  {projeto.area}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mb-2 leading-tight">{projeto.nome}</h1>
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Users className="w-4 h-4" />
                <span>Coordenação: <strong className="text-white">{projeto.coordenador}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container mx-auto px-4 max-w-5xl py-8">
        <Link href="/projetos" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Voltar aos projetos
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Sobre o Projeto</h2>
              <div className="space-y-4">
                {paragrafos.map((p, i) => (
                  <p key={i} className="text-gray-700 leading-relaxed">{p}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Info card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4">Informações</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${projeto.corPrimaria}20` }}>
                    <Users className="w-4 h-4" style={{ color: projeto.corPrimaria }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Coordenação</p>
                    <p className="text-sm text-gray-700 font-semibold">{projeto.coordenador}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${projeto.corPrimaria}20` }}>
                    <BookOpen className="w-4 h-4" style={{ color: projeto.corPrimaria }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Área</p>
                    <p className="text-sm text-gray-700 font-semibold">{projeto.area}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${projeto.corPrimaria}20` }}>
                    <Calendar className="w-4 h-4" style={{ color: projeto.corPrimaria }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Status</p>
                    <p className="text-sm font-semibold text-green-600">{getStatusLabel(projeto.status)}</p>
                  </div>
                </div>
              </div>

              {/* Contatos */}
              {(projeto.email || projeto.instagram || projeto.site) && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Contato</p>
                  {projeto.email && (
                    <a href={`mailto:${projeto.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-azul-eletrico transition-colors">
                      <Mail className="w-4 h-4" />
                      {projeto.email}
                    </a>
                  )}
                  {projeto.instagram && (
                    <a href={`https://instagram.com/${projeto.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-600 hover:text-azul-eletrico transition-colors">
                      <Instagram className="w-4 h-4" />
                      {projeto.instagram}
                    </a>
                  )}
                  {projeto.site && (
                    <a href={projeto.site} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-600 hover:text-azul-eletrico transition-colors">
                      <Globe className="w-4 h-4" />
                      Site do projeto
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* CTA Participe */}
            <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${projeto.corPrimaria} 0%, ${projeto.corPrimaria}cc 100%)` }}>
              <h3 className="font-bold mb-2">Quer participar?</h3>
              <p className="text-sm text-white/80 mb-4">Entre em contato com o coordenador ou aguarde os editais de bolsas!</p>
              <Link href="/editais" className="inline-flex items-center gap-1.5 bg-white text-gray-900 font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-all text-sm w-full justify-center">
                Ver Editais de Bolsas
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
