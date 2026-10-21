import React from 'react';
import Link from 'next/link';
import { Calendar, ArrowRight, Newspaper } from 'lucide-react';
import { PostCapa } from '@/components/ui/PostCapa';

export type PostDaHome = {
  id: string;
  titulo: string;
  slug: string;
  resumo: string | null;
  createdAt: Date;
  imagemUrl: string | null;
  icone: string | null;
  projeto: { nome: string; slug: string };
};

/**
 * "O que os projetos andam publicando" — as notícias mais recentes.
 *
 * Fonte única de visibilidade: `POST_BUSCA_WHERE` (status PUBLICADO **e** projeto
 * pai publicado/sem soft delete). É a mesma régua da busca global e da página do
 * post, então nenhum rascunho nem post de projeto despublicado aparece aqui.
 *
 * A capa é o mesmo componente da página do projeto (`PostCapa`): imagem enviada
 * > ícone escolhido > ícone padrão, nunca um retângulo vazio.
 */
export function UltimasDosProjetos({ posts }: { posts: PostDaHome[] }) {
  return (
    <section className="relative z-10 bg-gray-100 py-16">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-6 w-1 rounded-full bg-hero-gradient" />
              <p className="text-sm font-semibold uppercase tracking-wider text-ciano-700">
                Notícias
              </p>
            </div>
            <h2 className="text-3xl font-black text-gray-900">
              O que os projetos andam publicando
            </h2>
            <p className="mt-1 text-gray-500">
              Atualizações, resultados e novidades direto de quem faz acontecer no campus
            </p>
          </div>
          <Link
            href="/projetos"
            className="hidden items-center gap-1.5 text-sm font-semibold text-azul-eletrico transition-all hover:gap-3 md:flex"
          >
            Ver todos os projetos
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {posts.length === 0 ? (
          /* Nenhum post publicado (é o estado atual de produção): em vez de
             esconder a seção inteira — o que faria parecer que ela não existe —
             explicamos e mandamos para os projetos. */
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-12 text-center">
            <Newspaper className="h-8 w-8 text-gray-300" />
            <p className="font-semibold text-gray-700">
              Os projetos ainda não publicaram novidades por aqui
            </p>
            <p className="max-w-md text-sm text-gray-500">
              Assim que um coordenador publicar uma atualização em um projeto, ela aparece nesta
              seção. Enquanto isso, dá uma olhada nos projetos do campus.
            </p>
            <Link
              href="/projetos"
              className="mt-1 inline-flex items-center gap-2 rounded-xl bg-azul-eletrico px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-azul-600"
            >
              Ver os projetos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/projetos/${post.projeto.slug}/posts/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-gray-200 hover:shadow-xl"
              >
                <PostCapa post={post} tamanho="hero" />

                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-azul-eletrico/10 px-2.5 py-1 text-xs font-semibold text-azul-eletrico">
                      {post.projeto.nome}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(post.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <h3 className="mb-2 flex-1 text-base font-bold leading-snug text-gray-900 transition-colors group-hover:text-azul-eletrico">
                    {post.titulo}
                  </h3>

                  {post.resumo && (
                    <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-gray-500">
                      {post.resumo}
                    </p>
                  )}

                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-azul-eletrico">
                    Ler notícia
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 text-center md:hidden">
          <Link
            href="/projetos"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700"
          >
            <Newspaper className="h-4 w-4" />
            Ver todos os projetos
          </Link>
        </div>
      </div>
    </section>
  );
}
