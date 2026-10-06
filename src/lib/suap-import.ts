import { normalizaSiglaSuap, type SuapProjeto } from '@/lib/suap-api';

/**
 * Importação de projetos do SUAP a partir de uma **captura feita no navegador**.
 *
 * Por que existe: o SUAP está atrás de um AWS WAF que desafia (CAPTCHA) o IP do
 * servidor do portal, então a busca direta (`syncProjetos`) não consegue passar.
 * Do navegador de quem está logado, a API responde normalmente — a captura
 * (`public/modelos/capturar-projetos-suap.js`) chama os dois endpoints de dentro
 * da sessão, sem precisar de token, e devolve um JSON que o painel importa por
 * aqui. O mapeamento de campos e a gravação são os mesmos do sync direto
 * (`aplicarProjetosDoSuap`).
 *
 * Formatos aceitos no arquivo/colagem:
 *   1. `{ extensao: [...], pesquisa: [...] }` — o que a captura gera;
 *   2. `[...]` — lista de projetos, cada um podendo trazer `_fonte`;
 *   3. `{ results: [...], _fonte: 'pesquisa' }` — resposta crua paginada;
 *   4. qualquer um dos acima embrulhado em `{ projetos: ... }`.
 */

export type ProjetoCapturado = SuapProjeto & { _fonte: 'pesquisa' | 'extensao' };

export type ResultadoCaptura = {
  total: number;
  projetos: ProjetoCapturado[];
  erros: { indice: number; motivo: string }[];
  avisos: string[];
  resumo: {
    porFonte: Record<string, number>;
    porSituacao: Record<string, number>;
    porCampus: Record<string, number>;
    siglaAlvo: string;
    noCampusAlvo: number;
  };
};

const FONTES = ['extensao', 'pesquisa'] as const;

function ehFonte(valor: unknown): valor is 'pesquisa' | 'extensao' {
  return valor === 'pesquisa' || valor === 'extensao';
}

/** Normaliza a forma do projeto: garante `id` numérico e `titulo` com texto. */
function normalizarProjeto(bruto: unknown, indice: number): { projeto?: ProjetoCapturado; erro?: string; aviso?: string } {
  if (!bruto || typeof bruto !== 'object') {
    return { erro: 'não é um objeto' };
  }
  const item = bruto as Record<string, unknown>;

  const idBruto = item.id;
  const id = typeof idBruto === 'number' ? idBruto : Number.parseInt(String(idBruto ?? ''), 10);
  if (!Number.isFinite(id)) {
    return { erro: 'sem o campo "id" (número)' };
  }

  const titulo = String(item.titulo ?? '').trim();
  if (!titulo) {
    return { erro: 'sem o campo "titulo"' };
  }

  const fonteInformada = item._fonte ?? item.fonte;
  const fonte: 'pesquisa' | 'extensao' = ehFonte(fonteInformada) ? fonteInformada : 'extensao';
  const aviso = !ehFonte(fonteInformada)
    ? 'Item sem "_fonte"; tratei como extensão. Se houver projetos de pesquisa, confira o arquivo.'
    : undefined;

  return {
    projeto: { ...(item as SuapProjeto), id, titulo, _fonte: fonte },
    aviso,
  };
}

export function analisarCapturaSuap(conteudo: string, siglaAlvo = 'IVAIPODG'): ResultadoCaptura {
  const alvo = normalizaSiglaSuap(siglaAlvo);
  const erros: { indice: number; motivo: string }[] = [];
  const avisos: string[] = [];
  const projetos: ProjetoCapturado[] = [];
  const vistos = new Map<string, number>(); // "fonte:id" -> índice no resultado (dedupe)
  let total = 0;

  const registrar = (bruto: unknown, indice: number, fonteDoGrupo?: 'pesquisa' | 'extensao') => {
    total++;
    const comFonte = fonteDoGrupo && !(bruto && typeof bruto === 'object' && ('_fonte' in (bruto as object) || 'fonte' in (bruto as object)))
      ? { ...(bruto as object), _fonte: fonteDoGrupo }
      : bruto;
    const { projeto, erro, aviso } = normalizarProjeto(comFonte, indice);
    if (erro) {
      erros.push({ indice: indice + 1, motivo: erro });
      return;
    }
    if (aviso) avisos.push(aviso);

    const chave = `${projeto!._fonte}:${projeto!.id}`;
    const jaVisto = vistos.get(chave);
    if (jaVisto !== undefined) {
      // O mesmo projeto pode aparecer em mais de uma página da captura: fica o
      // último (o mais recente) e a gente avisa, em vez de gravar duas vezes.
      projetos[jaVisto] = projeto!;
      return;
    }
    vistos.set(chave, projetos.length);
    projetos.push(projeto!);
  };

  let dados: unknown;
  try {
    // O BOM aparece quando o arquivo é salvo no Bloco de Notas (ou por scripts
    // PowerShell) e faz o `JSON.parse` falhar com uma mensagem incompreensível —
    // por isso ele sai antes de qualquer outra coisa.
    dados = JSON.parse(conteudo.replace(/^\uFEFF/, '').trim());
  } catch (e) {
    return {
      total: 0,
      projetos: [],
      erros: [{ indice: 0, motivo: `JSON inválido: ${(e as Error).message}` }],
      avisos: [],
      resumo: { porFonte: {}, porSituacao: {}, porCampus: {}, siglaAlvo: alvo, noCampusAlvo: 0 },
    };
  }

  // Desembrulha `{ projetos: ... }` e formatos aninhados conhecidos.
  let corpo: unknown = dados;
  if (corpo && typeof corpo === 'object' && !Array.isArray(corpo) && 'projetos' in (corpo as object)) {
    corpo = (corpo as Record<string, unknown>).projetos;
  }

  if (Array.isArray(corpo)) {
    corpo.forEach((item, i) => registrar(item, i));
  } else if (corpo && typeof corpo === 'object') {
    const objeto = corpo as Record<string, unknown>;
    const temGrupos = FONTES.some((f) => Array.isArray(objeto[f]));
    const temResults = Array.isArray(objeto.results);

    if (temGrupos) {
      for (const fonte of FONTES) {
        const lista = objeto[fonte];
        if (!Array.isArray(lista)) continue;
        lista.forEach((item, i) => registrar(item, i, fonte));
      }
    } else if (temResults) {
      const fonte = ehFonte(objeto._fonte ?? objeto.fonte) ? ((objeto._fonte ?? objeto.fonte) as 'pesquisa' | 'extensao') : undefined;
      if (!fonte) {
        avisos.push('A resposta paginada não diz de qual fonte ela é ("_fonte"); tratei tudo como extensão.');
      }
      (objeto.results as unknown[]).forEach((item, i) => registrar(item, i, fonte));
    } else {
      erros.push({
        indice: 0,
        motivo: 'Formato não reconhecido. Use o arquivo gerado pela captura (com as chaves "extensao" e "pesquisa") ou uma lista de projetos.',
      });
    }
  } else {
    erros.push({ indice: 0, motivo: 'O conteúdo precisa ser um objeto ou uma lista de projetos.' });
  }

  if (projetos.length > 2500) {
    avisos.push(`Arquivo grande: ${projetos.length} projetos. A gravação é feita item a item e pode levar alguns minutos.`);
  }

  const porFonte: Record<string, number> = {};
  const porSituacao: Record<string, number> = {};
  const porCampus: Record<string, number> = {};
  let noCampusAlvo = 0;

  for (const projeto of projetos) {
    porFonte[projeto._fonte] = (porFonte[projeto._fonte] ?? 0) + 1;
    const situacao = (projeto.situacao ?? '(sem situação)').trim() || '(sem situação)';
    porSituacao[situacao] = (porSituacao[situacao] ?? 0) + 1;
    const campus = (projeto.campus_sigla ?? '(sem campus)').trim() || '(sem campus)';
    porCampus[campus] = (porCampus[campus] ?? 0) + 1;
    if (normalizaSiglaSuap(projeto.campus_sigla) === alvo) noCampusAlvo++;
  }

  if (projetos.length > 0 && noCampusAlvo === 0) {
    avisos.push(
      `Nenhum projeto do campus "${alvo}" nesta captura — o SUAP devolveu projetos de: ${Object.keys(porCampus).sort().join(', ') || '(nenhum)'}. ` +
      `Confira a sigla configurada (SUAP_CAMPUS_SIGLA) ou capture as páginas do campus certo.`,
    );
  }

  return {
    total,
    projetos,
    erros,
    avisos,
    resumo: { porFonte, porSituacao, porCampus, siglaAlvo: alvo, noCampusAlvo },
  };
}
