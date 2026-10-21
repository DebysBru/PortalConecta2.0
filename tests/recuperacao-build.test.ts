import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SCRIPT_RECUPERACAO_BUILD } from '@/lib/recuperacao-build';

/**
 * Recuperação de build antigo (deploy blue-green).
 *
 * Bug que originou este arquivo (visto em produção em 05/10/2026, `/cadastro`):
 * o deploy troca a pasta da aplicação, os chunks com hash de `/_next/static/`
 * do build anterior somem e o navegador de quem já estava com o portal aberto
 * pede arquivos que não existem mais. O Next registra
 * `ChunkLoadError: Loading chunk N failed`, a hidratação morre e o usuário vê
 * "Application error: a client-side exception has occurred" — ou uma página com
 * o conteúdo da rota vazio.
 *
 * O script inline (src/lib/recuperacao-build.ts) escuta exatamente esse tipo de
 * falha e recarrega a página uma vez, com trava para não virar laço. Como ele
 * roda antes de qualquer chunk (é inline no HTML), funciona mesmo nos casos em
 * que o React nunca chega a montar — que é o caso em que um `useEffect` não
 * ajudaria em nada.
 */

type Ouvinte = (evento: any) => void;

function carregarScript() {
  const ouvintes: Record<string, Ouvinte[]> = {};
  const recarregar = vi.fn();
  const memoria = new Map<string, string>();
  const avisos: string[] = [];

  const janela = {
    addEventListener: (tipo: string, fn: Ouvinte) => {
      ouvintes[tipo] = ouvintes[tipo] ?? [];
      ouvintes[tipo].push(fn);
    },
  };
  const sessionStorage = {
    getItem: (chave: string) => memoria.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void memoria.set(chave, valor),
  };
  const location = { reload: recarregar };

  new Function('window', 'sessionStorage', 'location', 'console', SCRIPT_RECUPERACAO_BUILD)(
    janela,
    sessionStorage,
    location,
    { warn: (texto: string) => avisos.push(String(texto)) },
  );

  const disparar = (tipo: string, evento: any) => (ouvintes[tipo] ?? []).forEach((fn) => fn(evento));

  return { disparar, recarregar, avisos, memoria };
}

const CHUNK_ANTIGO =
  'https://portal.ifcoding.com.br/_next/static/chunks/app/cadastro/page-17fa5adfcbbb07d3.js';

describe('recuperação de build antigo', () => {
  let relogio: number;

  beforeEach(() => {
    relogio = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => relogio);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recarrega a página quando um chunk do build antigo não carrega', () => {
    const { disparar, recarregar } = carregarScript();

    disparar('error', { target: { src: CHUNK_ANTIGO } });

    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('recarrega também quando o chunk é um <link> (CSS) do build antigo', () => {
    const { disparar, recarregar } = carregarScript();

    disparar('error', {
      target: { href: 'https://portal.ifcoding.com.br/_next/static/css/3add334ee59f67ac.css' },
    });

    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('recarrega em ChunkLoadError entregue como promessa rejeitada', () => {
    const { disparar, recarregar } = carregarScript();

    disparar('unhandledrejection', {
      reason: { name: 'ChunkLoadError', message: 'Loading chunk 9554 failed.' },
    });

    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('recarrega em erro de runtime que cite a falha do chunk', () => {
    const { disparar, recarregar } = carregarScript();

    disparar('error', {
      message: 'Failed to fetch RSC payload. Falling back to browser navigation.',
      error: new Error('ChunkLoadError: Loading chunk 7023 failed.'),
    });

    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('não recarrega por erro comum da aplicação', () => {
    const { disparar, recarregar } = carregarScript();

    disparar('error', { message: 'Cannot read properties of undefined', error: new Error('boom') });
    disparar('unhandledrejection', { reason: { name: 'TypeError', message: 'x is not a function' } });
    disparar('error', { target: { src: 'https://exemplo.com/imagem-quebrada.png' } });

    expect(recarregar).not.toHaveBeenCalled();
  });

  it('não recarrega duas vezes dentro da janela de 30s (evita laço)', () => {
    const { disparar, recarregar } = carregarScript();

    disparar('error', { target: { src: CHUNK_ANTIGO } });
    relogio += 5_000;
    disparar('error', { target: { src: CHUNK_ANTIGO } });

    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('recarrega de novo depois de 30s (falha nova, não laço)', () => {
    const { disparar, recarregar } = carregarScript();

    disparar('error', { target: { src: CHUNK_ANTIGO } });
    relogio += 31_000;
    disparar('error', { target: { src: CHUNK_ANTIGO } });

    expect(recarregar).toHaveBeenCalledTimes(2);
  });

  it('para de recarregar depois de 3 tentativas na mesma sessão', () => {
    const { disparar, recarregar } = carregarScript();

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      disparar('error', { target: { src: CHUNK_ANTIGO } });
      relogio += 31_000;
    }

    expect(recarregar).toHaveBeenCalledTimes(3);
  });

  it('avisa no console antes de recarregar (rastro para quem estiver com o DevTools aberto)', () => {
    const { disparar, avisos } = carregarScript();

    disparar('error', { target: { src: CHUNK_ANTIGO } });

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('page-17fa5adfcbbb07d3.js');
  });
});
