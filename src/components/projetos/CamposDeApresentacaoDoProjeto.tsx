'use client';

import React from 'react';
import { CampoMidiaProjeto } from '@/components/ui/CampoMidiaProjeto';

/**
 * Campos de apresentação do projeto compartilhados entre o painel do professor
 * e o painel do admin.
 *
 * Antes cada tela tinha sua própria cópia: o professor conseguia enviar logo e
 * capa, o admin só conseguia colar uma URL e não tinha o resumo curto. Toda
 * mudança de campo precisava ser feita duas vezes — e uma das telas ficava
 * velha. Esta é a fonte única para descrição, resumo, logo, capa, cor e
 * contatos; cada painel decide apenas quando renderizar.
 */

export type CamposDeApresentacaoValores = {
  resumoCurto?: string | null;
  descricao?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  corPrimaria?: string | null;
  email?: string | null;
  instagram?: string | null;
  site?: string | null;
};

export type CampoDeApresentacao = keyof CamposDeApresentacaoValores;

export function CamposDeApresentacaoDoProjeto({
  nome,
  valores,
  onChange,
  subpasta,
}: {
  nome: string;
  valores: CamposDeApresentacaoValores;
  onChange: (campo: CampoDeApresentacao, valor: string) => void;
  subpasta?: string;
}) {
  const valor = (campo: CampoDeApresentacao) => valores[campo] ?? '';

  return (
    <>
      <div>
        <label className="label-field">
          Resumo curto
          <span className="text-gray-400 font-normal text-xs ml-1">(opcional, até 200 caracteres)</span>
        </label>
        <input
          className="input-field"
          maxLength={200}
          value={valor('resumoCurto')}
          onChange={(e) => onChange('resumoCurto', e.target.value)}
          placeholder="Uma frase curta que aparece no card do projeto"
        />
      </div>

      <div>
        <label className="label-field">Descrição</label>
        <textarea
          className="input-field min-h-[100px] resize-y"
          value={valor('descricao')}
          onChange={(e) => onChange('descricao', e.target.value)}
          placeholder="Conte o que o projeto faz, para quem e como participar."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <CampoMidiaProjeto
          tipo="logo"
          nome={nome}
          valor={valor('logoUrl')}
          corPrimaria={valor('corPrimaria') || '#2F52D3'}
          subpasta={subpasta}
          onChange={(url) => onChange('logoUrl', url)}
        />
        <CampoMidiaProjeto
          tipo="capa"
          nome={nome}
          valor={valor('bannerUrl')}
          corPrimaria={valor('corPrimaria') || '#2F52D3'}
          subpasta={subpasta}
          onChange={(url) => onChange('bannerUrl', url)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label-field">Cor principal</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="w-10 h-10 rounded-lg border border-gray-200 p-0.5 cursor-pointer shrink-0"
              value={/^#[0-9a-f]{6}$/i.test(valor('corPrimaria')) ? valor('corPrimaria') : '#2F52D3'}
              onChange={(e) => onChange('corPrimaria', e.target.value)}
            />
            <input
              className="input-field uppercase font-mono"
              value={valor('corPrimaria')}
              onChange={(e) => onChange('corPrimaria', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label-field">E-mail</label>
          <input
            type="email"
            className="input-field"
            value={valor('email')}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="contato@projeto.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label-field">Instagram</label>
          <input
            className="input-field"
            value={valor('instagram')}
            onChange={(e) => onChange('instagram', e.target.value)}
            placeholder="@usuario"
          />
        </div>
        <div>
          <label className="label-field">Site</label>
          <input
            type="text"
            inputMode="url"
            className="input-field"
            value={valor('site')}
            onChange={(e) => onChange('site', e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>
    </>
  );
}
