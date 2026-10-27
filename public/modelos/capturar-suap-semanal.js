/**
 * Carga semanal do SUAP para o Portal Conecta — IFPR Campus Ivaiporã.
 *
 * Em UMA colagem, captura:
 *   • os EDITAIS das três listas do SUAP (pesquisa, projetos de extensão e projetos
 *     de ensino), só do campus configurado;
 *   • os PROJETOS de extensão e de pesquisa (API do SUAP), só do campus.
 *
 * E devolve só o que é NOVO: o painel do portal embute, no código que você copia,
 * a lista do que já existe (window.__portalConectaConhecidos), e este script
 * descarta esses itens. Sem essa lista (ex.: o arquivo baixado cru), ele traz tudo
 * e o portal descarta na hora de gravar.
 *
 * POR QUE ISTO EXISTE
 * O SUAP está atrás de um AWS WAF que desafia com CAPTCHA o IP do servidor do
 * portal. Do navegador logado tudo responde, e como o script roda dentro da página
 * do SUAP ele aproveita a sua própria sessão — não precisa de token nem de API
 * oficial.
 *
 * COMO USAR (2 minutos) — o passo a passo completo está no painel (Carga semanal):
 *   1. entre no SUAP (https://suap.ifpr.edu.br) com a sua conta;
 *   2. abra o Console: F12 → aba "Console" (no Chrome/Edge, na primeira vez, digite
 *      "allow pasting" e Enter — é uma trava do navegador contra código colado);
 *   3. cole TODO o código e aperte Enter;
 *   4. espere "✅ Captura pronta" — o JSON já está na área de transferência (se o
 *      navegador bloquear, ele baixa um arquivo .json);
 *   5. no portal, cole no passo 2 da Carga semanal e confira a prévia.
 *
 * Para outro campus sem editar o arquivo, rode antes no Console:
 *   window.__portalConectaCampus = 'OUTRASIGLA'
 *
 * Só faz GET no próprio SUAP. Nada é enviado para lugar nenhum — o resultado fica
 * na sua área de transferência. Os endereços dos PDFs dos editais (assinados e
 * temporários) NÃO são copiados.
 */
(async function capturarSuapSemanal() {
  const BASE = 'https://suap.ifpr.edu.br';
  const CAMPUS_SIGLA = (window.__portalConectaCampus || 'IVAIPODG');
  const CONHECIDOS = window.__portalConectaConhecidos || {};
  const EDITAIS_CONHECIDOS = new Set(CONHECIDOS.editais || []);
  const PROJETOS_CONHECIDOS = new Set(CONHECIDOS.projetos || []);

  const FONTES_EDITAL = [
    { fonte: 'pesquisa', caminho: '/pesquisa/editais/', rotulo: 'pesquisa' },
    { fonte: 'projetos', caminho: '/projetos/editais/', rotulo: 'projetos de extensão' },
    { fonte: 'ensino', caminho: '/projetos_ensino/editais/', rotulo: 'projetos de ensino' },
  ];
  const FONTES_PROJETO = ['extensao', 'pesquisa'];
  const TAMANHO_PAGINA = 100;
  const MAX_PAGINAS = 400; // trava de segurança (400 × 100 = 40.000 itens por fonte)
  const MAX_PAGINAS_EDITAIS = 60;

  const log = (...args) => console.log('%c[Portal Conecta]', 'color:#2F52D3;font-weight:bold', ...args);

  /** Compara sigla sem caixa e sem acento ("Ivaiporã" == "IVAIPORA"). */
  const normalizar = (valor) =>
    String(valor ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase();

  /** Texto de um elemento sem quebras nem espaços repetidos. */
  const texto = (el) => (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();

  const alvo = normalizar(CAMPUS_SIGLA);
  const doCampus = (projeto) => normalizar(projeto && projeto.campus_sigla) === alvo;

  // <chave-edital>
  // A MESMA regra de src/lib/suap-editais.ts (chaveEdital). Os cartões do SUAP não
  // mostram o ID, então a identidade é fonte + título + ano de abertura.
  function chaveEdital(fonte, titulo, inscricoes) {
    const slug = String(titulo || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 150)
      .replace(/-+$/g, '');
    const ano = (String(inscricoes || '').match(/\d{2}\/\d{2}\/(\d{4})/) || [])[1] || '0';
    return 'suap-edital:' + fonte + ':' + slug + ':' + ano;
  }
  // </chave-edital>

  // ─── Editais (listas web) ───────────────────────────────────────────────────

  /** Baixa uma página HTML do SUAP e devolve o documento já interpretado. */
  async function lerHtml(url) {
    const resposta = await fetch(url, { headers: { Accept: 'text/html' }, credentials: 'same-origin' });
    if (/\/accounts\/login/.test(resposta.url)) {
      throw new Error('Você não está logado no SUAP nesta aba. Entre no SUAP, e rode o script de novo.');
    }
    const html = await resposta.text();
    if (/Human Verification|awsWaf|captcha/i.test(html.slice(0, 4000))) {
      throw new Error('O WAF do SUAP pediu verificação humana nesta janela. Recarregue o SUAP, resolva o CAPTCHA e rode o script de novo.');
    }
    if (!resposta.ok) {
      throw new Error('O SUAP respondeu HTTP ' + resposta.status + ' em ' + url);
    }
    return new DOMParser().parseFromString(html, 'text/html');
  }

  /** Lê um cartão de edital (.general-box) — os textos como o SUAP mostra. */
  function lerCartao(fonte, cartao) {
    const campos = {};
    cartao.querySelectorAll('dl.secondary-info .list-item').forEach((item) => {
      const rotulo = normalizar(texto(item.querySelector('dt'))).replace(/:$/, '').trim();
      const dd = item.querySelector('dd');
      campos[rotulo] = { texto: texto(dd), temLink: !!(dd && dd.querySelector('a[href]')) };
    });
    const valor = (rotulo) => (campos[rotulo] && campos[rotulo].texto) || '';

    return {
      fonte,
      titulo: texto(cartao.querySelector('.primary-info h4')),
      descricao: Array.from(cartao.querySelectorAll('.primary-info .extra-info p')).map(texto).filter(Boolean).join('\n\n'),
      inscricoes: valor('INSCRICOES'),
      preSelecao: valor('PERIODO DE PRE-SELECAO'),
      selecao: valor('PERIODO DE SELECAO'),
      recurso: valor('PERIODO DE RECURSO'),
      resultado: valor('DIVULGACAO DO RESULTADO'),
      campi: valor('PARA OS CAMPI'),
      // Só registramos SE há arquivo. O endereço é assinado, expira em minutos e não serve de link.
      temArquivo: !!(campos['ARQUIVO DO EDITAL'] && campos['ARQUIVO DO EDITAL'].temLink),
    };
  }

  async function buscarEditais(def) {
    const base = BASE + def.caminho;
    const inicial = await lerHtml(base);

    // O filtro de campus da página usa um número interno (Ivaiporã = 15 hoje): lemos
    // do próprio <select> para não depender dele.
    const opcao = Array.from(inicial.querySelectorAll('select[name="uo"] option')).find((o) => normalizar(texto(o)) === alvo);
    if (!opcao) {
      throw new Error('o filtro de campus de ' + def.caminho + ' não tem "' + CAMPUS_SIGLA + '" (o layout do SUAP pode ter mudado).');
    }
    const seletorAno = inicial.querySelector('select[name="ano"]');
    const anoPadrao = seletorAno ? seletorAno.value : '';

    const cartoes = [];
    let totalInformado = null;
    for (let pagina = 1; pagina <= MAX_PAGINAS_EDITAIS; pagina += 1) {
      const parametros = new URLSearchParams({ ano: anoPadrao, uo: opcao.value, periodo: '', page: String(pagina) });
      const doc = await lerHtml(base + '?' + parametros);

      const tot = texto(doc.querySelector('ul.pagination li')).match(/Total de (\d+)/);
      if (tot && totalInformado === null) totalInformado = Number(tot[1]);

      const nestaPagina = Array.from(doc.querySelectorAll('.general-box'))
        .filter((c) => c.querySelector('.primary-info h4'))
        .map((c) => lerCartao(def.fonte, c));
      cartoes.push(...nestaPagina);
      log('editais (' + def.rotulo + '): página ' + pagina + ' → ' + nestaPagina.length + ' cartão(ões)');

      if (nestaPagina.length === 0) break;
      if (!doc.querySelector('ul.pagination li.next:not(.disabled) a')) break;
    }

    if (cartoes.length === 0 && totalInformado) {
      throw new Error('a página de ' + def.caminho + ' diz ter ' + totalInformado + ' itens, mas não achei nenhum cartão — o layout do SUAP pode ter mudado.');
    }
    if (totalInformado !== null && cartoes.length < totalInformado) {
      log('⚠️ editais (' + def.rotulo + '): a página informa ' + totalInformado + ' itens e li ' + cartoes.length + '.');
    }
    return cartoes;
  }

  // ─── Projetos (API) ─────────────────────────────────────────────────────────

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
      const corpo = (await resposta.text()).slice(0, 120).replace(/\s+/g, ' ');
      if (/Human Verification|awsWaf|captcha/i.test(corpo)) {
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
    let pagina = 1;
    let dados = primeira;

    while (true) {
      for (const item of dados.itens) {
        if (item && item.campus_sigla) siglasVistas.add(normalizar(item.campus_sigla));
      }
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

    return { encontrados, siglasVistas: Array.from(siglasVistas) };
  }

  // ─── Execução ───────────────────────────────────────────────────────────────

  try {
    const sabemosOQueExiste = EDITAIS_CONHECIDOS.size + PROJETOS_CONHECIDOS.size > 0;
    log(
      `Carga semanal do campus ${CAMPUS_SIGLA}. ` +
      (sabemosOQueExiste
        ? `O portal já tem ${EDITAIS_CONHECIDOS.size} editais e ${PROJETOS_CONHECIDOS.size} projetos do SUAP — só o que for novo entra no arquivo.`
        : 'Sem a lista do portal: vou trazer tudo (o portal descarta o que já tem na hora de gravar).'),
    );

    const problemas = [];
    let vistosEditais = 0;
    let vistosProjetos = 0;
    let ignoradosEditais = 0;
    let ignoradosProjetos = 0;
    // Quantas fontes foram lidas de verdade. Se TODAS de um grupo falharem, o grupo
    // não entra no arquivo: uma lista vazia pareceria "nada de novo" e o portal
    // registraria uma carga que não aconteceu.
    let editaisLidos = 0;
    let projetosLidos = 0;
    const editais = [];
    const resultado = { extensao: [], pesquisa: [] };
    const siglasVistas = new Set();

    for (const def of FONTES_EDITAL) {
      try {
        const cartoes = await buscarEditais(def);
        editaisLidos += 1;
        for (const cartao of cartoes) {
          // Segunda trava do campus: o filtro da URL já veio do SUAP, mas o cartão
          // diz para quais campi vale. Sem o campo, confiamos no filtro da URL.
          if (cartao.campi && !normalizar(cartao.campi).split(/[^A-Z0-9]+/).includes(alvo)) continue;
          vistosEditais += 1;
          if (EDITAIS_CONHECIDOS.has(chaveEdital(cartao.fonte, cartao.titulo, cartao.inscricoes))) {
            ignoradosEditais += 1;
          } else {
            editais.push(cartao);
          }
        }
      } catch (erro) {
        problemas.push('editais (' + def.rotulo + '): ' + erro.message);
      }
    }

    for (const fonte of FONTES_PROJETO) {
      try {
        const { encontrados, siglasVistas: siglas } = await buscarFonte(fonte);
        siglas.forEach((s) => siglasVistas.add(s));
        projetosLidos += 1;
        vistosProjetos += encontrados.length;
        for (const projeto of encontrados) {
          if (PROJETOS_CONHECIDOS.has(fonte + ':' + projeto.id)) {
            ignoradosProjetos += 1;
          } else {
            resultado[fonte].push(projeto);
          }
        }
      } catch (erro) {
        problemas.push('projetos (' + fonte + '): ' + erro.message);
      }
    }

    if (vistosProjetos === 0 && siglasVistas.size > 0) {
      const siglas = Array.from(siglasVistas).sort().join(', ');
      problemas.push(
        'projetos: nenhum do campus ' + CAMPUS_SIGLA + ' foi encontrado. Siglas que apareceram no SUAP: ' + siglas +
        ". Se a sua sigla for outra, rode window.__portalConectaCampus = 'SIGLA' e execute o script de novo.",
      );
    }

    // Se nada foi lido e houve problemas, não há o que importar: avisamos em vez de
    // gerar um arquivo vazio que pareceria "semana sem novidades".
    if (editaisLidos === 0 && projetosLidos === 0) {
      console.error('[Portal Conecta] Nada foi capturado:', problemas);
      alert('Nada foi capturado.\n\n' + problemas.join('\n\n'));
      return;
    }

    const totalNovos = editais.length + resultado.extensao.length + resultado.pesquisa.length;
    const pacote = {
      origem: 'captura-suap-navegador',
      versao: 2,
      geradoEm: new Date().toISOString(),
      campus: CAMPUS_SIGLA,
      resumo: {
        editais: editais.length,
        extensao: resultado.extensao.length,
        pesquisa: resultado.pesquisa.length,
        total: totalNovos,
      },
      ignoradosJaExistentes: { editais: ignoradosEditais, projetos: ignoradosProjetos },
      problemas,
      // `undefined` some do JSON: grupo inteiro que falhou não aparece no arquivo.
      editais: editaisLidos > 0 ? editais : undefined,
      extensao: projetosLidos > 0 ? resultado.extensao : undefined,
      pesquisa: projetosLidos > 0 ? resultado.pesquisa : undefined,
    };
    const json = JSON.stringify(pacote);

    let copiado = false;
    try {
      await navigator.clipboard.writeText(json);
      copiado = true;
    } catch {
      // Clipboard bloqueado (comum quando o foco saiu da página): cai para o arquivo.
    }

    log(
      `✅ Captura pronta: ${editais.length} edital(is) novo(s) + ${resultado.extensao.length} projeto(s) de extensão + ` +
      `${resultado.pesquisa.length} de pesquisa (${(json.length / 1024).toFixed(0)} KB). ` +
      `Já existiam no portal e ficaram de fora: ${ignoradosEditais} edital(is) e ${ignoradosProjetos} projeto(s).`,
    );
    if (totalNovos === 0 && problemas.length === 0) {
      log('Semana sem novidades: mesmo assim cole no portal para registrar a data desta carga.');
    }

    if (copiado) {
      log('O JSON já está na sua área de transferência — cole no portal em Carga semanal, passo 2.');
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `carga-suap-${CAMPUS_SIGLA}-${new Date().toISOString().slice(0, 10)}.json`;
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
