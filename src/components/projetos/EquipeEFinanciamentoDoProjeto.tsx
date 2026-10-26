'use client';

import React from 'react';
import { ListaDeTextosEditor } from '@/components/ui/ListaDeTextosEditor';
import { FINANCIAMENTOS_SUGERIDOS, LIMITES_EQUIPE } from '@/lib/projetos-equipe';

/**
 * Campos da equipe de estudantes e do financiamento do projeto — a fonte única
 * usada no painel do professor e no painel do admin.
 *
 * Fica junto do resumo na página pública (ver `/projetos/[slug]`): é o que
 * mostra ao visitante que o projeto já tem estudantes atuando — o que motiva
 * os demais a se inscrever — e de onde vem o recurso que o sustenta.
 *
 * Os nomes são digitados pela coordenação, não derivados das inscrições: só
 * aparece quem a coordenação cadastrou (e quem concordou em ser exibido). O
 * portal não publica inscrito automaticamente.
 */

export type EquipeEFinanciamentoValores = {
  estudantesBolsistas?: string[] | null;
  estudantesVoluntarios?: string[] | null;
  financiamento?: string[] | null;
};

export type CampoDaEquipe = keyof EquipeEFinanciamentoValores;

export function EquipeEFinanciamentoDoProjeto({
  valores,
  onChange,
}: {
  valores: EquipeEFinanciamentoValores;
  onChange: (campo: CampoDaEquipe, valor: string[]) => void;
}) {
  return (
    <>
      <div className="border-b pb-2">
        <h3 className="text-sm font-bold text-gray-900">Estudantes do Projeto</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Quem já atua no projeto aparece na página pública, logo abaixo do resumo — ver a equipe
          formada motiva outros estudantes a se inscrever. Cadastre só quem concordou em ter o nome
          divulgado.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ListaDeTextosEditor
          rotulo="Bolsistas"
          valores={valores.estudantesBolsistas}
          onChange={(v) => onChange('estudantesBolsistas', v)}
          placeholder="Nome do estudante bolsista"
          maxItens={LIMITES_EQUIPE.estudantes.maxItens}
          maxItem={LIMITES_EQUIPE.estudantes.maxItem}
        />
        <ListaDeTextosEditor
          rotulo="Voluntários"
          valores={valores.estudantesVoluntarios}
          onChange={(v) => onChange('estudantesVoluntarios', v)}
          placeholder="Nome do estudante voluntário"
          maxItens={LIMITES_EQUIPE.estudantes.maxItens}
          maxItem={LIMITES_EQUIPE.estudantes.maxItem}
        />
      </div>

      <div className="border-b pb-2 pt-2">
        <h3 className="text-sm font-bold text-gray-900">Financiamento</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          De onde vem o recurso do projeto. As fontes cadastradas aparecem como selos junto ao
          resumo (ex.: IFPR, CNPq, Fundação Araucária, emenda parlamentar).
        </p>
      </div>

      <ListaDeTextosEditor
        rotulo="Fontes financiadoras"
        valores={valores.financiamento}
        onChange={(v) => onChange('financiamento', v)}
        placeholder="Outra fonte (ex.: PIBEX, edital interno)"
        sugestoes={FINANCIAMENTOS_SUGERIDOS}
        maxItens={LIMITES_EQUIPE.financiamento.maxItens}
        maxItem={LIMITES_EQUIPE.financiamento.maxItem}
      />
    </>
  );
}
