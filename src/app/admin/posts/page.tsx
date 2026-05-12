'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, X, Newspaper, AlertCircle } from 'lucide-react';
import { listPosts, createPost, updatePost, deletePost, listProjetos, type PostFormData } from '@/actions/admin';
import { useAuth } from '@/contexts/AuthContext';

type Post = Awaited<ReturnType<typeof listPosts>>[number];
type Projeto = Awaited<ReturnType<typeof listProjetos>>[number];

const EMPTY: PostFormData = { titulo: '', conteudo: '', resumo: '', imagemUrl: '', status: 'RASCUNHO', projetoId: '' };

export default function AdminPostsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [form, setForm] = useState<PostFormData>(EMPTY);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const load = () => {
    listPosts().then(setPosts).catch(console.error);
    listProjetos().then(setProjetos).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, projetoId: projetos[0]?.id ?? '' });
    setError(''); setPanelOpen(true);
  };

  const openEdit = (post: Post) => {
    setEditing(post);
    setForm({ titulo: post.titulo, conteudo: post.conteudo, resumo: post.resumo ?? '', imagemUrl: post.imagemUrl ?? '', status: post.status, projetoId: post.projetoId });
    setError(''); setPanelOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este post?')) return;
    startTransition(async () => {
      const r = await deletePost(id);
      if (r.ok) load(); else setError(r.error);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    startTransition(async () => {
      const r = editing ? await updatePost(editing.id, form) : await createPost(form, user!.email!);
      if (r.ok) { setPanelOpen(false); load(); } else setError(r.error);
    });
  };

  const set = (field: keyof PostFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Posts</h1>
          <p className="text-gray-500 text-sm">{posts.length} post(s) cadastrado(s)</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-ciano-claro text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-ciano-claro/90 transition-all text-sm shadow-sm">
          <Plus className="w-4 h-4" /> Novo Post
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {posts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum post cadastrado ainda</p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-gray-50">
              {posts.map((p) => (
                <div key={p.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{p.titulo}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-xs text-gray-500 truncate max-w-[140px]">{p.projeto.nome}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${p.status === 'PUBLICADO' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {p.status === 'PUBLICADO' ? 'Publicado' : 'Rascunho'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-azul-eletrico transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Título</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Projeto</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{p.titulo}</td>
                      <td className="px-4 py-3 text-gray-500">{p.projeto.nome}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${p.status === 'PUBLICADO' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {p.status === 'PUBLICADO' ? 'Publicado' : 'Rascunho'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-azul-eletrico transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setPanelOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editing ? 'Editar Post' : 'Novo Post'}</h2>
              <button onClick={() => setPanelOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                <div>
                  <label className="label-field">Título <span className="text-red-500">*</span></label>
                  <input className="input-field" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required />
                </div>
                <div>
                  <label className="label-field">Projeto <span className="text-red-500">*</span></label>
                  <select className="input-field" value={form.projetoId} onChange={(e) => set('projetoId', e.target.value)} required>
                    <option value="">Selecione um projeto</option>
                    {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-field">Conteúdo <span className="text-red-500">*</span></label>
                  <textarea className="input-field min-h-[160px] resize-y" value={form.conteudo} onChange={(e) => set('conteudo', e.target.value)} required />
                </div>
                <div>
                  <label className="label-field">Resumo</label>
                  <textarea className="input-field min-h-[72px] resize-none" value={form.resumo ?? ''} onChange={(e) => set('resumo', e.target.value)} />
                </div>
                <div>
                  <label className="label-field">URL da imagem</label>
                  <input type="url" className="input-field" value={form.imagemUrl ?? ''} onChange={(e) => set('imagemUrl', e.target.value)} />
                </div>
                <div>
                  <label className="label-field">Status</label>
                  <select className="input-field" value={form.status} onChange={(e) => set('status', e.target.value as PostFormData['status'])}>
                    <option value="RASCUNHO">Rascunho</option>
                    <option value="PUBLICADO">Publicado</option>
                  </select>
                </div>
                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}
              </div>
              <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex gap-3">
                <button type="button" onClick={() => setPanelOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">Cancelar</button>
                <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-ciano-claro text-white font-semibold text-sm hover:bg-ciano-claro/90 transition-all disabled:opacity-60">
                  {isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
