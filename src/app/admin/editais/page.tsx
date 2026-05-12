'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, X, FileText, AlertCircle } from 'lucide-react';
import {
  listEditais, createEdital, updateEdital, deleteEdital,
  type EditalFormData,
} from '@/actions/admin';
import { useAuth } from '@/contexts/AuthContext';
import { getStatusLabel, getCategoryColor, getStatusColor, formatDateShort } from '@/lib/utils';

type Edital = Awaited<ReturnType<typeof listEditais>>[number];

const CATEGORIAS = ['BOLSAS','AUXILIOS','EXTENSAO','PESQUISA','ENSINO','EVENTOS','ESTAGIOS','RESULTADOS'];
const STATUS_LIST = ['ATIVO','ENCERRA_BREVE','ENCERRADO','RESULTADO_PUBLICADO'];

const EMPTY_FORM: EditalFormData = {
  titulo: '', categoria: 'BOLSAS', resumo: '', dataEncerramento: '',
  status: 'ATIVO', linkOficial: '', arquivoPdfUrl: '', destaque: false,
  traducaoIFizinha: { oquee: '', quempode: '', beneficios: '', documentos: '', comoinscrever: '', prazo: '', observacoes: '' },
};

export default function AdminEditaisPage() {
  const { user } = useAuth();
  const [editais, setEditais] = useState<Edital[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Edital | null>(null);
  const [form, setForm] = useState<EditalFormData>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<'info' | 'ifizinha'>('info');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const load = () => listEditais().then(setEditais).catch(console.error);
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setActiveTab('info');
    setError('');
    setPanelOpen(true);
  };

  const openEdit = (edital: Edital) => {
    setEditing(edital);
    const trad = edital.traducaoIFizinha as EditalFormData['traducaoIFizinha'];
    setForm({
      titulo: edital.titulo,
      categoria: edital.categoria,
      resumo: edital.resumo,
      dataEncerramento: edital.dataEncerramento.toISOString().split('T')[0],
      status: edital.status,
      linkOficial: edital.linkOficial,
      arquivoPdfUrl: edital.arquivoPdfUrl ?? '',
      destaque: edital.destaque,
      traducaoIFizinha: trad ?? EMPTY_FORM.traducaoIFizinha,
    });
    setActiveTab('info');
    setError('');
    setPanelOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este edital permanentemente?')) return;
    startTransition(async () => {
      const result = await deleteEdital(id);
      if (result.ok) load();
      else setError(result.error);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const result = editing
        ? await updateEdital(editing.id, form)
        : await createEdital(form, user!.email!);
      if (result.ok) { setPanelOpen(false); load(); }
      else setError(result.error);
    });
  };

  const setTrad = (field: string, value: string) =>
    setForm((f) => ({ ...f, traducaoIFizinha: { ...f.traducaoIFizinha, [field]: value } }));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Editais</h1>
          <p className="text-gray-500 text-sm">{editais.length} edital(is) cadastrado(s)</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-azul-eletrico text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-azul-eletrico/90 transition-all text-sm shadow-sm">
          <Plus className="w-4 h-4" /> Novo Edital
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {editais.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum edital cadastrado ainda</p>
            <p className="text-sm mt-1">Clique em "Novo Edital" para começar</p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-gray-50">
              {editais.map((e) => (
                <div key={e.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{e.titulo}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getCategoryColor(e.categoria)}`}>
                        {getStatusLabel(e.categoria)}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(e.status)}`}>
                        {getStatusLabel(e.status)}
                      </span>
                      <span className="text-xs text-gray-400">{formatDateShort(e.dataEncerramento)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    <button onClick={() => openEdit(e)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-azul-eletrico transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(e.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
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
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Categoria</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Encerramento</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {editais.map((e) => (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{e.titulo}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getCategoryColor(e.categoria)}`}>
                          {getStatusLabel(e.categoria)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(e.status)}`}>
                          {getStatusLabel(e.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDateShort(e.dataEncerramento)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-azul-eletrico transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
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

      {/* Slide-in panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setPanelOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editing ? 'Editar Edital' : 'Novo Edital'}</h2>
              <button onClick={() => setPanelOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              {(['info', 'ifizinha'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-1 mr-6 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-azul-eletrico text-azul-eletrico'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab === 'info' ? 'Informações' : '✨ Versão IFizinha'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                {activeTab === 'info' ? (
                  <>
                    <Field label="Título" required>
                      <input className="input-field" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} required />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Categoria" required>
                        <select className="input-field" value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as EditalFormData['categoria'] }))}>
                          {CATEGORIAS.map((c) => <option key={c} value={c}>{getStatusLabel(c)}</option>)}
                        </select>
                      </Field>
                      <Field label="Status" required>
                        <select className="input-field" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EditalFormData['status'] }))}>
                          {STATUS_LIST.map((s) => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field label="Resumo" required>
                      <textarea className="input-field min-h-[80px] resize-none" value={form.resumo} onChange={(e) => setForm((f) => ({ ...f, resumo: e.target.value }))} required />
                    </Field>
                    <Field label="Data de Encerramento" required>
                      <input type="date" className="input-field" value={form.dataEncerramento} onChange={(e) => setForm((f) => ({ ...f, dataEncerramento: e.target.value }))} required />
                    </Field>
                    <Field label="Link Oficial" required>
                      <input type="url" className="input-field" value={form.linkOficial} onChange={(e) => setForm((f) => ({ ...f, linkOficial: e.target.value }))} required />
                    </Field>
                    <Field label="URL do PDF (opcional)">
                      <input type="url" className="input-field" value={form.arquivoPdfUrl ?? ''} onChange={(e) => setForm((f) => ({ ...f, arquivoPdfUrl: e.target.value }))} />
                    </Field>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.destaque ?? false} onChange={(e) => setForm((f) => ({ ...f, destaque: e.target.checked }))} className="w-4 h-4 accent-azul-eletrico" />
                      <span className="text-sm font-medium text-gray-700">Destacar na homepage</span>
                    </label>
                  </>
                ) : (
                  <>
                    {[
                      { key: 'oquee',        label: 'O que é esse edital?' },
                      { key: 'quempode',     label: 'Quem pode se inscrever?' },
                      { key: 'beneficios',   label: 'Quais os benefícios?' },
                      { key: 'documentos',   label: 'Quais documentos preciso?' },
                      { key: 'comoinscrever', label: 'Como me inscrevo?' },
                      { key: 'prazo',        label: 'Qual o prazo?' },
                      { key: 'observacoes',  label: 'Observações (opcional)' },
                    ].map(({ key, label }) => (
                      <Field key={key} label={label}>
                        <textarea
                          className="input-field min-h-[72px] resize-none"
                          value={(form.traducaoIFizinha as Record<string, string>)[key] ?? ''}
                          onChange={(e) => setTrad(key, e.target.value)}
                        />
                      </Field>
                    ))}
                  </>
                )}

                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex gap-3">
                <button type="button" onClick={() => setPanelOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-azul-eletrico text-white font-semibold text-sm hover:bg-azul-eletrico/90 transition-all disabled:opacity-60">
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-field">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}
