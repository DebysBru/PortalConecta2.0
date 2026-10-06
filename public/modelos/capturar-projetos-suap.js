/**
 * Captura de projetos do SUAP para o Portal Conecta — IFPR Campus Ivaiporã.
 *
 * Traz SOMENTE os projetos do campus configurado abaixo (padrão: IVAIPODG).
 *
 * POR QUE ISTO EXISTE
 * O SUAP está atrás de um AWS WAF que desafia com CAPTCHA o IP do servidor do
 * portal (`405` + página "Human Verification"). Do **navegador logado** a API
 * responde normalmente, e como este script roda dentro da página do SUAP ele
 * aproveita a própria sessão — não precisa de token nenhum.
 *
 * COMO USAR (2 minutos)
 *   1. Entre no SUAP (https://suap.ifpr.edu.br) normalmente, com a sua conta;
 *   2. abra o Console do navegador: F12 → aba "Console";
 *   3. cole TODO este arquivo e aperte Enter;
 *   4. espere a mensagem "✅ Captura pronta" — o JSON já está na sua área de
 *      transferência (se o navegador bloquear, ele baixa um arquivo .json);
 *   5. no portal: Painel → SUAP → "Importar do SUAP", cole o conteúdo e confira
 *      a prévia antes de gravar.
 *
 * Para capturar outro campus sem editar o arquivo, rode antes no Console:
 *   window.__portalConectaCampus = 'OUTRASIGLA'
 *
 * O que ele faz: consulta `/api/extensao/projetos/` e `/api/pesquisa/projetos/`
 * (as mesmas listas que a sincronização automática usaria), **filtra pelo campus**
 * e junta tudo num JSON com as chaves `extensao` e `pesquisa`. Nada é enviado
 * para lugar nenhum — só leitura no próprio SUAP e o resultado na sua área de
 * transferência.
 */
(async function capturarProjetosSuap() {
  const BASE = 'https://suap.ifpr.edu.br';
  const CAMPUS_SIGLA = (window.__portalConectaCampus || 'IVAIPODG');
  const FONTES = ['extensao', 'pesquisa'];
  const TAMANHO_PAGINA = 100;
  const MAX_PAGINAS = 400; // trava de segurança (400 × 100 = 40.000 itens por fonte)

  const log = (...args) => console.log('%c[Portal Conecta]', 'color:#2F52D3;font-weight:bold', ...args);

  /** Compara sigla sem caixa e sem acento ("Ivaiporã" == "IVAIPORA"). */
  const normalizar = (valor) =>
    String(valor ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

  const alvo = normalizar(CAMPUS_SIGLA);
  const doCampus = (projeto) => normalizar(projeto && projeto.campus_sigla) === alvo;

  /** Lê uma página e devolve os itens + o total informado pela API. */
  async function lerPagina(fonte, pagina, filtroCampus) {
    const parametros = new URLSearchParams({ page: String(pagina), page_size: String(TAMANHO_PAGINA) });
    if (filtroCampus) parametros.set('campus_sigla', CAMPUS_SIGLA);

    const resposta = await fetch(`${BASE}/api/${fonte}/projetos/?${parametros}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin', // usa a sessão do SUAP que já está aberta
    });

    const tipo = resposta.headers.get('content-type') || '';
    if (!tipo.includes('json')) {
      const texto = (await resposta.text()).slice(0, 120).replace(/\s+/g, ' ');
      if (/Human Verification|awsWaf|captcha/i.test(texto)) {
        throw new Error(
          'O WAF do SUAP pediu verificação humana nesta janela. Recarregue o SUAP, resolva o CAPTCHA e rode o script de novo.',
        );
      }
      throw new Error(
        `O SUAP não devolveu JSON em /api/${fonte}/projetos/ (HTTP ${resposta.status}). ` +
        'Confirme que você está logado no SUAP nesta aba e tente novamente.',
      );
    }

    const dados = await resposta.json();
    const itens = Array.isArray(dados) ? dados : (dados.results || []);
    return { itens, total: typeof dados.count === 'number' ? dados.count : null, proxima: dados.next || null };
  }

  async function buscarFonte(fonte) {
    // ── 1. A API aceita filtrar por campus? ────────────────────────────────────
    // A documentação só descreve o parâmetro `page`, mas vários endpoints do SUAP
    // aceitam filtros extras. Testamos: se o total cair e a página vier só com o
    // campus pedido, aproveitamos o filtro do servidor (bem menos requisições).
    const primeiraSemFiltro = await lerPagina(fonte, 1, false);
    let usaFiltroServidor = false;
    let primeira = primeiraSemFiltro;

    if (primeiraSemFiltro.total !== 0) {
      try {
        const comFiltro = await lerPagina(fonte, 1, true);
        const todosDoCampus = comFiltro.itens.length > 0 && comFiltro.itens.every(doCampus);
        const reduziu = comFiltro.total !== null && primeiraSemFiltro.total !== null
          ? comFiltro.total < primeiraSemFiltro.total
          : todosDoCampus;
        if (todosDoCampus && reduziu) {
          usaFiltroServidor = true;
          primeira = comFiltro;
          log(`${fonte}: a API aceitou o filtro de campus (${comFiltro.total} projetos em ${CAMPUS_SIGLA}).`);
        }
      } catch (erro) {
        log(`${fonte}: não deu para testar o filtro de campus (${erro.message}); vou filtrar aqui.`);
      }
    }

    if (!usaFiltroServidor) {
      log(`${fonte}: a API não filtra por campus — vou percorrer as páginas e filtrar aqui (${primeiraSemFiltro.total ?? '?'} itens no total).`);
    }

    // ── 2. Percorre as páginas ─────────────────────────────────────────────────
    const encontrados = [];
    const siglasVistas = new Set();
    let itensLidos = 0;
    let pagina = 1;
    let dados = primeira;

    while (true) {
      for (const item of dados.itens) {
        if (item && item.campus_sigla) siglasVistas.add(normalizar(item.campus_sigla));
      }
      itensLidos += dados.itens.length;
      const filtrados = dados.itens.filter(doCampus);
      encontrados.push(...filtrados);

      log(`${fonte}: página ${pagina} → ${dados.itens.length} itens (${filtrados.length} de ${CAMPUS_SIGLA}; ${encontrados.length} até agora)`);

      const acabou = dados.itens.length === 0 || (!usaFiltroServidor && !dados.proxima);
      if (acabou || pagina >= MAX_PAGINAS) break;

      pagina += 1;
      dados = await lerPagina(fonte, pagina, usaFiltroServidor);
    }

    if (pagina >= MAX_PAGINAS) {
      log(`⚠️ ${fonte}: parei em ${MAX_PAGINAS} páginas — pode haver projeto faltando.`);
    }

    return { encontrados, itensLidos, siglasVistas: [...siglasVistas] };
  }

  try {
    log(`Buscando projetos do campus ${CAMPUS_SIGLA} (extensão e pesquisa)...`);
    const resultado = { extensao: [], pesquisa: [] };
    const problemas = [];
    const siglasVistas = new Set();

    for (const fonte of FONTES) {
      try {
        const { encontrados, siglasVistas: siglas } = await buscarFonte(fonte);
        resultado[fonte] = encontrados;
        siglas.forEach((s) => siglasVistas.add(s));
      } catch (erro) {
        problemas.push(`${fonte}: ${erro.message}`);
      }
    }

    const total = resultado.extensao.length + resultado.pesquisa.length;
    if (total === 0) {
      const siglas = [...siglasVistas].sort().join(', ') || '(nenhuma sigla lida)';
      console.error('[Portal Conecta] Nenhum projeto do campus', CAMPUS_SIGLA, 'foi encontrado.');
      log(`Siglas que apareceram no SUAP: ${siglas}`);
      log(`Se a sua sigla for outra, rode: window.__portalConectaCampus = 'SIGLA' e execute o script de novo.`);
      alert(
        `Nenhum projeto do campus ${CAMPUS_SIGLA} foi encontrado.\n\n` +
        `Siglas que apareceram: ${siglas}\n\n` +
        `Se a sigla correta for outra, defina window.__portalConectaCampus antes de rodar o script.`,
      );
      return;
    }

    const pacote = {
      origem: 'captura-suap-navegador',
      geradoEm: new Date().toISOString(),
      campus: CAMPUS_SIGLA,
      resumo: { extensao: resultado.extensao.length, pesquisa: resultado.pesquisa.length, total },
      extensao: resultado.extensao,
      pesquisa: resultado.pesquisa,
    };
    const json = JSON.stringify(pacote);

    let copiado = false;
    try {
      await navigator.clipboard.writeText(json);
      copiado = true;
    } catch {
      // Clipboard bloqueado (comum em aba anônima): cai para o arquivo.
    }

    log(
      `✅ Captura pronta: ${resultado.extensao.length} de extensão + ${resultado.pesquisa.length} de pesquisa ` +
      `(só campus ${CAMPUS_SIGLA}, ${(json.length / 1024).toFixed(0)} KB).`,
    );

    if (copiado) {
      log('O JSON já está na sua área de transferência — cole no portal em Painel → SUAP → Importar do SUAP.');
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `projetos-suap-${CAMPUS_SIGLA}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      log('A área de transferência estava bloqueada, então baixei o arquivo .json — envie ele no portal.');
    }

    if (problemas.length) {
      log('⚠️ Alguns problemas aconteceram:', problemas.join(' | '));
    }
    window.__portalConectaCaptura = pacote; // permite `copy(JSON.stringify(window.__portalConectaCaptura))`
  } catch (erro) {
    console.error('[Portal Conecta] Falha na captura:', erro);
    alert('Falha na captura: ' + erro.message);
  }
})();
