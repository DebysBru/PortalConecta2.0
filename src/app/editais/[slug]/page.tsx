import React from 'react';
import Link from 'next/link';
import {
  ChevronRight, Clock, ExternalLink, FileText, Users, BookOpen,
  Calendar, File, Sparkles, AlertCircle, CheckCircle2, ArrowLeft, Eye
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, getDaysUntil, getStatusLabel, getStatusColor, getCategoryColor } from '@/lib/utils';
import type { Metadata } from 'next';

interface TraducaoIFizinha {
  oQueE: string;
  quemPode: string;
  comoParticipar: string;
  quando: string;
  documentos: string[];
  mensagemIfizinha: string;
}

interface Edital {
  id: string;
  titulo: string;
  slug: string;
  categoria: string;
  resumo: string;
  dataEncerramento: Date;
  status: string;
  traducaoIFizinha: TraducaoIFizinha;
  linkOficial: string;
  visualizacoes: number;
}

// Dados mock para o MVP
const editaisData: Record<string, Edital> = {
  'auxilio-estudantil-2025': {
    id: '1',
    titulo: 'Auxílio Estudantil – Programa de Assistência Estudantil 2025',
    slug: 'auxilio-estudantil-2025',
    categoria: 'AUXILIOS',
    resumo: 'Concessão de auxílios financeiros para estudantes em vulnerabilidade socioeconômica.',
    dataEncerramento: new Date('2025-08-15'),
    status: 'ENCERRA_BREVE',
    visualizacoes: 342,
    linkOficial: 'https://ifpr.edu.br/ivaipora/editais',
    traducaoIFizinha: {
      oQueE: 'São auxílios em dinheiro pra te ajudar a continuar estudando! Tem três tipos: Permanência (R$350/mês), Transporte (R$200/mês) e Alimentação (R$150/mês). Você pode solicitar mais de um!',
      quemPode: 'Estudantes com renda familiar per capita de até 1,5 salário mínimo, matriculados em cursos presenciais do IFPR Campus Ivaiporã. Prioridade para quem está em maior vulnerabilidade.',
      comoParticipar: 'Preencha o formulário de cadastro socioeconômico no SUAP, junte todos os documentos e entregue na Coordenadoria de Assuntos Estudantis (CAE) do campus.',
      quando: 'ATENÇÃO: Inscrições encerram em 15 de agosto de 2025 — está acabando o prazo! Resultado previsto para setembro.',
      documentos: [
        'Comprovante de renda de todos os membros da família (últimos 3 meses)',
        'Comprovante de residência atualizado',
        'RG e CPF',
        'Comprovante de matrícula atualizado',
        'Para quem tem: laudo médico, declaração de gravidez, certidão de nascimento de filhos',
      ],
      mensagemIfizinha: 'Calma, ainda dá tempo! Mas corre, porque o prazo está chegando. Se tiver dúvidas sobre os documentos, procura a CAE do campus que eles te ajudam com carinho. Confira sempre o edital oficial para não perder nenhum detalhe, tá? 💙',
    },
  },
  'proex-bolsas-extensao-2025': {
    id: '2',
    titulo: 'Edital PROEX 01/2025 – Bolsas de Extensão',
    slug: 'proex-bolsas-extensao-2025',
    categoria: 'BOLSAS',
    resumo: 'Seleção de estudantes para bolsas de extensão de R$400/mês.',
    dataEncerramento: new Date('2025-08-31'),
    status: 'ATIVO',
    visualizacoes: 218,
    linkOficial: 'https://reitoria.ifpr.edu.br/editais',
    traducaoIFizinha: {
      oQueE: 'É uma oportunidade de receber R$400 por mês para participar de projetos de extensão do campus! A extensão é quando o IFPR leva conhecimento para a comunidade e você faz parte disso, aprendendo na prática.',
      quemPode: 'Estudantes regularmente matriculados em qualquer curso do IFPR Campus Ivaiporã, com pelo menos 1 semestre concluído e sem reprovações no semestre anterior.',
      comoParticipar: 'Você precisa: 1) Escolher um projeto de extensão ativo; 2) Entrar em contato com o coordenador; 3) Se inscrever pelo SUAP dentro do prazo.',
      quando: 'Inscrições abertas até 31 de agosto de 2025. Resultado em setembro. Início das atividades em outubro.',
      documentos: [
        'RG e CPF',
        'Histórico escolar atualizado (emitir no SUAP)',
        'Comprovante de matrícula',
        'Carta de interesse (você escreve explicando por que quer participar)',
      ],
      mensagemIfizinha: 'Ei, essa é uma chance incrível de ganhar uma bolsa E aprender coisas que nenhuma sala de aula ensina! Participar de projetos de extensão enriquece seu currículo e sua vida. Mas lembre-se: confira sempre o edital oficial para não perder nenhum detalhe, tá? ✨',
    },
  },
  'pibic-iniciacao-cientifica-2025': {
    id: '3',
    titulo: 'Edital PIBIC 02/2025 – Programa Institucional de Bolsas de Iniciação Científica',
    slug: 'pibic-iniciacao-cientifica-2025',
    categoria: 'PESQUISA',
    resumo: 'Bolsas de R$700/mês para iniciação científica.',
    dataEncerramento: new Date('2025-09-15'),
    status: 'ATIVO',
    visualizacoes: 156,
    linkOficial: 'https://reitoria.ifpr.edu.br/editais',
    traducaoIFizinha: {
      oQueE: 'É um programa pra você participar de pesquisas científicas de verdade, com um professor orientando você! Você recebe R$700 por mês pra aprender a fazer ciência — e ainda sai com experiência de pesquisa no currículo.',
      quemPode: 'Estudantes de ensino médio integrado ou graduação com bom desempenho acadêmico (média acima de 7,0) e disponibilidade de 20 horas semanais para dedicar à pesquisa.',
      comoParticipar: 'Procure um professor que tenha projeto de pesquisa aprovado no PIBIC. Combine a parceria com ele e se inscreva com o plano de trabalho pelo SUAP dentro do prazo.',
      quando: 'Inscrições até 15 de setembro de 2025. Início das atividades em outubro. Duração: 12 meses.',
      documentos: [
        'Histórico escolar atualizado',
        'Documento de identidade',
        'Plano de trabalho (o professor orientador ajuda a elaborar)',
        'Declaração de disponibilidade (20h/semana)',
        'Currículo Lattes (pode criar de graça no cnpq.br)',
      ],
      mensagemIfizinha: 'Participar de pesquisa científica é um diferencial ENORME no seu currículo — pra quem quer entrar na universidade e pra quem quer o mercado de trabalho! Não perca essa oportunidade. Mas atenção: sempre leia o edital completo no site oficial! 🔬',
    },
  },
  'selecao-projetos-extensao-2025': {
    id: '4',
    titulo: 'Seleção de Projetos de Extensão 2025/2026',
    slug: 'selecao-projetos-extensao-2025',
    categoria: 'EXTENSAO',
    resumo: 'Chamada para submissão de propostas de projetos de extensão.',
    dataEncerramento: new Date('2025-10-30'),
    status: 'ATIVO',
    visualizacoes: 89,
    linkOficial: 'https://reitoria.ifpr.edu.br/editais',
    traducaoIFizinha: {
      oQueE: 'É uma chamada para professores e estudantes proporem projetos que beneficiem a comunidade! Se o projeto for aprovado, pode receber até R$5.000 para execução e contar com bolsistas.',
      quemPode: 'Docentes do IFPR podem submeter propostas como coordenadores. Estudantes participam como bolsistas ou voluntários nos projetos aprovados. Projetos devem ter impacto na comunidade externa.',
      comoParticipar: 'Se você é estudante: converse com um professor sobre uma ideia de projeto para a comunidade. Se você é professor: submeta a proposta via SUAP seguindo o modelo disponível no edital.',
      quando: 'Submissão de propostas até 30 de outubro de 2025. Avaliação em novembro. Execução a partir de 2026.',
      documentos: [
        'Formulário de proposta (disponível no edital oficial)',
        'Currículo Lattes do coordenador',
        'Plano de trabalho detalhado',
        'Declaração de contrapartida institucional',
        'Comprovante de vínculo com a instituição parceira (se houver)',
      ],
      mensagemIfizinha: 'Quer ajudar a comunidade e ainda aprender habilidades incríveis? Essa é a chance de criar algo que realmente impacta vidas! Fala com um professor e vira parte de algo maior. Confira o edital completo para todos os critérios e pontuação! 🌟',
    },
  },
};

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const edital = editaisData[params.slug];
  if (!edital) return { title: 'Edital não encontrado' };
  return {
    title: edital.titulo,
    description: edital.resumo,
  };
}

const secaoConfig = [
  { key: 'oQueE' as const, icon: BookOpen, titulo: 'O que é?', cor: 'text-azul-eletrico', bg: 'bg-azul-eletrico/10' },
  { key: 'quemPode' as const, icon: Users, titulo: 'Quem pode participar?', cor: 'text-roxo-luminoso', bg: 'bg-roxo-luminoso/10' },
  { key: 'comoParticipar' as const, icon: CheckCircle2, titulo: 'Como participar?', cor: 'text-green-600', bg: 'bg-green-100' },
  { key: 'quando' as const, icon: Calendar, titulo: 'Quando?', cor: 'text-orange-600', bg: 'bg-orange-100' },
];

export default function EditalPage({ params }: { params: Params }) {
  const edital = editaisData[params.slug];

  if (!edital) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Edital não encontrado</h1>
          <p className="text-gray-500 mb-6">Este edital pode ter sido removido ou o link está incorreto.</p>
          <Link href="/editais">
            <Button>Ver todos os editais</Button>
          </Link>
        </div>
      </div>
    );
  }

  const traducao = edital.traducaoIFizinha;
  const daysLeft = getDaysUntil(edital.dataEncerramento);
  const isUrgent = daysLeft <= 7 && daysLeft > 0;
  const isExpired = daysLeft <= 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`pt-20 pb-10 ${isUrgent ? 'bg-gradient-to-br from-orange-600 via-red-600 to-orange-700' : 'bg-hero-gradient'}`}>
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-white/70 text-sm mb-6">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/editais" className="hover:text-white transition-colors">Editais</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white truncate max-w-48">{edital.titulo}</span>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${getCategoryColor(edital.categoria)}`}>
              {getStatusLabel(edital.categoria)}
            </span>
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(edital.status)}`}>
              {getStatusLabel(edital.status)}
            </span>
            {isUrgent && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-white text-red-600">
                <AlertCircle className="w-4 h-4" />
                {daysLeft === 1 ? 'Último dia!' : `Encerra em ${daysLeft} dias!`}
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-white mb-4 leading-tight">
            {edital.titulo}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-white/70 text-sm">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Encerra: <strong className={`ml-1 ${isUrgent ? 'text-white' : 'text-white/90'}`}>{formatDate(edital.dataEncerramento)}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {edital.visualizacoes} visualizações
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container mx-auto px-4 max-w-5xl py-8">
        <Link href="/editais" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Voltar aos editais
        </Link>

        <Tabs defaultValue="ifizinha" className="w-full">
          <TabsList className="w-full sm:w-auto mb-6 grid grid-cols-2 sm:inline-flex h-auto p-1 gap-1">
            <TabsTrigger value="ifizinha" className="flex items-center gap-2 py-3 px-4 text-sm">
              <span>✨</span>
              <span className="hidden sm:inline">Versão</span> IFizinha
            </TabsTrigger>
            <TabsTrigger value="original" className="flex items-center gap-2 py-3 px-4 text-sm">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Edital</span> Original
            </TabsTrigger>
          </TabsList>

          {/* === ABA IFIZINHA === */}
          <TabsContent value="ifizinha">
            {/* Mensagem IFizinha */}
            <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-dourado-ifizinha rounded-2xl flex items-center justify-center text-xl flex-shrink-0">✨</div>
                <div>
                  <p className="font-bold text-gray-900 mb-1">IFizinha explica</p>
                  <p className="text-gray-700 leading-relaxed">{traducao.mensagemIfizinha}</p>
                </div>
              </div>
            </div>

            {/* Seções traduzidas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {secaoConfig.map(({ key, icon: Icon, titulo, cor, bg }) => (
                <div key={key} className="bg-white rounded-2xl border border-gray-100 p-6 hover:border-gray-200 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${cor}`} />
                    </div>
                    <h2 className={`font-bold text-base ${cor}`}>{titulo}</h2>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {traducao[key]}
                  </p>
                </div>
              ))}
            </div>

            {/* Documentos */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-ciano-claro/10 rounded-xl flex items-center justify-center">
                  <File className="w-5 h-5 text-ciano-claro" />
                </div>
                <h2 className="font-bold text-base text-ciano-claro">Documentos Necessários</h2>
              </div>
              <ul className="space-y-2">
                {traducao.documentos.map((doc, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {doc}
                  </li>
                ))}
              </ul>
            </div>

            {/* Disclaimer + CTA */}
            <div className="bg-yellow-50 rounded-2xl border border-yellow-200 p-5 flex items-start gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-800 text-sm mb-1">Lembrete importante da IFizinha</p>
                <p className="text-yellow-700 text-sm leading-relaxed">
                  Esta é uma versão simplificada para facilitar sua compreensão.
                  <strong> Sempre confira o edital oficial</strong> para verificar todos os critérios, datas e informações completas antes de se inscrever.
                </p>
              </div>
            </div>

            <a
              href={edital.linkOficial}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-hero-gradient text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-all shadow-md"
            >
              <ExternalLink className="w-5 h-5" />
              Acessar Edital Oficial
            </a>
          </TabsContent>

          {/* === ABA ORIGINAL === */}
          <TabsContent value="original">
            <div className="bg-white rounded-2xl border border-gray-100 p-8">
              <div className="text-center py-8">
                <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Edital Original Completo</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-6">
                  Para acessar o documento oficial completo, clique no botão abaixo.
                  O edital contém todos os critérios, prazos e informações detalhadas.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a
                    href={edital.linkOficial}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-azul-eletrico text-white font-semibold px-6 py-3 rounded-xl hover:bg-azul-eletrico/90 transition-all"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Acessar no Site do IFPR
                  </a>
                  <button className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-600 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition-all">
                    <File className="w-5 h-5" />
                    Baixar PDF (em breve)
                  </button>
                </div>

                <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100 text-left max-w-md mx-auto">
                  <p className="text-blue-700 text-sm flex items-start gap-2">
                    <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-dourado-ifizinha" />
                    Lembre-se: a aba <strong>Versão IFizinha</strong> já traz um resumo completo com linguagem simples. Use ela como guia e o edital oficial para confirmar!
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
