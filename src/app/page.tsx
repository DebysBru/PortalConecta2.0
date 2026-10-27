import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles, ChevronRight, Clock, ArrowRight, Star, Zap, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatDateShort, getDaysUntil, getStatusLabel, getStatusColor, getCategoryColor,
} from '@/lib/utils';
import { HeroIFizinha } from '@/components/sections/HeroIFizinha';
import { ProjetosGrid } from '@/components/sections/ProjetosGrid';
import { UltimasDosProjetos } from '@/components/sections/UltimasDosProjetos';
import { PergunteIFizinha } from '@/components/sections/PergunteIFizinha';
import { MascoteIFizinha } from '@/components/ifizinha/MascoteIFizinha';
import { MascoteInterativa } from '@/components/ifizinha/MascoteInterativa';
import { getDashboardStatsAction } from '@/actions/auth';
import { getAllSiteConfigAction } from '@/actions/site-config';
import { POST_BUSCA_WHERE } from '@/lib/busca';
import { db } from '@/lib/prisma';
import { garantirStatusEditaisAtualizado } from '@/lib/editais-status';

export const dynamic = 'force-dynamic';

/**
 * Home do portal — visual do mockup do redesign
 * (DOCUMENTACAO/REDESIGN_IFIZINHA.md): capa clara com a foto do campus e a
 * IFizinha, atalhos com os ícones 3D, editais, projetos, agenda, notícias dos
 * projetos e o bloco "Pergunte pra IFizinha".
 *
 * Regra das mascotes: as de meio corpo ficam ancoradas na borda + no fim da
 * seção (`-mb-*` com `-mr-*`/`-ml-*`), para parecer que saem de dentro da faixa
 * em vez de flutuarem soltas no meio do vazio. As que têm fundo sólido
 * (#F7F7F7) só entram em seções com esse mesmo fundo — ver o campo `fundo` em
 * MascoteIFizinha e a §4.2 de DOCUMENTACAO/REDESIGN_IFIZINHA.md.
 */
export default async function HomePage() {
  // Status dos editais do SUAP acompanha as datas (ver src/lib/editais-status.ts).
  await garantirStatusEditaisAtualizado();
  const [stats, siteConfig, editaisDestaque, proximosEventos, noticias] = await Promise.all([
    getDashboardStatsAction(),
    getAllSiteConfigAction(),
    db.edital.findMany({
      where: {
        review_status: 'PUBLICADO',
        deleted_at: null,
        status: { in: ['ABERTO', 'EM_ANALISE'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    }),
    db.evento.findMany({
      where: { data: { gte: new Date() } },
      orderBy: { data: 'asc' },
      take: 4,
    }),
    // Mesma régua de visibilidade da busca global e da página do post.
    db.post.findMany({
      where: POST_BUSCA_WHERE,
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        titulo: true,
        slug: true,
        resumo: true,
        createdAt: true,
        imagemUrl: true,
        icone: true,
        projeto: { select: { nome: true, slug: true } },
      },
    }),
  ]);

  // Atalhos de "O que você procura?": o número vem do banco, mas o responsável
  // pode fixar um valor pelo painel (stat_editais/stat_projetos) — era o que os
  // cards de estatística que existiam aqui usavam.
  const atalhos = [
    {
      href: '/editais',
      titulo: 'Editais e Bolsas',
      descricao: 'Oportunidades para estudar, pesquisar e fazer mais no IF.',
      icone: '/ifizinha/icone-editais.webp',
      fundo: 'bg-azul-50',
      cor: 'text-azul-eletrico',
      contagem: siteConfig.stat_editais || String(stats.editaisAtivos),
      rotulo: stats.editaisAtivos === 1 ? 'edital ativo' : 'editais ativos',
    },
    {
      href: '/agenda',
      titulo: 'Datas importantes',
      descricao: 'Não perca prazos, eventos e momentos importantes.',
      icone: '/ifizinha/icone-agenda.webp',
      fundo: 'bg-rosa-50',
      cor: 'text-rosa-700',
      contagem: String(stats.eventos),
      rotulo: stats.eventos === 1 ? 'evento próximo' : 'eventos próximos',
    },
    {
      href: '/projetos',
      titulo: 'Projetos',
      descricao: 'Conheça os projetos do campus e como participar.',
      icone: '/ifizinha/icone-projetos.webp',
      fundo: 'bg-ciano-50',
      cor: 'text-ciano-700',
      contagem: siteConfig.stat_projetos || String(stats.projetos),
      rotulo: 'projetos',
    },
    {
      href: '/minha-area',
      titulo: 'Minha área',
      descricao: 'Favoritos, notificações, inscrições e seus dados.',
      icone: '/ifizinha/icone-pessoas.webp',
      fundo: 'bg-roxo-50',
      cor: 'text-roxo-luminoso',
      contagem: null,
      rotulo: null,
    },
  ];

  const tipoEventoConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    PRAZO_EDITAL: { label: 'Prazo', color: 'bg-red-100 text-red-700', icon: <AlertCircle className="w-3 h-3" /> },
    EVENTO_CAMPUS: { label: 'Campus', color: 'bg-blue-100 text-blue-700', icon: <Star className="w-3 h-3" /> },
    EVENTO_PROJETO: { label: 'Projeto', color: 'bg-purple-100 text-purple-700', icon: <Zap className="w-3 h-3" /> },
  };

  return (
    <div className="flex flex-col">
      <HeroIFizinha config={siteConfig} />

      {/* === O QUE VOCÊ PROCURA? === */}
      {/* Faixa cinza: além do ritmo de bandas, é ela que cobre a sobra da mascote
          da capa (ver a regra de ancoragem em MascoteIFizinha). */}
      <section className="relative z-10 overflow-hidden bg-gray-100 py-16">
        <div className="container relative mx-auto max-w-7xl px-4">
          {/* Mascote apontando para os cards: fica ao lado do título e a grade
              ganha recuo à esquerda para ela não cobrir o primeiro card. */}
          <div className="pointer-events-none absolute left-0 top-8 hidden w-[200px] xl:block">
            <div className="-ml-16">
              <MascoteIFizinha nome="apontando" />
            </div>
          </div>

          <div className="mb-10 xl:pl-[190px]">
            <h2 className="text-3xl font-black text-gray-900 md:text-4xl">
              O que você <span className="text-azul-eletrico">procura</span>?
            </h2>
            <p className="mt-1 text-gray-500">
              Acesse rapidamente as principais áreas do Portal Conecta.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:pl-[190px]">
            {atalhos.map((atalho) => (
              <Link
                key={atalho.titulo}
                href={atalho.href}
                className={`group flex flex-col rounded-3xl border border-gray-100 ${atalho.fundo} p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gray-200 hover:shadow-xl`}
              >
                <Image
                  src={atalho.icone}
                  alt=""
                  width={192}
                  height={192}
                  unoptimized
                  className="mb-4 h-14 w-14 drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
                />
                <h3 className="mb-1.5 text-lg font-bold text-gray-900">{atalho.titulo}</h3>
                <p className="mb-4 flex-1 text-sm leading-relaxed text-gray-600">{atalho.descricao}</p>

                <div className="flex items-center justify-between">
                  {atalho.contagem ? (
                    <span className={`text-xs font-bold ${atalho.cor}`}>
                      {atalho.contagem} {atalho.rotulo}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/80 ${atalho.cor} shadow-sm transition-transform duration-300 group-hover:translate-x-0.5`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* === EDITAIS EM DESTAQUE === */}
      <section className="relative overflow-x-clip bg-white py-16">
        <div className="container relative mx-auto max-w-7xl px-4">
          {/* Mascote à ESQUERDA: é a pose da prancheta com joinha. Ela fica de
              perfil olhando para a direita, então do lado esquerdo ela olha (e
              aponta o joinha) para os cards — do lado direito ela olhava para
              fora da tela. Fundo branco porque o fundo do arquivo é #FEFEFE.
              `-mb-24` deixa a imagem atravessar a divisão: a faixa cinza da
              seção seguinte (que tem z-10) cobre a sobra, então ela sempre
              termina exatamente na divisão, sem parecer cortada. O valor conta
              com o `py-16` da seção, porque o `bottom-0` é relativo ao container
              — que termina 64px antes do fim da seção. */}
          <div className="pointer-events-none absolute bottom-0 left-0 hidden w-[230px] xl:block">
            <div className="-ml-12 -mb-24">
              <MascoteIFizinha nome="editais-recorte" />
            </div>
          </div>

          <div className="mb-10 flex items-end justify-between gap-6 xl:pl-[210px]">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="h-6 w-1 rounded-full bg-hero-gradient" />
                <p className="text-sm font-semibold uppercase tracking-wider text-azul-eletrico">
                  Oportunidades
                </p>
              </div>
              <h2 className="text-3xl font-black text-gray-900 md:text-4xl">
                Traduzindo o <span className="text-roxo-luminoso">burocratês</span>
              </h2>
              <p className="mt-1 text-gray-500">
                Editais em destaque, explicados de um jeito simples pela IFizinha
              </p>
            </div>
            <Link
              href="/editais"
              className="hidden items-center gap-1.5 text-sm font-semibold text-azul-eletrico transition-all hover:gap-3 md:flex"
            >
              Ver todos os editais
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 xl:pl-[210px]">
            {/* Sem edital publicado (o portal pode estar começando), a seção não
                pode ficar com a grade vazia: entra o estado vazio com a IFizinha,
                no mesmo padrão das outras telas. */}
            {editaisDestaque.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center md:col-span-3">
                <div className="mx-auto mb-4 w-[130px]">
                  <MascoteInterativa nome="chat" />
                </div>
                <p className="font-semibold text-gray-700">Nenhum edital publicado ainda</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                  Quando a equipe publicar, a IFizinha traduz cada edital em poucas linhas aqui.
                  Enquanto isso, dá uma olhada nos projetos e na agenda do campus.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/projetos"
                    className="rounded-xl bg-azul-eletrico px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-azul-eletrico/90"
                  >
                    Ver projetos
                  </Link>
                  <Link
                    href="/agenda"
                    className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
                  >
                    Ver agenda
                  </Link>
                </div>
              </div>
            )}
            {editaisDestaque.map((edital) => {
              const daysLeft = edital.dataEncerramento ? getDaysUntil(edital.dataEncerramento) : null;
              const isUrgent = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;

              return (
                <Link key={edital.id} href={`/editais/${edital.slug}`} className="group block">
                  <div
                    className={`flex h-full flex-col rounded-2xl border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                      isUrgent ? 'border-orange-200 ring-2 ring-orange-100' : 'border-gray-100 hover:border-azul-eletrico/30'
                    }`}
                  >
                    {isUrgent && (
                      <div className="mb-3 flex w-fit items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Encerra em {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}!
                      </div>
                    )}

                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {edital.categoria && (
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getCategoryColor(edital.categoria)}`}>
                            {edital.categoria}
                          </span>
                        )}
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusColor(edital.status)}`}>
                          {getStatusLabel(edital.status)}
                        </span>
                      </div>
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-azul-eletrico/10 transition-colors group-hover:bg-azul-eletrico">
                        <ChevronRight className="w-4 h-4 text-azul-eletrico group-hover:text-white" />
                      </div>
                    </div>

                    <h3 className="mb-3 flex-1 text-base font-bold leading-snug text-gray-900 transition-colors group-hover:text-azul-eletrico">
                      {edital.titulo}
                    </h3>

                    <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-gray-500">
                      {edital.resumoSimples || edital.resumo || 'Sem descrição disponível'}
                    </p>

                    {edital.dataEncerramento && (
                      <div className="mt-auto flex items-center gap-1.5 border-t border-gray-50 pt-3 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        Encerra: {formatDateShort(edital.dataEncerramento, { timeZone: 'UTC' })}
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-azul-eletrico">
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
      <section className="relative z-10 overflow-x-clip bg-white py-16">
        <div className="container relative mx-auto max-w-7xl px-4">
          {/* Mascote à direita: a pose "relogio" aponta o relógio e olha para a
              esquerda (para o conteúdo). A seção seguinte (faixa cinza) cobre a
              sobra do `-mb-10`, então ela termina na divisão. */}
          <div className="pointer-events-none absolute bottom-0 right-0 hidden w-[210px] xl:block">
            <div className="-mr-6 -mb-24">
              <MascoteIFizinha nome="relogio" />
            </div>
          </div>

          <div className="mb-10 flex items-end justify-between gap-6 xl:pr-[190px]">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="h-6 w-1 rounded-full bg-hero-gradient" />
                <p className="text-sm font-semibold uppercase tracking-wider text-rosa-600">
                  Agenda
                </p>
              </div>
              <h2 className="text-3xl font-black text-gray-900 md:text-4xl">
                Não deixa <span className="text-rosa-vibrante">passar</span>
              </h2>
              <p className="mt-1 text-gray-500">
                Fique por dentro dos próximos eventos, prazos e atividades do campus
              </p>
            </div>
            <Link
              href="/agenda"
              className="hidden items-center gap-1.5 text-sm font-semibold text-rosa-600 transition-all hover:gap-3 md:flex"
            >
              Ver agenda completa
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:pr-[210px]">
            {proximosEventos.map((evento) => {
              const config = tipoEventoConfig[evento.tipo as string] ?? {
                label: evento.tipo,
                color: 'bg-gray-100 text-gray-700',
                icon: null,
              };
              const daysLeft = getDaysUntil(evento.data);

              return (
                <div
                  key={evento.id}
                  className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-gray-200 hover:shadow-sm"
                >
                  <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-xl border border-gray-100 bg-gray-50">
                    <p className="text-xl font-black leading-none text-gray-900">
                      {evento.data.getDate().toString().padStart(2, '0')}
                    </p>
                    <p className="text-xs font-medium uppercase text-gray-500">
                      {evento.data.toLocaleString('pt-BR', { month: 'short' })}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold leading-snug text-gray-900">
                      {evento.titulo}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
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
                      <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
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

      {/* === NOTÍCIAS DOS PROJETOS === */}
      <UltimasDosProjetos posts={noticias} />

      {/* === PERGUNTE PRA IFIZINHA === */}
      <PergunteIFizinha config={siteConfig} />
    </div>
  );
}
