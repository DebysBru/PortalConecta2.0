'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

/**
 * Widget do Cloudflare Turnstile (CAPTCHA). Se `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
 * não estiver configurada, não renderiza nada — o formulário segue
 * funcionando sem CAPTCHA (ver src/lib/turnstile.ts).
 */
export function TurnstileWidget({ onVerify }: { onVerify: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    if (window.turnstile) {
      setScriptLoaded(true);
      return;
    }
    const existing = document.querySelector('script[data-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => setScriptLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = 'true';
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey || !scriptLoaded || !containerRef.current || !window.turnstile) return;
    window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token) => onVerify(token),
      'expired-callback': () => onVerify(null),
      'error-callback': () => onVerify(null),
    });
  }, [siteKey, scriptLoaded, onVerify]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="my-1" />;
}
