'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import { MascoteIFizinha } from '@/components/ifizinha/MascoteIFizinha';

type Mensagem = { role: 'user' | 'assistant'; content: string };

const SAUDACAO =
  'Oi! Eu sou a IFizinha! Posso te ajudar com informações sobre editais, projetos, eventos e muito mais. O que você quer saber?';

/** Perguntas de partida — a ideia é o visitante não ficar sem saber o que pedir. */
const SUGESTOES = [
  'Quais editais estão abertos?',
  'Tem bolsa para estudante?',
  'O que acontece essa semana?',
];

/**
 * Bloco "Pergunte pra IFizinha" da home: um chat embutido na própria página.
 *
 * Usa o MESMO endpoint do chat flutuante (`/api/chat`) e o mesmo formato de
 * histórico, então as duas portas levam à mesma assistente — não existe uma
 * segunda IA nem uma segunda base de resposta.
 *
 * O título e o subtítulo saem do `siteConfig` (`ifizinha_titulo` /
 * `ifizinha_descricao`), que já alimentavam o CTA antigo desta posição: quem
 * tiver trocado o texto no painel continua com o texto dele no ar.
 */
export function PergunteIFizinha({ config = {} }: { config?: Record<string, any> }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([{ role: 'assistant', content: SAUDACAO }]);
  const [entrada, setEntrada] = useState('');
  const [carregando, setCarregando] = useState(false);
  const fimDaLista = useRef<HTMLDivElement>(null);
  const caixaDeMensagens = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mensagens.length > 1) {
      caixaDeMensagens.current?.scrollTo({ top: caixaDeMensagens.current.scrollHeight, behavior: 'smooth' });
    }
  }, [mensagens]);

  const enviar = async (texto?: string) => {
    const pergunta = (texto ?? entrada).trim();
    if (!pergunta || carregando) return;

    const historico: Mensagem[] = [...mensagens, { role: 'user', content: pergunta }];
    setMensagens(historico);
    setEntrada('');
    setCarregando(true);

    try {
      const resposta = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: pergunta, history: mensagens.slice(-6) }),
      });
      const dados = await resposta.json();
      setMensagens([
        ...historico,
        {
          role: 'assistant',
          content:
            dados.reply ||
            'Não consegui responder agora. Tente reformular a pergunta ou envie de novo em alguns instantes.',
        },
      ]);
    } catch {
      setMensagens([
        ...historico,
        { role: 'assistant', content: 'Tive um problema para responder agora. Tente de novo em instantes.' },
      ]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <section className="relative overflow-hidden bg-roxo-50/60 py-16">
      <div className="container relative mx-auto max-w-7xl px-4">
        {/* Título centralizado, como no mockup */}
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-3xl font-black text-gray-900 md:text-4xl">
            {config.ifizinha_titulo || 'Pergunte pra IFizinha'}
          </h2>
          <p className="mt-2 text-gray-600">
            {config.ifizinha_descricao ||
              'Tem alguma dúvida? Pergunte pra IFizinha! Ela explica tudo de forma simples e direta.'}
          </p>
        </div>

        <div className="grid items-end gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {/* Mascote deitada: aparece inteira (é uma pose deitada — cortar a
              lateral deceparia as pernas) e encosta na borda esquerda. */}
          <div className="hidden lg:block">
            <div className="-ml-6 xl:-ml-10">
              <MascoteIFizinha nome="chat" className="drop-shadow-[0_18px_30px_rgba(15,23,42,0.12)]" />
            </div>
          </div>

          {/* Chat */}
          <div className="rounded-3xl border border-white bg-white/90 p-5 shadow-xl backdrop-blur md:p-6">
            <div
              ref={caixaDeMensagens}
              className="max-h-64 space-y-4 overflow-y-auto pr-1"
              aria-live="polite"
            >
              {mensagens.map((msg, i) => (
                <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex gap-3'}>
                  {msg.role === 'assistant' && (
                    <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-hero-gradient">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={
                      msg.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-tr-sm bg-azul-eletrico px-4 py-2.5 text-sm text-white'
                        : 'max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2.5 text-sm text-gray-700 [&_a]:text-azul-eletrico [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold'
                    }
                  >
                    {msg.role === 'assistant' ? <Markdown>{msg.content}</Markdown> : msg.content}
                  </div>
                </div>
              ))}

              {carregando && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  A IFizinha está escrevendo…
                </div>
              )}
              <div ref={fimDaLista} />
            </div>

            {/* Perguntas sugeridas */}
            <div className="mt-5 flex flex-wrap gap-2">
              {SUGESTOES.map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => enviar(sugestao)}
                  disabled={carregando}
                  className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-all hover:border-azul-eletrico/40 hover:text-azul-eletrico disabled:opacity-50"
                >
                  {sugestao}
                </button>
              ))}
            </div>

            {/* Campo de pergunta */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void enviar();
              }}
              className="mt-4 flex items-center gap-2"
            >
              <label htmlFor="pergunta-ifizinha" className="sr-only">
                Digite sua pergunta para a IFizinha
              </label>
              <input
                id="pergunta-ifizinha"
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                placeholder="Digite sua pergunta aqui…"
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:border-azul-eletrico/40 focus:outline-none focus:ring-2 focus:ring-azul-eletrico/20"
              />
              <button
                type="submit"
                disabled={carregando || !entrada.trim()}
                aria-label="Enviar pergunta"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-azul-eletrico text-white transition-all hover:bg-azul-600 disabled:opacity-50"
              >
                {carregando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </form>

            <p className="mt-3 text-center text-xs text-gray-400">
              A IFizinha responde com base nos dados do portal. Confira sempre o edital oficial.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
