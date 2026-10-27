/**
 * Pacote da carga semanal do SUAP (o JSON que o script do navegador entrega).
 *
 * Um só arquivo traz as duas coisas que a equipe carrega toda semana:
 *
 *   { origem, versao: 2, geradoEm, campus,
 *     editais:  [...],            // listas web do SUAP (src/lib/suap-editais.ts)
 *     extensao: [...], pesquisa: [...],   // API de projetos (src/lib/suap-import.ts)
 *     ignoradosJaExistentes: { editais, projetos },
 *     problemas: ['...'] }
 *
 * O formato antigo (só `extensao`/`pesquisa`, ou uma lista de projetos) continua
 * valendo: a carga de projetos não depende de `editais` existir.
 *
 * Módulo puro (sem Prisma): roda no servidor e nos testes.
 */

/** Marca gravada no log: é o que diferencia "carga pelo navegador" das tentativas diretas. */
export const MARCA_CARGA_NAVEGADOR = 'captura do navegador';

export interface PacoteCarga {
  /** Lista de editais crus; `null` quando o arquivo não tem a chave (formato antigo). */
  editais: unknown[] | null;
  /** O que sobra, no formato que `analisarCapturaSuap` entende; `null` se não há projetos no arquivo. */
  projetos: string | null;
  ignoradosNoScript: { editais: number; projetos: number };
  problemas: string[];
  geradoEm: string | null;
}

export type LeituraPacote = ({ ok: true } & PacoteCarga) | { ok: false; erro: string };

function numero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export function lerPacoteCarga(conteudo: string): LeituraPacote {
  let dados: unknown;
  try {
    // BOM aparece quando o arquivo é salvo no Bloco de Notas/PowerShell.
    dados = JSON.parse(conteudo.replace(/^﻿/, '').trim());
  } catch (e) {
    return { ok: false, erro: `JSON inválido: ${(e as Error).message}` };
  }

  if (Array.isArray(dados)) {
    return { ok: true, editais: null, projetos: JSON.stringify(dados), ignoradosNoScript: { editais: 0, projetos: 0 }, problemas: [], geradoEm: null };
  }
  if (!dados || typeof dados !== 'object') {
    return { ok: false, erro: 'O conteúdo precisa ser o JSON gerado pelo script de captura.' };
  }

  const objeto = dados as Record<string, unknown>;
  const editais = Array.isArray(objeto.editais) ? (objeto.editais as unknown[]) : null;

  const temProjetos =
    Array.isArray(objeto.extensao) || Array.isArray(objeto.pesquisa) ||
    Array.isArray(objeto.results) || 'projetos' in objeto;

  if (editais === null && !temProjetos) {
    return {
      ok: false,
      erro: 'Formato não reconhecido. Use o JSON gerado pelo script da Carga semanal (com as chaves "editais", "extensao" e "pesquisa").',
    };
  }

  const { editais: _editais, ignoradosJaExistentes, problemas, ...resto } = objeto;
  void _editais;
  const ignorados = (ignoradosJaExistentes && typeof ignoradosJaExistentes === 'object'
    ? ignoradosJaExistentes
    : {}) as Record<string, unknown>;

  return {
    ok: true,
    editais,
    projetos: temProjetos ? JSON.stringify(resto) : null,
    ignoradosNoScript: { editais: numero(ignorados.editais), projetos: numero(ignorados.projetos) },
    problemas: Array.isArray(problemas) ? problemas.filter((p): p is string => typeof p === 'string').slice(0, 20) : [],
    geradoEm: typeof objeto.geradoEm === 'string' ? objeto.geradoEm : null,
  };
}

/** Chave "fonte:id" de um projeto, igual à que o script usa para descartar o que já existe. */
export function chaveProjeto(suapId: number): string {
  // Extensão grava o ID negativo (ver src/lib/suap-identidade.ts).
  return `${suapId < 0 ? 'extensao' : 'pesquisa'}:${Math.abs(suapId)}`;
}
