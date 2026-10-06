/**
 * Script inline de recuperação de build antigo (deploy blue-green).
 *
 * Sintoma real (05/10/2026, `/cadastro`): o deploy troca a pasta da aplicação e
 * os arquivos com hash em `/_next/static/` do build anterior deixam de existir.
 * O navegador de quem já estava com o portal aberto continua pedindo os chunks
 * antigos; o Next registra `ChunkLoadError: Loading chunk N failed`, a
 * hidratação morre e o usuário vê só "Application error: a client-side
 * exception has occurred" (ou uma página com o conteúdo vazio).
 *
 * Por que inline (e não um componente React): nas duas telas o React não chega
 * a montar — é justamente a hidratação que falha. Um `useEffect` nunca
 * rodaria. Este script é avaliado pelo navegador assim que o HTML é lido,
 * antes de qualquer chunk, e por isso consegue reagir.
 *
 * O que ele faz: se um arquivo `/_next/static/*` falhar ao carregar (ou o
 * webpack reclamar de chunk ausente/RSC), recarrega a página — o HTML novo
 * aponta para os chunks do build novo. Recarrega no máximo 3 vezes por sessão e
 * nunca duas vezes em 30 s, para não virar laço quando a falha for de rede.
 *
 * Reprodução: `next start` + falhar a 1ª requisição de
 * `/_next/static/chunks/app/<rota>/*.js` — sem o script a página fica sem o
 * conteúdo da rota (ver DECISIONS.md §25).
 */
export const SCRIPT_RECUPERACAO_BUILD = `(function () {
  var CHAVE = 'portal-recarga-build';
  var INTERVALO = 30000;
  var MAXIMO = 3;
  function podeRecarregar() {
    try {
      var agora = Date.now();
      var ultima = Number(sessionStorage.getItem(CHAVE) || 0);
      var tentativas = Number(sessionStorage.getItem(CHAVE + '-n') || 0);
      if (agora - ultima < INTERVALO || tentativas >= MAXIMO) return false;
      sessionStorage.setItem(CHAVE, String(agora));
      sessionStorage.setItem(CHAVE + '-n', String(tentativas + 1));
      return true;
    } catch (e) {
      return false;
    }
  }
  function ehFalhaDeChunk(texto) {
    return /ChunkLoadError|Loading chunk [0-9]+ failed|Failed to fetch dynamically imported module|Unable to preload CSS|error loading dynamically imported module/i.test(texto || '');
  }
  function recarregar(motivo) {
    if (!podeRecarregar()) return;
    try { console.warn('[Portal] Pagina desatualizada apos deploy (' + motivo + ') - recarregando.'); } catch (e) {}
    location.reload();
  }
  window.addEventListener('error', function (evento) {
    var alvo = evento.target;
    var url = alvo && alvo !== window ? (alvo.src || alvo.href || '') : '';
    if (url && url.indexOf('/_next/static/') !== -1) {
      recarregar(String(url).split('/').pop());
      return;
    }
    var mensagem = (evento.message || '') + ' ' + ((evento.error && evento.error.message) || '');
    if (ehFalhaDeChunk(mensagem)) recarregar(String(mensagem).slice(0, 120));
  }, true);
  window.addEventListener('unhandledrejection', function (evento) {
    var motivo = evento.reason || '';
    var mensagem = typeof motivo === 'string' ? motivo : ((motivo.name || '') + ' ' + (motivo.message || ''));
    if (ehFalhaDeChunk(mensagem)) recarregar(String(mensagem).slice(0, 120));
  });
})();`;
