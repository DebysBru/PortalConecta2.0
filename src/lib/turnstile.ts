/**
 * CAPTCHA (Cloudflare Turnstile) — achado S25 do RELATORIO_TESTES.md ("sem
 * CAPTCHA no cadastro"). Gratuito, sem limite de uso conhecido para sites
 * pequenos. Degrada graciosamente: sem `TURNSTILE_SECRET_KEY` configurada,
 * a verificação sempre passa (mesmo padrão de outras integrações opcionais
 * do projeto, ex.: `src/lib/embeddings.ts` sem `GEMINI_API_KEY`) — então
 * nada quebra até alguém configurar as chaves.
 *
 * Chaves gratuitas em: https://dash.cloudflare.com/?to=/:account/turnstile
 */
export function turnstileConfigurado(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verificarTurnstile(token: string | null | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // não configurado — não bloqueia

  if (!token) return false;

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    const data = await res.json() as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
