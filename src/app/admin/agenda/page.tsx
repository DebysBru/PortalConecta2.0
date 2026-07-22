'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, X, Calendar, AlertCircle } from 'lucide-react';
import { listEventos, createEvento, updateEvento, deleteEvento, type EventoFormData } from '@/actions/admin';
import { useAuth } from '@/contexts/AuthContext';
import { getStatusLabel, formatDateShort } from '@/lib/utils';

type Evento = Awaited<ReturnType<typeof listEventos>>[number];

const TIPOS = ['PRAZO_EDITAL','EVENTO_CAMPUS','EVENTO_PROJETO','REUNIAO','PALESTRA'];

const EMPTY: EventoFormData = {
  titulo: '', data: '', tipo: 'EVENTO_CAMPUS',
  descricao: '', dataFim: '', local: '', linkInscr: '', editalSlug: '',
};

export default function AdminAgendaPage() {
  const { user, userRole, isMasterAdmin } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Evento | null>(null);
  const [form, setForm] = useState<EventoFormData>(EMPTY);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const isMaster = userRole === 'ADMIN' || isMasterAdmin;

  if (!isMaster) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-gray-500">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const load = () => listEventos().then(setEventos).catch(console.error);
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setError(''); setPanelOpen(true); };
  const openEdit = (ev: Evento) => {
    setEditing(ev);
    setForm({
      titulo: ev.titulo,
      data: ev.data.toISOString().split('T')[0],
      tipo: ev.tipo,
      descricao: ev.descricao ?? '',
      dataFim: ev.dataFim ? ev.dataFim.toISOString().split('T')[0] : '',
      local: ev.local ?? '',
      linkInscr: ev.linkInscr ?? '',
      editalSlug: ev.editalSlug ?? '',
    });
    setError(''); setPanelOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este evento?')) return;
    startTransition(async () => {
      const r = await deleteEvento(id);
      if (r.ok) load(); else setError(r.error);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    startTransition(async () => {
      const r = editing ? await updateEvento(editing.id, form) : await createEvento(form, user!.email!);
      if (r.ok) { setPanelOpen(false); load(); } else setError(r.error);
    });
  };

  const set = (field: keyof EventoFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Agenda</h1>
          <p className="text-gray-500 text-sm">{eventos.length} evento(s) cadastrado(s)</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-rosa-vibrante text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-rosa-vibrante/90 transition-all text-sm shadow-sm">
          <Plus className="w-4 h-4" /> Novo Evento
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {eventos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum evento cadastrado ainda</p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {eventos.map((ev) => (
              <div key={ev.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="w-12 h-12 bg-rosa-vibrante/10 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                  <p className="text-lg font-black text-rosa-vibrante leading-none">{ev.data.getDate().toString().padStart(2,'0')}</p>
                  <p className="text-xs text-rosa-vibrante/70 font-medium uppercase">{ev.data.toLocaleString('pt-BR',{month:'short'})}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{ev.titulo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{getStatusLabel(ev.tipo)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(ev)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-azul-eletrico transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(ev.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setPanelOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editing ? 'Editar Evento' : 'Novo Evento'}</h2>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">Data <span className="text-red-500">*</span></label>
                    <input type="date" className="input-field" value={form.data} onChange={(e) => set('data', e.target.value)} required />
                  </div>
                  <div>
                    <label className="label-field">Data Fim</label>
                    <input type="date" className="input-field" value={form.dataFim ?? ''} onChange={(e) => set('dataFim', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label-field">Tipo <span className="text-red-500">*</span></label>
                  <select className="input-field" value={form.tipo} onChange={(e) => set('tipo', e.target.value as EventoFormData['tipo'])}>
                    {TIPOS.map((t) => <option key={t} value={t}>{getStatusLabel(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-field">Descrição</label>
                  <textarea className="input-field min-h-[72px] resize-none" value={form.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} />
                </div>
                <div>
                  <label className="label-field">Local</label>
                  <input className="input-field" value={form.local ?? ''} onChange={(e) => set('local', e.target.value)} />
                </div>
                <div>
                  <label className="label-field">Link de Inscrição</label>
                  <input type="url" className="input-field" value={form.linkInscr ?? ''} onChange={(e) => set('linkInscr', e.target.value)} />
                </div>
                <div>
                  <label className="label-field">Slug do Edital (se for prazo)</label>
                  <input className="input-field" value={form.editalSlug ?? ''} onChange={(e) => set('editalSlug', e.target.value)} />
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
                <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-rosa-vibrante text-white font-semibold text-sm hover:bg-rosa-vibrante/90 transition-all disabled:opacity-60">
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
