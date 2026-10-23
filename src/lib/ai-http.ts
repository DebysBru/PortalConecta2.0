/** Prazo total inclui leitura da resposta e esperas, não apenas os headers. */
export class AiHttpError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

export async function fetchAiJson(
  url: string, init: RequestInit, options: { timeoutMs?: number; attempts?: number; signal?: AbortSignal; beforeAttempt?: (signal: AbortSignal) => Promise<void> } = {},
): Promise<any> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 30_000);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  const attempts = options.attempts ?? 2;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    signal.throwIfAborted();
    await options.beforeAttempt?.(signal);
    let retryMs = 500 * attempt;
    try {
      const response = await fetch(url, { ...init, signal });
      if (response.ok) return await response.json();
      const transient = response.status === 429 || response.status >= 500;
      if (!transient || attempt === attempts) {
        await response.body?.cancel();
        throw new AiHttpError(`Serviço de IA retornou HTTP ${response.status}`, response.status);
      }
      const after = response.headers.get('retry-after');
      if (after) retryMs = Math.max(retryMs, Number(after) * 1000 || Date.parse(after) - Date.now() || 0);
      await response.body?.cancel();
    } catch (error) {
      if (signal.aborted || error instanceof AiHttpError || error instanceof SyntaxError || attempt === attempts) throw error;
    }
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, retryMs);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }
  throw new AiHttpError('Serviço de IA indisponível');
}
