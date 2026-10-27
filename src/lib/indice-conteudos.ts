/**
 * ==============================================================================
 * ÍNDICE DE CONTEÚDOS DA IFIZINHA
 * ==============================================================================
 *
 * "O que a IA sabe?" precisa ter uma resposta verificável. Este módulo lê a
 * base de conhecimento (`documentos_kb`/`chunks_kb`) e monta:
 *
 *   - o resumo por categoria (quantos documentos e trechos de cada tipo);
 *   - a lista paginada de documentos, cada um com o link da origem oficial.
 *
 * A página /ifizinha/conteudos usa isso, e o mesmo resumo alimenta o documento
 * de índice que a própria IFizinha consulta quando alguém pergunta sobre o que
 * ela conhece (gerado por prisma/importar-markdown-ifpr.ts).
 */

import { prisma } from '@/lib/prisma';
import { rotuloCategoria } from '@/lib/fontes-resposta';

/** Só documentos vindos do site institucional entram no índice público. */
const TIPO_DOCUMENTO_SITE = 'site_ifpr';

export interface CategoriaDoIndice {
  /** Chave técnica usada nos filtros: edital, curso, ppc... */
  chave: string;
  /** Rótulo humano: "Edital", "Curso", "Projeto Pedagógico de Curso"... */
  rotulo: string;
  documentos: number;
}

export interface DocumentoDoIndice {
  id: string;
  titulo: string;
  categoria: string;
  rotuloCategoria: string;
  url: string | null;
  data: string | null;
}

export interface ResumoDoIndice {
  totalDocumentos: number;
  totalTrechos: number;
  categorias: CategoriaDoIndice[];
  atualizadoEm: Date | null;
  temConteudo: boolean;
}

function comoTexto(valor: unknown): string | null {
  if (typeof valor === 'string' && valor.trim()) return valor.trim();
  return null;
}

function dataLegivel(valor: string | null): string | null {
  if (!valor) return null;
  const data = new Date(valor.length === 10 ? `${valor}T12:00:00Z` : valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(data);
}

/** Resumo da base: totais e distribuição por categoria. */
export async function obterResumoDoIndice(): Promise<ResumoDoIndice> {
  const [totalDocumentos, totalTrechos, ultimo] = await Promise.all([
    prisma.documentoKb.count({ where: { ativo: true, tipo: TIPO_DOCUMENTO_SITE } }),
    prisma.chunkKb.count({ where: { ativo: true, documento: { ativo: true, tipo: TIPO_DOCUMENTO_SITE } } }),
    prisma.documentoKb.findFirst({
      where: { ativo: true, tipo: TIPO_DOCUMENTO_SITE },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
  ]);

  if (totalDocumentos === 0) {
    return { totalDocumentos: 0, totalTrechos: 0, categorias: [], atualizadoEm: null, temConteudo: false };
  }

  const linhas = await prisma.$queryRawUnsafe<Array<{ categoria: string | null; documentos: number }>>(
    `
    SELECT (d."metadata"->>'categoria') AS categoria, count(*)::int AS documentos
    FROM "documentos_kb" d
    WHERE d."ativo" = true AND d."tipo" = $1
    GROUP BY 1
    ORDER BY documentos DESC
    `,
    TIPO_DOCUMENTO_SITE
  );

  return {
    totalDocumentos,
    totalTrechos,
    categorias: linhas.map((linha) => ({
      chave: linha.categoria ?? 'outros',
      rotulo: rotuloCategoria(linha.categoria),
      documentos: linha.documentos,
    })),
    atualizadoEm: ultimo?.updatedAt ?? null,
    temConteudo: true,
  };
}

export interface OpcoesListagem {
  categoria?: string | null;
  busca?: string | null;
  pagina?: number;
  porPagina?: number;
}

export interface ListagemDoIndice {
  documentos: DocumentoDoIndice[];
  total: number;
  totalPaginas: number;
  pagina: number;
}

/** Lista paginada, com filtro por categoria e busca por título. */
export async function listarDocumentosDoIndice(
  opcoes: OpcoesListagem = {}
): Promise<ListagemDoIndice> {
  const porPagina = Math.min(Math.max(opcoes.porPagina ?? 40, 1), 100);
  const pagina = Math.max(opcoes.pagina ?? 1, 1);
  const busca = opcoes.busca?.trim() ?? '';

  const where: Record<string, unknown> = { ativo: true, tipo: TIPO_DOCUMENTO_SITE };

  if (opcoes.categoria) {
    where.metadata = { path: ['categoria'], equals: opcoes.categoria };
  }
  if (busca) {
    where.titulo = { contains: busca, mode: 'insensitive' };
  }

  const [total, documentos] = await Promise.all([
    prisma.documentoKb.count({ where: where as never }),
    prisma.documentoKb.findMany({
      where: where as never,
      orderBy: { titulo: 'asc' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: { id: true, titulo: true, metadata: true },
    }),
  ]);

  return {
    pagina,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    documentos: documentos.map((documento) => {
      const metadata = (documento.metadata ?? {}) as Record<string, unknown>;
      const categoria = comoTexto(metadata.categoria) ?? 'outros';
      const data = comoTexto(metadata.ultima_atualizacao) ?? comoTexto(metadata.data_publicacao);

      return {
        id: documento.id,
        titulo: documento.titulo,
        categoria,
        rotuloCategoria: rotuloCategoria(categoria),
        url: comoTexto(metadata.url_fonte) ?? comoTexto(metadata.url_documento_original),
        data: dataLegivel(data),
      };
    }),
  };
}
