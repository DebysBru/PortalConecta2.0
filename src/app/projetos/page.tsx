import React from 'react';
import Link from 'next/link';
import { FolderOpen, ChevronRight, Search, Filter, Users, ArrowRight, TrendingUp, Sparkles } from 'lucide-react';
import { getStatusLabel, getStatusColor } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Projetos',
  description: 'Diretório completo dos projetos de extensão, pesquisa e ensino do IFPR Campus Ivaiporã.',
};

const projetos = [
  { id: '1', nome: 'Marketing Digital Solidário', coordenador: 'Onivaldo Flores Junior', area: 'Marketing Digital', corPrimaria: '#2F52D3', status: 'EM_EXECUCAO', slug: 'marketing-digital-solidario', destaque: true, descricao: 'Capacitação em marketing digital e comunicação, promovendo habilidades práticas e apoio a organizações sociais.' },
  { id: '2', nome: 'Mais Empatia', coordenador: 'Aline Spaciari Matioli', area: 'Psicologia', corPrimaria: '#E83D89', status: 'EM_EXECUCAO', slug: 'mais-empatia', destaque: true, descricao: 'Desenvolvimento de empatia e habilidades socioemocionais na comunidade escolar.' },
  { id: '3', nome: 'Ao Infinito e Além: Astronomia para Todos', coordenador: 'Adriano Jose Ortiz', area: 'Astronomia', corPrimaria: '#7B24C7', status: 'EM_EXECUCAO', slug: 'ao-infinito-e-alem-astronomia-para-todos', destaque: true, descricao: 'Democratizando o acesso à astronomia com observações noturnas e oficinas educativas.' },
  { id: '4', nome: 'NEA Vale do Ivaí', coordenador: 'Gisele Fernanda Mouro', area: 'Agroecologia', corPrimaria: '#2E7D32', status: 'EM_EXECUCAO', slug: 'nea-vale-do-ivai', destaque: false, descricao: 'Práticas sustentáveis de produção agrícola conectando saberes tradicionais e científicos.' },
  { id: '5', nome: 'Biologia Ilustrada', coordenador: 'Andrea Martini Ribeiro Gonçalves', area: 'Biologia', corPrimaria: '#00897B', status: 'EM_EXECUCAO', slug: 'biologia-ilustrada', destaque: false, descricao: 'Aproximando a biologia da comunidade através da ilustração científica.' },
  { id: '6', nome: 'Química na Cozinha', coordenador: 'Carlos Eduardo Martins', area: 'Química', corPrimaria: '#F57C00', status: 'EM_EXECUCAO', slug: 'quimica-na-cozinha', destaque: false, descricao: 'Experimentos culinários para ensinar química de forma prática e divertida.' },
  { id: '7', nome: 'Robótica Educacional IFPR', coordenador: 'João Paulo Ferreira', area: 'Tecnologia', corPrimaria: '#1565C0', status: 'EM_EXECUCAO', slug: 'robotica-educacional-ifpr', destaque: false, descricao: 'Introdução à robótica e programação para jovens da comunidade.' },
  { id: '8', nome: 'Horta Comunitária', coordenador: 'Mariana Costa Silva', area: 'Agricultura', corPrimaria: '#388E3C', status: 'EM_EXECUCAO', slug: 'horta-comunitaria', destaque: false, descricao: 'Hortas comunitárias em escolas e espaços públicos para educação ambiental.' },
  { id: '9', nome: 'Letramento Digital para Terceira Idade', coordenador: 'Fernanda Lima Rodrigues', area: 'Inclusão Digital', corPrimaria: '#6A1B9A', status: 'EM_EXECUCAO', slug: 'letramento-digital-terceira-idade', destaque: false, descricao: 'Capacitação digital para pessoas com 60 anos ou mais.' },
  { id: '10', nome: 'Teatro na Escola', coordenador: 'Patricia Alves Mendonça', area: 'Artes', corPrimaria: '#C62828', status: 'EM_EXECUCAO', slug: 'teatro-na-escola', destaque: false, descricao: 'Teatro educativo que desenvolve expressão artística e trabalho em equipe.' },
  { id: '11', nome: 'Cidadania e Direitos', coordenador: 'Roberto Santos Oliveira', area: 'Direito', corPrimaria: '#0277BD', status: 'EM_EXECUCAO', slug: 'cidadania-e-direitos', destaque: false, descricao: 'Orientação jurídica gratuita e educação em direitos fundamentais.' },
  { id: '12', nome: 'Matemática Descomplicada', coordenador: 'Ana Beatriz Torres', area: 'Matemática', corPrimaria: '#283593', status: 'EM_EXECUCAO', slug: 'matematica-descomplicada', destaque: false, descricao: 'Reforço escolar em matemática com metodologias lúdicas e interativas.' },
  { id: '13', nome: 'Biblioteca Viva', coordenador: 'Luciana Freitas Campos', area: 'Literatura', corPrimaria: '#4E342E', status: 'EM_EXECUCAO', slug: 'biblioteca-viva', destaque: false, descricao: 'Promoção da leitura e formação de leitores críticos.' },
  { id: '14', nome: 'Empreendedorismo Jovem', coordenador: 'Marcos Antonio Ramos', area: 'Empreendedorismo', corPrimaria: '#FF6F00', status: 'EM_EXECUCAO', slug: 'empreendedorismo-jovem', destaque: false, descricao: 'Capacitação em empreendedorismo e economia criativa para jovens.' },
  { id: '15', nome: 'Saúde Bucal na Comunidade', coordenador: 'Dra. Silvia Moreira', area: 'Saúde', corPrimaria: '#00838F', status: 'EM_EXECUCAO', slug: 'saude-bucal-na-comunidade', destaque: false, descricao: 'Ações de saúde bucal preventiva em escolas públicas.' },
  { id: '16', nome: 'Física em Experimentos', coordenador: 'Prof. Eduardo Almeida', area: 'Física', corPrimaria: '#37474F', status: 'EM_EXECUCAO', slug: 'fisica-em-experimentos', destaque: false, descricao: 'Laboratório itinerante de física experimental para escolas da região.' },
  { id: '17', nome: 'Línguas sem Fronteiras', coordenador: 'Profa. Carla Werneck', area: 'Idiomas', corPrimaria: '#1A237E', status: 'EM_EXECUCAO', slug: 'linguas-sem-fronteiras', destaque: false, descricao: 'Cursos gratuitos de inglês e espanhol para a comunidade.' },
  { id: '18', nome: 'Arte e Sustentabilidade', coordenador: 'Beatriz Cunha Lima', area: 'Arte', corPrimaria: '#558B2F', status: 'EM_EXECUCAO', slug: 'arte-e-sustentabilidade', destaque: false, descricao: 'Criação artística com materiais recicláveis e consciência ambiental.' },
  { id: '19', nome: 'Podcast IFPR', coordenador: 'Diego Carvalho Neto', area: 'Comunicação', corPrimaria: '#4527A0', status: 'EM_EXECUCAO', slug: 'podcast-ifpr', destaque: false, descricao: 'Produção de conteúdo em áudio sobre ciência, tecnologia e cultura.' },
  { id: '20', nome: 'Xadrez Escola', coordenador: 'Prof. Alexandre Dias', area: 'Esporte', corPrimaria: '#BF360C', status: 'EM_EXECUCAO', slug: 'xadrez-escola', destaque: false, descricao: 'Ensino do xadrez como ferramenta pedagógica para raciocínio lógico.' },
  { id: '21', nome: 'Nutrição e Bem-Estar', coordenador: 'Nutricionista Helena Prado', area: 'Nutrição', corPrimaria: '#2E7D32', status: 'EM_EXECUCAO', slug: 'nutricao-e-bem-estar', destaque: false, descricao: 'Educação nutricional e alimentação saudável para famílias.' },
  { id: '22', nome: 'Programação para Iniciantes', coordenador: 'Gustavo Henrique Souza', area: 'Tecnologia', corPrimaria: '#0D47A1', status: 'EM_EXECUCAO', slug: 'programacao-para-iniciantes', destaque: false, descricao: 'Introdução à programação com Python e desenvolvimento web.' },
  { id: '23', nome: 'História e Memória Local', coordenador: 'Prof. Renato Vieira Cruz', area: 'História', corPrimaria: '#6D4C41', status: 'EM_EXECUCAO', slug: 'historia-e-memoria-local', destaque: false, descricao: 'Pesquisa e preservação da memória histórica do Vale do Ivaí.' },
  { id: '24', nome: 'Jogos Matemáticos', coordenador: 'Profa. Vanessa Cardoso', area: 'Matemática', corPrimaria: '#AD1457', status: 'EM_EXECUCAO', slug: 'jogos-matematicos', destaque: false, descricao: 'Jogos educativos para o ensino de matemática de forma lúdica.' },
  { id: '25', nome: 'Veterinária Comunitária', coordenador: 'Dr. Paulo Mendes', area: 'Veterinária', corPrimaria: '#1B5E20', status: 'EM_EXECUCAO', slug: 'veterinaria-comunitaria', destaque: false, descricao: 'Atenção veterinária gratuita para famílias de baixa renda.' },
  { id: '26', nome: 'Inclusão e Acessibilidade', coordenador: 'Profa. Juliana Nunes', area: 'Educação Especial', corPrimaria: '#7B24C7', status: 'EM_EXECUCAO', slug: 'inclusao-e-acessibilidade', destaque: false, descricao: 'Promoção da acessibilidade e inclusão de pessoas com deficiência.' },
  { id: '27', nome: 'Fotografia Social', coordenador: 'Camila Ramos Ferreira', area: 'Arte', corPrimaria: '#4A148C', status: 'ENVIADO_2026', slug: 'fotografia-social', destaque: false, descricao: 'Oficinas de fotografia documental para jovens em vulnerabilidade social.' },
  { id: '28', nome: 'Cooperativismo Solidário', coordenador: 'Prof. Marcio Barbosa', area: 'Economia', corPrimaria: '#E65100', status: 'ENVIADO_2026', slug: 'cooperativismo-solidario', destaque: false, descricao: 'Formação em cooperativismo e economia solidária para trabalhadores informais.' },
];

const areas = ['Todas', ...Array.from(new Set(projetos.map((p) => p.area))).sort()];
const statusOptions = ['Todos', 'EM_EXECUCAO', 'ENVIADO_2026', 'CONCLUIDO'];

export default function ProjetosPage() {
  const emExecucao = projetos.filter((p) => p.status === 'EM_EXECUCAO').length;
  const enviado2026 = projetos.filter((p) => p.status === 'ENVIADO_2026').length;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="bg-hero-gradient pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center gap-2 text-white/70 text-sm mb-4">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">Projetos</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center border border-white/30 flex-shrink-0">
              <FolderOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Projetos de Extensão</h1>
              <p className="text-white/80 text-lg max-w-2xl">
                Conheça os projetos que estão transformando o Vale do Ivaí.
                Pesquisa, extensão e ensino conectando o IFPR à comunidade.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8 flex flex-wrap gap-4">
            {[
              { label: 'Em Execução', value: emExecucao, color: 'bg-green-500' },
              { label: 'Enviados 2026', value: enviado2026, color: 'bg-yellow-500' },
              { label: 'Total', value: projetos.length, color: 'bg-white/30' },
            ].map((s) => (
              <div key={s.label} className="bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/20 flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${s.color}`} />
                <span className="text-white font-bold text-lg">{s.value}</span>
                <span className="text-white/70 text-sm">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container mx-auto px-4 max-w-7xl py-10">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Buscar projetos..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select className="pl-3 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico bg-white">
                <option value="Todas">Área: Todas</option>
                {areas.slice(1).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <select className="pl-3 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico bg-white">
              <option value="Todos">Status: Todos</option>
              {statusOptions.slice(1).map((s) => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
            </select>
          </div>
        </div>

        {/* Projetos Destaque */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-5 h-5 text-dourado-ifizinha" />
            <h2 className="font-bold text-gray-900 text-lg">Projetos em Destaque</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {projetos.filter((p) => p.destaque).map((projeto) => (
              <Link key={projeto.id} href={`/projetos/${projeto.slug}`} className="group block">
                <div className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden h-full flex flex-col">
                  {/* Color header */}
                  <div className="h-24 relative flex items-end p-4" style={{ background: `linear-gradient(135deg, ${projeto.corPrimaria} 0%, ${projeto.corPrimaria}cc 100%)` }}>
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white font-black text-2xl border border-white/30">
                      {projeto.nome.charAt(0)}
                    </div>
                    <div className="ml-auto">
                      <span className="text-white/80 text-xs bg-black/20 rounded-full px-2.5 py-1 font-medium">
                        {getStatusLabel(projeto.status)}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-gray-900 text-base leading-snug mb-1 group-hover:text-azul-eletrico transition-colors">
                      {projeto.nome}
                    </h3>
                    <p className="text-sm text-gray-500 mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {projeto.coordenador}
                    </p>
                    <p className="text-sm text-gray-500 leading-relaxed flex-1 line-clamp-2">{projeto.descricao}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span
                        className="inline-flex px-3 py-1 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: projeto.corPrimaria }}
                      >
                        {projeto.area}
                      </span>
                      <div className="flex items-center gap-1 text-xs font-semibold text-azul-eletrico group-hover:gap-2 transition-all">
                        Saiba mais
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Todos os projetos */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-900 text-lg">Todos os Projetos ({projetos.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projetos.map((projeto) => (
              <Link key={projeto.id} href={`/projetos/${projeto.slug}`} className="group block">
                <div className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 overflow-hidden">
                  <div className="h-2 w-full" style={{ backgroundColor: projeto.corPrimaria }} />
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: projeto.corPrimaria }}
                      >
                        {projeto.nome.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-azul-eletrico transition-colors line-clamp-2">
                          {projeto.nome}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{projeto.coordenador}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span
                        className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: projeto.corPrimaria }}
                      >
                        {projeto.area}
                      </span>
                      <span className={`text-xs font-medium flex items-center gap-1 ${
                        projeto.status === 'EM_EXECUCAO' ? 'text-green-600' :
                        projeto.status === 'ENVIADO_2026' ? 'text-yellow-600' :
                        'text-gray-500'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          projeto.status === 'EM_EXECUCAO' ? 'bg-green-500 animate-pulse' :
                          projeto.status === 'ENVIADO_2026' ? 'bg-yellow-500' :
                          'bg-gray-400'
                        }`} />
                        {projeto.status === 'EM_EXECUCAO' ? 'Ativo' : getStatusLabel(projeto.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

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
  );
}
