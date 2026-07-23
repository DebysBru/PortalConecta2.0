'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight, Upload, FileText, Trash2, Eye, EyeOff,
  Plus, Search, AlertCircle, FileUp, X, Save, Tag, Edit2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { listRagDocuments, createRagDocument, deleteRagDocument, toggleRagDocument } from '@/actions/admin';

type RagDoc = {
  id: string;
  titulo: string;
  tipo: string;
  conteudo: string;
  resumo: string | null;
  tags: string[];
  links: string[];
  ativo: boolean;
  processado: boolean;
  created_at: Date;
  _count: { chunks: number };
};

type RagDocFull = RagDoc & {
  chunks: Array<{
    id: string;
    conteudo: string;
    titulo: string | null;
    tags: string[];
    chunk_index: number;
  }>;
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
  const [showUpload, setShowUpload] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<RagDocFull | null>(null);
  const [form, setForm] = useState({ titulo: '', conteudo: '', tipo: 'outro' });
  const [uploadForm, setUploadForm] = useState({ titulo: '', tipo: 'outro' });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [newTag, setNewTag] = useState('');
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
    if (!uploadFile || !uploadForm.titulo.trim()) {
      setError('Arquivo e título são obrigatórios');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('titulo', uploadForm.titulo);
      formData.append('tipo', uploadForm.tipo);

      const response = await fetch('/api/admin/rag/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.ok) {
        setUploadForm({ titulo: '', tipo: 'outro' });
        setUploadFile(null);
        setShowUpload(false);
        await loadDocs();
      } else {
        setError(result.error || 'Erro ao enviar arquivo');
      }
    } catch (e) {
      setError('Erro ao enviar arquivo');
    } finally {
      setSaving(false);
    }
  };

  const handleTextUpload = async () => {
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
      if (selectedDoc?.id === docId) {
        setShowDetail(false);
        setSelectedDoc(null);
      }
    }
  };

  const handleToggle = async (docId: string) => {
    const result = await toggleRagDocument(docId);
    if (result.ok && 'data' in result && result.data) {
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, ativo: result.data!.ativo } : d));
      if (selectedDoc?.id === docId) {
        setSelectedDoc({ ...selectedDoc, ativo: result.data!.ativo });
      }
    }
  };

  const handleViewDoc = async (docId: string) => {
    const response = await fetch(`/api/admin/rag/docs?id=${docId}`);
    const result = await response.json();
    if (result.ok && result.data) {
      setSelectedDoc(result.data);
      setShowDetail(true);
    }
  };

  const handleUpdateDoc = async (updates: Partial<RagDocFull>) => {
    if (!selectedDoc) return;

    const response = await fetch('/api/admin/rag/docs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedDoc.id, ...updates }),
    });

    const result = await response.json();
    if (result.ok && result.data) {
      setSelectedDoc({ ...selectedDoc, ...updates });
      setDocs((prev) => prev.map((d) =>
        d.id === selectedDoc.id ? { ...d, ...updates } : d
      ));
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !selectedDoc) return;
    const tag = newTag.trim().toLowerCase();
    if (selectedDoc.tags.includes(tag)) {
      setNewTag('');
      return;
    }

    const newTags = [...selectedDoc.tags, tag];
    await handleUpdateDoc({ tags: newTags });
    setNewTag('');
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedDoc) return;
    const newTags = selectedDoc.tags.filter((t) => t !== tagToRemove);
    await handleUpdateDoc({ tags: newTags });
  };

  const filtered = docs.filter((d) =>
    d.titulo.toLowerCase().includes(search.toLowerCase()) ||
    d.tipo.toLowerCase().includes(search.toLowerCase()) ||
    d.tags.some((t) => t.includes(search.toLowerCase()))
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
            Texto Direto
          </button>
          <button
            onClick={() => { setUploadForm({ titulo: '', tipo: 'outro' }); setUploadFile(null); setShowUpload(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition-colors"
          >
            <FileUp className="w-4 h-4" />
            Upload Arquivo
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Text Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Novo Documento (Texto)</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
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
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleTextUpload}
                disabled={saving || !form.titulo.trim() || !form.conteudo.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-azul-eletrico text-white rounded-xl text-sm font-medium hover:bg-azul-eletrico/90 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Upload de Documento</h2>
              <button onClick={() => setShowUpload(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={uploadForm.titulo}
                  onChange={(e) => setUploadForm({ ...uploadForm, titulo: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico"
                  placeholder="Nome do documento"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={uploadForm.tipo}
                  onChange={(e) => setUploadForm({ ...uploadForm, tipo: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico bg-white"
                >
                  {TIPOS_DOC.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-xl text-center hover:border-azul-eletrico hover:bg-azul-eletrico/5 transition-colors"
                >
                  <FileUp className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  {uploadFile ? (
                    <p className="text-sm text-gray-700 font-medium">{uploadFile.name}</p>
                  ) : (
                    <p className="text-sm text-gray-500">PDF, DOCX, DOC, TXT, MD, CSV ou XLSX</p>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={saving || !uploadFile || !uploadForm.titulo.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {saving ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-900 truncate">{selectedDoc.titulo}</h2>
              <button onClick={() => { setShowDetail(false); setSelectedDoc(null); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Status e Tipo */}
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedDoc.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {selectedDoc.ativo ? 'Ativo' : 'Inativo'}
                </span>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                  {selectedDoc.tipo}
                </span>
                <span className="text-sm text-gray-500">
                  {selectedDoc.chunks?.length || 0} chunks
                </span>
              </div>

              {/* Resumo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resumo (gerado por IA)</label>
                <textarea
                  value={selectedDoc.resumo || ''}
                  onChange={(e) => handleUpdateDoc({ resumo: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico resize-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedDoc.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-azul-eletrico/10 text-azul-eletrico">
                      <Tag className="w-3 h-3" />
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {selectedDoc.tags.length === 0 && (
                    <span className="text-sm text-gray-400">Nenhuma tag</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Nova tag..."
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico"
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!newTag.trim()}
                    className="px-4 py-2 bg-azul-eletrico text-white rounded-xl text-sm font-medium hover:bg-azul-eletrico/90 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Conteúdo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Conteúdo Extraído</label>
                <div className="bg-gray-50 rounded-xl p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {selectedDoc.conteudo}
                  </pre>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {selectedDoc.conteudo.length.toLocaleString()} caracteres
                </p>
              </div>

              {/* Chunks */}
              {selectedDoc.chunks.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chunks ({selectedDoc.chunks.length})
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedDoc.chunks.map((chunk) => (
                      <div key={chunk.id} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400">#{chunk.chunk_index}</span>
                          {chunk.titulo && (
                            <span className="text-xs font-medium text-azul-eletrico">{chunk.titulo}</span>
                          )}
                          {chunk.tags.length > 0 && (
                            <div className="flex gap-1">
                              {chunk.tags.slice(0, 3).map((t) => (
                                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{chunk.conteudo.slice(0, 200)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggle(selectedDoc.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    selectedDoc.ativo
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {selectedDoc.ativo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {selectedDoc.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => { handleDelete(selectedDoc.id); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              </div>
              <button
                onClick={() => { setShowDetail(false); setSelectedDoc(null); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Fechar
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
          placeholder="Buscar documentos ou tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-azul-eletrico"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
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
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-purple-600">{new Set(docs.flatMap((d) => d.tags)).size}</p>
          <p className="text-xs text-gray-500">Tags únicas</p>
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
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleViewDoc(doc.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 truncate hover:text-azul-eletrico">{doc.titulo}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {doc.tipo}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      doc.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {doc.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    {doc.processado && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        IA
                      </span>
                    )}
                  </div>
                  {doc.resumo && (
                    <p className="text-gray-500 text-sm mb-2 line-clamp-2">{doc.resumo}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{doc._count.chunks} chunks</span>
                    {doc.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {doc.tags.slice(0, 3).join(', ')}
                        {doc.tags.length > 3 && ` +${doc.tags.length - 3}`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleViewDoc(doc.id)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-azul-eletrico transition-colors"
                    title="Ver detalhes"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
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
