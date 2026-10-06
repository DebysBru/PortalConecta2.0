'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, Node, mergeAttributes } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Heading2, Heading3,
  Quote, Link as LinkIcon, Undo, Redo, ImagePlus, Loader2, AlertCircle,
} from 'lucide-react';

/**
 * Imagem DENTRO do texto do post.
 *
 * O StarterKit do TipTap não traz nó de imagem e `@tiptap/extension-image` não
 * está instalado — em vez de somar dependência (que exigiria `npm install` na
 * VPS), o nó é declarado aqui. Assim os atributos ficam EXATAMENTE iguais aos
 * que o sanitizador do servidor permite (`src/lib/rich-text.ts`: `img` com
 * `src` e `alt`); qualquer atributo a mais seria removido ao salvar.
 */
const ImagemNoConteudo = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'img[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },
});

export type ResultadoUploadImagem =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  onUploadImage,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Quando informado, habilita o botão de imagem (envia o arquivo e devolve a URL pública). */
  onUploadImage?: (arquivo: File) => Promise<ResultadoUploadImagem>;
}) {
  const inputArquivo = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? 'Escreva o conteúdo aqui...' }),
      ImagemNoConteudo,
    ],
    content: value,
    // Evita o mismatch de hidratação do Next.js — o Tiptap renderiza o
    // conteúdo inicial só no client, depois do primeiro paint.
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[180px] px-3 py-2',
      },
    },
  });

  // Sincroniza quando `value` muda de fora (ex.: abrir o painel de edição
  // com um post já existente) — sem isso o editor só reflete o `content`
  // inicial passado no primeiro render.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return <div className="border border-gray-200 rounded-xl min-h-[220px] bg-gray-50 animate-pulse" />;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL do link', previousUrl ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const escolherImagem = () => {
    setErro('');
    inputArquivo.current?.click();
  };

  const enviarImagem = async (arquivo: File | undefined) => {
    if (!arquivo || !onUploadImage) return;
    setErro('');
    setEnviando(true);
    try {
      const resultado = await onUploadImage(arquivo);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      // `alt` recebe o nome do arquivo: é o texto que aparece se a imagem não
      // carregar e o que leitores de tela leem.
      editor.chain().focus().insertContent({
        type: 'image',
        attrs: { src: resultado.url, alt: arquivo.name },
      }).run();
    } finally {
      setEnviando(false);
      // Permite escolher o MESMO arquivo de novo (sem isso o input não dispara
      // `change` na segunda tentativa).
      if (inputArquivo.current) inputArquivo.current.value = '';
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-azul-eletrico/30 focus-within:border-azul-eletrico transition-shadow">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 bg-gray-50 p-1.5">
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="Negrito">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="Itálico">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} label="Riscado">
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Título">
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="Subtítulo">
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Lista">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Lista numerada">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="Citação">
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('link')} onClick={setLink} label="Link">
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
        {onUploadImage && (
          <ToolbarButton onClick={escolherImagem} label="Inserir imagem no texto" disabled={enviando}>
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          </ToolbarButton>
        )}
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} label="Desfazer">
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} label="Refazer">
          <Redo className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <input
        ref={inputArquivo}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => enviarImagem(e.target.files?.[0])}
      />

      {enviando && (
        <p className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
          Enviando a imagem...
        </p>
      )}
      {erro && (
        <p className="flex items-start gap-1.5 px-3 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {erro}
        </p>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active, onClick, label, disabled, children,
}: { active?: boolean; onClick: () => void; label: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${active ? 'bg-azul-eletrico text-white' : 'text-gray-500 hover:bg-gray-200'}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />;
}
