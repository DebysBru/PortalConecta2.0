'use client';

import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { VISAO_PADRAO, VISOES, parseVisao } from '@/lib/visao';

/**
 * "Ver como": deixa o Administrador navegar como Aluno, Professor ou Admin
 * (padrão) sem trocar de e-mail. Só aparece para o papel ADMIN real; some para
 * todos os outros. É uma troca de interface — ver `src/lib/visao.ts`.
 */
export function SeletorDeVisao({ tom = 'claro', className }: { tom?: 'claro' | 'escuro'; className?: string }) {
  const { userRole, visao, mudarVisao } = useAuth();
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (userRole !== 'ADMIN') return null;

  const emTeste = visao !== VISAO_PADRAO;

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTrocando(true);
    setErro(null);
    try {
      const res = await mudarVisao(parseVisao(e.target.value));
      if (!res.ok) setErro(res.error);
    } finally {
      setTrocando(false);
    }
  };

  return (
    <label
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold',
        tom === 'escuro'
          ? emTeste
            ? 'bg-dourado-500/25 text-white'
            : 'bg-white/10 text-white/80'
          : emTeste
            ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
            : 'bg-gray-100 text-gray-600',
        className,
      )}
      title="Escolha como ver o portal. Só muda a interface: suas permissões de admin continuam valendo."
    >
      <Eye className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="sr-only">Ver o portal como</span>
      <select
        value={visao}
        onChange={onChange}
        disabled={trocando}
        aria-label="Ver o portal como"
        className={cn(
          'min-w-0 cursor-pointer bg-transparent text-xs font-semibold outline-none disabled:opacity-60',
          tom === 'escuro' && '[&>option]:text-gray-900',
        )}
      >
        {VISOES.map((v) => (
          <option key={v.valor} value={v.valor}>
            {v.rotulo}
          </option>
        ))}
      </select>
      {erro && <span className="sr-only" role="alert">{erro}</span>}
    </label>
  );
}
