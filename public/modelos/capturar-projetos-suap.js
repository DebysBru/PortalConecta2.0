/**
 * Captura de projetos do SUAP para o Portal Conecta — IFPR Campus Ivaiporã.
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
 * O que ele faz: busca as páginas de `/api/extensao/projetos/` e
 * `/api/pesquisa/projetos/` (as mesmas que a sincronização automática usaria) e
 * junta tudo num JSON com as chaves `extensao` e `pesquisa`.
 */
(async function capturarProjetosSuap() {
  const BASE = 'https://suap.ifpr.edu.br';
  const FONTES = ['extensao', 'pesquisa'];
  const MAX_PAGINAS = 60; // trava de segurança: 60 × 100 = 6.000 projetos por fonte

  const log = (...args) => console.log('%c[Portal Conecta]', 'color:#2F52D3;font-weight:bold', ...args);

  async function buscarFonte(fonte) {
    const itens = [];
    let url = `${BASE}/api/${fonte}/projetos/?page=1&page_size=100`;
    let pagina = 1;

    while (url && pagina <= MAX_PAGINAS) {
      const resposta = await fetch(url, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin', // usa a sessão do SUAP que já está aberta
      });

      const tipo = resposta.headers.get('content-type') || '';
      if (!tipo.includes('json')) {
        // Aqui cai o CAPTCHA do WAF e também a tela de login do SUAP.
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
      const lista = Array.isArray(dados) ? dados : (dados.results || []);
      itens.push(...lista);
      log(`${fonte}: página ${pagina} → ${lista.length} itens (total ${itens.length})`);

      const proxima = dados.next;
      if (!proxima || lista.length === 0) break;
      // `next` vem absoluto; mantemos só o caminho para não sair do SUAP.
      url = proxima.startsWith('http') ? proxima : `${BASE}${proxima}`;
      pagina += 1;
    }

    if (pagina > MAX_PAGINAS) {
      log(`⚠️ ${fonte}: parei em ${MAX_PAGINAS} páginas. Se houver mais projetos, rode a captura por ano.`);
    }
    return itens;
  }

  try {
    log('Buscando projetos de extensão e pesquisa...');
    const resultado = { extensao: [], pesquisa: [] };
    const problemas = [];

    for (const fonte of FONTES) {
      try {
        resultado[fonte] = await buscarFonte(fonte);
      } catch (erro) {
        problemas.push(`${fonte}: ${erro.message}`);
      }
    }

    const total = resultado.extensao.length + resultado.pesquisa.length;
    if (total === 0) {
      console.error('[Portal Conecta] Nada foi capturado.', problemas.join(' | '));
      alert('Não consegui capturar projetos. Veja o Console (F12) para o motivo.');
      return;
    }

    const pacote = {
      origem: 'captura-suap-navegador',
      geradoEm: new Date().toISOString(),
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

    if (copiado) {
      log(`✅ Captura pronta: ${resultado.extensao.length} de extensão + ${resultado.pesquisa.length} de pesquisa.`);
      log('O JSON já está na sua área de transferência — cole no portal em Painel → SUAP → Importar do SUAP.');
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `projetos-suap-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      log(`✅ Captura pronta: ${resultado.extensao.length} de extensão + ${resultado.pesquisa.length} de pesquisa.`);
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
