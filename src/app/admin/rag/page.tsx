'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight, Upload, FileText, Trash2, Eye, EyeOff,
  Plus, Search, AlertCircle, CheckCircle, FileUp,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { listRagDocuments, createRagDocument, deleteRagDocument, toggleRagDocument } from '@/actions/admin';

type RagDoc = {
  id: string;
  titulo: string;
  tipo: string;
  conteudo: string;
  ativo: boolean;
  created_at: Date;
  _count: { chunks: number };
};

const TIPOS_DOC = [
  { value: 'edital', label: 'Edital' },
  { value: 'projeto', label: 'Projeto' },
  { value: 'faq', label: 'FAQ' },
  { value: 'contato', label: 'Contato' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'outro', label: 'Outro' },
];

export default function AdminRagPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<RagDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPdfUpload, setShowPdfUpload] = useState(false);
  const [form, setForm] = useState({ titulo: '', conteudo: '', tipo: 'outro' });
  const [pdfForm, setPdfForm] = useState({ titulo: '', tipo: 'outro' });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    const result = await listRagDocuments();
    if (result.ok && 'data' in result && Array.isArray(result.data)) {
      setDocs(result.data as RagDoc[]);
    }
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim()) {
      setError('Título e conteúdo são obrigatórios');
      return;
    }

    setSaving(true);
    setError('');

    const result = await createRagDocument(form);
    if (result.ok) {
      setForm({ titulo: '', conteudo: '', tipo: 'outro' });
      setShowForm(false);
      await loadDocs();
    } else {
      setError(result.error);
    }
    setSaving(false);
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    const result = await deleteRagDocument(docId);
    if (result.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    }
  };

  const handleToggle = async (docId: string) => {
    const result = await toggleRagDocument(docId);
    if (result.ok && 'data' in result && result.data) {
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, ativo: result.data!.ativo } : d));
    }
  };

  const handlePdfUpload = async () => {
    if (!pdfFile || !pdfForm.titulo.trim()) {
      setError('Arquivo e título são obrigatórios');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('titulo', pdfForm.titulo);
      formData.append('tipo', pdfForm.tipo);

      const response = await fetch('/api/admin/rag/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log('RAG upload response:', result);

      if (result.ok) {
        setPdfForm({ titulo: '', tipo: 'outro' });
        setPdfFile(null);
        setShowPdfUpload(false);
        await loadDocs();
      } else {
        const errorMsg = result.error || 'Erro ao enviar PDF';
        const debugInfo = result.debug ? ` (${JSON.stringify(result.debug)})` : '';
        setError(errorMsg + debugInfo);
      }
    } catch (e) {
      setError('Erro ao enviar arquivo');
    } finally {
      setSaving(false);
    }
  };

  const filtered = docs.filter((d) =>
    d.titulo.toLowerCase().includes(search.toLowerCase()) ||
    d.tipo.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 text-sm">Carregando documentos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin" className="hover:text-azul-eletrico transition-colors">Admin</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">Documentos RAG</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Documentos RAG</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os documentos que alimentam a IFizinha</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setForm({ titulo: '', conteudo: '', tipo: 'outro' }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-azul-eletrico text-white rounded-xl font-medium text-sm hover:bg-azul-eletrico/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Documento
          </button>
          <button
            onClick={() => { setPdfForm({ titulo: '', tipo: 'outro' }); setPdfFile(null); setShowPdfUpload(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition-colors"
          >
            <FileUp className="w-4 h-4" />
            Upload PDF
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Novo Documento RAG</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <span className="sr-only">Fechar</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico"
                  placeholder="Nome do documento"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico bg-white"
                >
                  {TIPOS_DOC.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo</label>
                <textarea
                  value={form.conteudo}
                  onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                  rows={12}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico resize-none font-mono"
                  placeholder="Cole o conteúdo do documento aqui..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  O conteúdo será dividido automaticamente em chunks para busca
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={saving || !form.titulo.trim() || !form.conteudo.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-azul-eletrico text-white rounded-xl text-sm font-medium hover:bg-azul-eletrico/90 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Upload Modal */}
      {showPdfUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Upload de PDF</h2>
              <button onClick={() => setShowPdfUpload(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <span className="sr-only">Fechar</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={pdfForm.titulo}
                  onChange={(e) => setPdfForm({ ...pdfForm, titulo: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico"
                  placeholder="Nome do documento"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={pdfForm.tipo}
                  onChange={(e) => setPdfForm({ ...pdfForm, tipo: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico bg-white"
                >
                  {TIPOS_DOC.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo PDF</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-xl text-center hover:border-azul-eletrico hover:bg-azul-eletrico/5 transition-colors"
                >
                  <FileUp className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  {pdfFile ? (
                    <p className="text-sm text-gray-700 font-medium">{pdfFile.name}</p>
                  ) : (
                    <p className="text-sm text-gray-500">Clique para selecionar um PDF</p>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowPdfUpload(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={handlePdfUpload}
                disabled={saving || !pdfFile || !pdfForm.titulo.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {saving ? 'Enviando...' : 'Enviar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          placeholder="Buscar documentos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-gray-900">{docs.length}</p>
          <p className="text-xs text-gray-500">Documentos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-green-600">{docs.filter((d) => d.ativo).length}</p>
          <p className="text-xs text-gray-500">Ativos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-azul-eletrico">{docs.reduce((acc, d) => acc + d._count.chunks, 0)}</p>
          <p className="text-xs text-gray-500">Chunks</p>
        </div>
      </div>

      {/* Documents List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 text-center py-16">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">Nenhum documento encontrado</p>
          <p className="text-gray-400 text-sm mt-1">Adicione documentos para alimentar a IFizinha</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((doc) => (
            <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 truncate">{doc.titulo}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {doc.tipo}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      doc.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {doc.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm truncate">{doc.conteudo.substring(0, 150)}...</p>
                  <p className="text-gray-400 text-xs mt-2">
                    {doc._count.chunks} chunk(s) — Criado em {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(doc.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      doc.ativo ? 'hover:bg-green-50 text-green-500' : 'hover:bg-gray-100 text-gray-400'
                    }`}
                    title={doc.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {doc.ativo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
