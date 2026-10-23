'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { MessageCircle, X, Send, Sparkles, Loader2, Link2, ExternalLink } from 'lucide-react';
import Markdown from 'react-markdown';
import { useAuth } from '@/contexts/AuthContext';
import { EVENTO_ABRIR_CHAT } from '@/lib/ifizinha-chat';
import { rotuloDoLink, type FonteResposta } from '@/lib/fontes-resposta';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  /** Fontes citadas na resposta — exibidas como links para conferência. */
  fontes?: FonteResposta[];
  fontesTipo?: 'citadas' | 'recuperadas';
};

export function ChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Oi! Eu sou a IFizinha! ✨ Posso te ajudar com informações sobre editais, cursos, bolsas, projetos e a vida acadêmica no IFPR Campus Ivaiporã. Sempre que eu responder com base em um documento do campus, deixo o link da fonte logo abaixo — assim você confere tudo no site oficial. O que você quer saber?',
    },
  ]);
  const [state, setState] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Permite abrir o chat de fora do widget (botão "Pergunte à IFizinha" no
  // header) sem transformar isto num contexto global — ver lib/ifizinha-chat.
  useEffect(() => {
    const abrir = () => setIsOpen(true);
    window.addEventListener(EVENTO_ABRIR_CHAT, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_CHAT, abrir);
  }, []);

  const handleSend = async () => {
    if (!user || !input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          message: userMessage, state,
          // Só role/content vai para o servidor — mandar o objeto inteiro
          // levaria a lista de fontes de cada mensagem sem uso nenhum.
          history: messages.slice(-6).map(({ role, content }) => ({ role, content })),
        }),
      });

      const data = await response.json();

      if (data.reply) {
        setState(data.state);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.reply, fontes: Array.isArray(data.fontes) ? data.fontes : [], fontesTipo: data.fontesTipo },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              data.error || 'Não consegui responder agora. Tente novamente em instantes.',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Parece que sua conexão caiu no meio do caminho. Confira a internet e me pergunte de novo.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-gray-600 hover:bg-gray-700 rotate-0'
            : 'bg-hero-gradient hover:shadow-xl hover:scale-110'
        }`}
        aria-label={isOpen ? 'Fechar chat' : 'Abrir chat com IFizinha'}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <div className="relative">
            {/* Avatar da IFizinha no lugar do ícone genérico. O arquivo já vem
                quadrado e otimizado (160x160) — ver public/ifizinha. */}
            <Image
              src="/ifizinha/avatar-chat.webp"
              alt=""
              width={160}
              height={160}
              unoptimized
              aria-hidden
              className="w-14 h-14 rounded-full object-cover"
            />
            <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 border-2 border-white rounded-full animate-pulse" />
          </div>
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: '500px' }}>
          {/* Header */}
          <div className="bg-hero-gradient p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-sm">IFizinha</h3>
              <p className="text-white/70 text-xs">Assistente do Portal Conecta</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-white/70 text-xs">Online</span>
            </div>
          </div>

          {/* Messages */}
          <p className="px-4 pt-3 text-xs text-gray-600">Em fase de testes: até 20 perguntas por hora por conta, com intervalo mínimo de 5 segundos.</p>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-azul-eletrico text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <Markdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li>{children}</li>,
                        h1: ({ children }) => <h1 className="font-bold text-base mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="font-bold text-sm mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="font-bold text-sm mb-1">{children}</h3>,
                        code: ({ children }) => <code className="bg-gray-200 px-1 rounded text-xs">{children}</code>,
                        pre: ({ children }) => <pre className="bg-gray-200 p-2 rounded text-xs overflow-x-auto mb-2">{children}</pre>,
                        a: ({ children, href }) => <a href={href} className="text-azul-eletrico underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-3 italic mb-2">{children}</blockquote>,
                        table: ({ children }) => <table className="border-collapse border border-gray-300 text-xs mb-2 w-full">{children}</table>,
                        thead: ({ children }) => <thead className="bg-gray-200">{children}</thead>,
                        tbody: ({ children }) => <tbody>{children}</tbody>,
                        tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
                        th: ({ children }) => <th className="border border-gray-300 px-2 py-1 text-left font-bold">{children}</th>,
                        td: ({ children }) => <td className="border border-gray-300 px-2 py-1">{children}</td>,
                      }}
                    >
                      {msg.content}
                    </Markdown>
                  ) : (
                    msg.content
                  )}

                  {/* Fontes — o "igual as IA fazem": lista numerada com link
                      para a página oficial de onde a informação saiu. Aparece
                      mesmo quando o modelo esquece de citar no texto, porque a
                      lista é montada no servidor a partir dos trechos que a
                      busca devolveu. */}
                  {msg.role === 'assistant' && msg.fontes && msg.fontes.length > 0 && (
                    <div className="mt-3 border-t border-gray-300/70 pt-2">
                      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        <Link2 className="h-3 w-3" />
                        {msg.fontesTipo === 'recuperadas' ? 'Fontes recuperadas para consulta' : 'Fontes citadas'}
                      </p>
                      <ul className="space-y-1">
                        {msg.fontes.map((fonte) => (
                          <li key={`${fonte.numero}-${fonte.url ?? fonte.titulo}`}>
                            {fonte.url ? (
                              <a
                                href={fonte.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={fonte.titulo}
                                className="group flex items-start gap-1.5 rounded-md px-1 py-0.5 text-[11px] leading-snug text-azul-eletrico hover:bg-blue-50"
                              >
                                <span className="mt-px flex h-4 w-4 flex-shrink-0 items-center justify-center rounded bg-azul-eletrico/10 text-[9px] font-bold">
                                  {fonte.numero}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="line-clamp-2 font-medium group-hover:underline">
                                    {fonte.titulo}
                                  </span>
                                  <span className="flex items-center gap-1 text-[10px] text-gray-500">
                                    {fonte.categoria}
                                    {rotuloDoLink(fonte.url) ? ` · ${rotuloDoLink(fonte.url)}` : ''}
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </span>
                                </span>
                              </a>
                            ) : (
                              <span className="flex items-start gap-1.5 px-1 py-0.5 text-[11px] leading-snug text-gray-500">
                                <span className="mt-px flex h-4 w-4 flex-shrink-0 items-center justify-center rounded bg-gray-200 text-[9px] font-bold text-gray-600">
                                  {fonte.numero}
                                </span>
                                <span className="min-w-0 flex-1">{fonte.titulo}</span>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-[10px] leading-snug text-gray-400">
                        Confira sempre na fonte oficial antes de se inscrever.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-100">
            {!user && <p className="mb-2 text-sm text-gray-700"><a href="/admin/login" className="font-semibold text-azul-eletrico underline">Entre na sua conta</a> para perguntar à IFizinha.</p>}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Pergunte sobre editais, cursos, bolsas..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico focus:border-transparent"
                disabled={!user || isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!user || !input.trim() || isLoading}
                aria-label="Enviar pergunta"
                className="w-10 h-10 rounded-xl bg-azul-eletrico text-white flex items-center justify-center hover:bg-azul-eletrico/90 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2">
              Respostas com base nos documentos oficiais do campus — com link da fonte.{' '}
              <a
                href="/ifizinha/conteudos"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-azul-eletrico"
              >
                Ver tudo o que eu conheço
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
