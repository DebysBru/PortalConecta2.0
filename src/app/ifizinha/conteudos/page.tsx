import React from 'react';
import Link from 'next/link';
import { BookMarked, ExternalLink, FileText, Layers, Search, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHero } from '@/components/layout/PageHero';
import {
  listarDocumentosDoIndice,
  obterResumoDoIndice,
} from '@/lib/indice-conteudos';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Conteúdos que a IFizinha conhece',
  description:
    'Índice completo dos documentos oficiais do IFPR Campus Ivaiporã que a IFizinha usa para responder — com link para a fonte de cada informação.',
};

const POR_PAGINA = 40;

interface Props {
  searchParams?: { categoria?: string; q?: string; pagina?: string };
}

function hrefDaPagina(pagina: number, categoria?: string, busca?: string): string {
  const parametros = new URLSearchParams();
  if (categoria) parametros.set('categoria', categoria);
  if (busca) parametros.set('q', busca);
  if (pagina > 1) parametros.set('pagina', String(pagina));
  const query = parametros.toString();
  return `/ifizinha/conteudos${query ? `?${query}` : ''}`;
}

export default async function ConteudosDaIfizinhaPage({ searchParams }: Props) {
  const categoria = searchParams?.categoria?.trim() || null;
  const busca = searchParams?.q?.trim() || null;
  const pagina = Number(searchParams?.pagina ?? '1') || 1;

  const [resumo, listagem] = await Promise.all([
    obterResumoDoIndice(),
    listarDocumentosDoIndice({ categoria, busca, pagina, porPagina: POR_PAGINA }),
  ]);

  const atualizadoEm = resumo.atualizadoEm
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(resumo.atualizadoEm)
    : null;

  return (
    <div className="min-h-screen">
      <PageHero
        trilha={[{ href: '/', label: 'Início' }, { label: 'Conteúdos da IFizinha' }]}
        etiqueta="Transparência"
        titulo="O que a IFizinha conhece"
        descricao="Tudo o que a assistente aprendeu do site oficial do IFPR Campus Ivaiporã. Cada resposta dela cita o documento e mostra o link para você conferir na fonte."
        icone={<BookMarked className="h-7 w-7 text-azul-eletrico" />}
        fundoIcone="bg-azul-50"
        mascote={{ nome: 'hero', dica: 'Eu não invento nada: se não está aqui, eu falo que não achei!' }}
      >
        <div className="mt-6 flex max-w-2xl items-start gap-3 rounded-2xl border border-purple-100 bg-gradient-to-br from-blue-50 to-purple-50 p-4">
          <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-roxo-luminoso" />
          <div>
            <p className="mb-0.5 text-sm font-semibold text-gray-900">Como eu uso esses documentos</p>
            <p className="text-sm leading-relaxed text-gray-600">
              Eu procuro os trechos mais parecidos com a sua pergunta, respondo com base neles e
              mostro o link de cada fonte no fim da resposta. Se a informação não estiver aqui, eu
              digo que não encontrei — em vez de inventar.
            </p>
          </div>
        </div>
      </PageHero>

      <div className="relative z-10 bg-gray-50">
        <div className="container mx-auto max-w-7xl px-4 py-10">
          {!resumo.temConteudo ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
              <p className="mb-1 font-semibold">A base de conhecimento ainda está vazia.</p>
              <p>
                Nenhum documento do site institucional foi importado neste ambiente. Rode{' '}
                <code className="rounded bg-amber-100 px-1">npm run rag:importar</code> para
                carregar o conteúdo.
              </p>
            </div>
          ) : (
            <>
              {/* Números gerais */}
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-gray-500">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Documentos</span>
                  </div>
                  <p className="text-3xl font-black text-gray-900">
                    {resumo.totalDocumentos.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-500">páginas, editais e PDFs oficiais</p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-gray-500">
                    <Layers className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Trechos indexados</span>
                  </div>
                  <p className="text-3xl font-black text-gray-900">
                    {resumo.totalTrechos.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-500">pedaços de texto usados na busca</p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-gray-500">
                    <BookMarked className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Categorias</span>
                  </div>
                  <p className="text-3xl font-black text-gray-900">
                    {resumo.categorias.length.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {atualizadoEm ? `atualizado em ${atualizadoEm}` : 'tipos de conteúdo'}
                  </p>
                </div>
              </div>

              {/* Categorias */}
              <div className="mb-6 flex flex-wrap gap-2">
                <Link
                  href={hrefDaPagina(1, undefined, busca ?? undefined)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    !categoria
                      ? 'bg-azul-eletrico text-white'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-azul-eletrico/40 hover:text-azul-eletrico'
                  }`}
                >
                  Tudo ({resumo.totalDocumentos.toLocaleString('pt-BR')})
                </Link>
                {resumo.categorias.map((item) => (
                  <Link
                    key={item.chave}
                    href={hrefDaPagina(1, item.chave, busca ?? undefined)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      categoria === item.chave
                        ? 'bg-azul-eletrico text-white'
                        : 'border border-gray-200 bg-white text-gray-600 hover:border-azul-eletrico/40 hover:text-azul-eletrico'
                    }`}
                  >
                    {item.rotulo} ({item.documentos.toLocaleString('pt-BR')})
                  </Link>
                ))}
              </div>

              {/* Busca por título */}
              <form action="/ifizinha/conteudos" method="get" className="mb-6">
                {categoria && <input type="hidden" name="categoria" value={categoria} />}
                <div className="flex max-w-xl items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      name="q"
                      defaultValue={busca ?? ''}
                      placeholder="Buscar no título do documento..."
                      className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-azul-eletrico"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-azul-eletrico px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-azul-eletrico/90"
                  >
                    Buscar
                  </button>
                </div>
              </form>

              <p className="mb-3 text-sm text-gray-500">
                {listagem.total.toLocaleString('pt-BR')} documento(s)
                {categoria ? ` em “${resumo.categorias.find((c) => c.chave === categoria)?.rotulo ?? categoria}”` : ''}
                {busca ? ` com “${busca}” no título` : ''}
              </p>

              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {listagem.documentos.map((documento) => (
                  <li
                    key={documento.id}
                    className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-azul-50 text-azul-eletrico">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {documento.url ? (
                        <a
                          href={documento.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-start gap-1 text-sm font-semibold leading-snug text-gray-900 hover:text-azul-eletrico"
                        >
                          <span className="line-clamp-2">{documento.titulo}</span>
                          <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0 opacity-40 group-hover:opacity-100" />
                        </a>
                      ) : (
                        <p className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
                          {documento.titulo}
                        </p>
                      )}
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                          {documento.rotuloCategoria}
                        </span>
                        {documento.data && <span>atualizado em {documento.data}</span>}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {listagem.documentos.length === 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
                  Nenhum documento encontrado com esse filtro. Tente outra palavra ou remova a categoria.
                </div>
              )}

              {/* Paginação */}
              {listagem.totalPaginas > 1 && (
                <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Paginação">
                  {listagem.pagina > 1 && (
                    <Link
                      href={hrefDaPagina(listagem.pagina - 1, categoria ?? undefined, busca ?? undefined)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-azul-eletrico/40 hover:text-azul-eletrico"
                    >
                      Anterior
                    </Link>
                  )}
                  <span className="px-2 text-sm text-gray-500">
                    Página {listagem.pagina} de {listagem.totalPaginas}
                  </span>
                  {listagem.pagina < listagem.totalPaginas && (
                    <Link
                      href={hrefDaPagina(listagem.pagina + 1, categoria ?? undefined, busca ?? undefined)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-azul-eletrico/40 hover:text-azul-eletrico"
                    >
                      Próxima
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
