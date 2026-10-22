'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowLeft, ExternalLink, FileText, ImagePlus, Loader2, Palette, Save, Trash2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPaginaDoProjeto,
  salvarPaginaDoProjeto,
  type PaginaProjetoFormData,
} from '@/actions/professor';
import { enviarArquivo } from '@/lib/upload-midia';
import { useToast } from '@/components/ui/toast';

/**
 * Editor da APRESENTAÇÃO da página do projeto.
 *
 * Acessível ao coordenador/vice E ao aluno nomeado gestor da página. De
 * propósito só existem aqui os campos de apresentação: coordenador, situação,
 * dados do SUAP, vagas, inscrições e exclusão continuam fora deste formulário
 * (e são bloqueados no servidor também).
 */
export default function PaginaDoProjetoPage({ params }: { params: { id: string } }) {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const inputLogo = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [form, setForm] = useState<PaginaProjetoFormData>({
    resumoCurto: '',
    descricao: '',
    logoUrl: '',
    corPrimaria: '#2F52D3',
    email: '',
    instagram: '',
    site: '',
  });

  const somenteGestor = userRole === 'ESTUDANTE';

  useEffect(() => {
    if (!user?.email) return;
    getPaginaDoProjeto(params.id, user.email)
      .then((p) => {
        if (!p) {
          setErro('Você não tem acesso à edição desta página.');
          return;
        }
        setNome(p.nome);
        setSlug(p.slug);
        setForm({
          resumoCurto: p.resumoCurto ?? '',
          descricao: p.descricao ?? '',
          logoUrl: p.logoUrl ?? '',
          corPrimaria: p.corPrimaria ?? '#2F52D3',
          email: p.email ?? '',
          instagram: p.instagram ?? '',
          site: p.site ?? '',
        });
      })
      .catch(() => setErro('Não conseguimos carregar esta página. Tente novamente.'))
      .finally(() => setCarregando(false));
  }, [params.id, user]);

  const atualizar = (campo: keyof PaginaProjetoFormData, valor: string) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  const enviarLogo = async (arquivo: File | null) => {
    if (!arquivo) return;
    setErro('');
    if (!user) {
      setErro('Sua sessão expirou. Entre novamente para enviar a imagem.');
      return;
    }
    setEnviandoLogo(true);
    try {
      const idToken = await user.getIdToken();
      const resultado = await enviarArquivo({ arquivo, idToken, subpasta: params.id });
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      atualizar('logoUrl', resultado.data.url);
      toast('Logo enviada. Clique em Salvar para publicar.', 'success');
    } catch {
      setErro('Não conseguimos enviar a imagem agora. Tente novamente.');
    } finally {
      setEnviandoLogo(false);
      if (inputLogo.current) inputLogo.current.value = '';
    }
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setSalvando(true);
    setErro('');
    try {
      const resultado = await salvarPaginaDoProjeto(params.id, form, user.email);
      if (resultado.ok) {
        toast('Página atualizada.', 'success');
      } else {
        setErro(resultado.error);
      }
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return <div className="py-20 text-center text-sm text-gray-500">Carregando página...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={somenteGestor ? '/professor/projetos' : `/professor/projetos/${params.id}`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {somenteGestor ? 'Projetos que gerencio' : 'Voltar ao projeto'}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Página do projeto</h1>
          <p className="text-gray-500 text-sm mt-1">
            {nome ? `Apresentação pública de “${nome}”` : 'Apresentação pública do projeto'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/professor/projetos/${params.id}/posts`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Posts
          </Link>
          {slug && (
            <Link
              href={`/projetos/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ver no portal
            </Link>
          )}
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {erro}
        </div>
      )}

      <form onSubmit={salvar} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <div>
          <label className="label-field">Resumo para os cards</label>
          <input
            className="input-field"
            maxLength={200}
            value={form.resumoCurto ?? ''}
            onChange={(e) => atualizar('resumoCurto', e.target.value)}
            placeholder="Uma frase curta que aparece no card do projeto"
          />
          <p className="text-xs text-gray-400 mt-1">{(form.resumoCurto ?? '').length}/200 caracteres</p>
        </div>

        <div>
          <label className="label-field">Descrição da página</label>
          <textarea
            className="input-field min-h-[160px] resize-y"
            maxLength={8000}
            value={form.descricao ?? ''}
            onChange={(e) => atualizar('descricao', e.target.value)}
            placeholder="Conte o que o projeto faz, para quem e como participar."
          />
        </div>

        <div>
          <label className="label-field">Logo do projeto</label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="Logo do projeto" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-7 h-7 text-gray-300" />
              )}
            </div>
            <input
              ref={inputLogo}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0] ?? null;
                e.target.value = '';
                void enviarLogo(arquivo);
              }}
            />
            <button
              type="button"
              onClick={() => inputLogo.current?.click()}
              disabled={enviandoLogo}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {enviandoLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {enviandoLogo ? 'Enviando...' : form.logoUrl ? 'Trocar logo' : 'Enviar logo'}
            </button>
            {form.logoUrl && (
              <button
                type="button"
                onClick={() => atualizar('logoUrl', '')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">PNG, JPG, WEBP ou GIF. O arquivo fica no storage do portal.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Cor principal</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-10 h-10 rounded-lg border border-gray-200 p-0.5 cursor-pointer"
                value={/^#[0-9a-f]{6}$/i.test(form.corPrimaria ?? '') ? form.corPrimaria : '#2F52D3'}
                onChange={(e) => atualizar('corPrimaria', e.target.value)}
              />
              <input
                className="input-field uppercase font-mono"
                value={form.corPrimaria ?? ''}
                onChange={(e) => atualizar('corPrimaria', e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Palette className="w-3 h-3" /> Usada no cabeçalho da página.
            </p>
          </div>
          <div>
            <label className="label-field">E-mail de contato</label>
            <input
              type="email"
              className="input-field"
              value={form.email ?? ''}
              onChange={(e) => atualizar('email', e.target.value)}
              placeholder="contato@projeto.com"
            />
          </div>
          <div>
            <label className="label-field">Instagram</label>
            <input
              className="input-field"
              value={form.instagram ?? ''}
              onChange={(e) => atualizar('instagram', e.target.value)}
              placeholder="@usuario"
            />
          </div>
          <div>
            <label className="label-field">Site</label>
            <input
              type="url"
              className="input-field"
              value={form.site ?? ''}
              onChange={(e) => atualizar('site', e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-azul-eletrico text-white text-sm font-semibold hover:bg-azul-eletrico/90 disabled:opacity-60 transition-colors"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {salvando ? 'Salvando...' : 'Salvar página'}
          </button>
        </div>
      </form>
    </div>
  );
}
