# 🔧 GUIA DE CORREÇÕES - Portal Conecta

## 1️⃣ SUBSTITUIR HOME PAGE COM DADOS REAIS

### ❌ ANTES (Mock Data)
```typescript
// src/app/page.tsx - linha 14-43
const editaisDestaque = [
  {
    id: '1',
    titulo: 'Auxílio Estudantil...',
    // ... hardcoded data
  }
];
```

### ✅ DEPOIS (Dados do Banco)
```typescript
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export default async function HomePage() {
  try {
    // Buscar editais em destaque ativos
    const editaisDestaque = await prisma.edital.findMany({
      where: {
        destaque: true,
        status: { in: ['ATIVO', 'ENCERRA_BREVE'] }
      },
      orderBy: { dataEncerramento: 'asc' },
      take: 3
    });

    // Buscar próximos eventos
    const proximosEventos = await prisma.evento.findMany({
      where: {
        data: { gte: new Date() }
      },
      orderBy: { data: 'asc' },
      take: 4
    });

    // Buscar estatísticas
    const [editaisAtivos, projetosAtivos, usuariosTotal, eventosProximos] = await Promise.all([
      prisma.edital.count({ where: { status: 'ATIVO' } }),
      prisma.projeto.count({ where: { status: 'EM_EXECUCAO' } }),
      prisma.user.count(),
      prisma.evento.count({ where: { data: { gte: new Date() } } })
    ]);

    const stats = [
      { label: 'Editais Ativos', value: editaisAtivos.toString(), icon: FileText, color: 'text-azul-eletrico', bg: 'bg-azul-eletrico/10' },
      { label: 'Projetos em Execução', value: projetosAtivos.toString(), icon: FolderOpen, color: 'text-roxo-luminoso', bg: 'bg-roxo-luminoso/10' },
      { label: 'Próximos Eventos', value: eventosProximos.toString(), icon: Users, color: 'text-rosa-vibrante', bg: 'bg-rosa-vibrante/10' },
      // ... resto dos stats
    ];

    return (
      <div className="flex flex-col">
        <HeroIFizinha />
        {/* Stats section com dados reais */}
        {/* Editais com dados reais */}
        {/* Eventos com dados reais */}
        {/* ... resto do JSX */}
      </div>
    );
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    // Renderizar página com estado de erro
    return <div>Erro ao carregar dados. Tente novamente.</div>;
  }
}
```

---

## 2️⃣ CRIAR PÁGINA DE DETALHE DE PROJETO

### 📁 Novo Arquivo: `src/app/projetos/[slug]/page.tsx`

```typescript
import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { 
  ArrowLeft, Users, MapPin, Calendar, ExternalLink, 
  Sparkles, FileText, Mail, Award 
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const projeto = await prisma.projeto.findUnique({ where: { slug } });

  return {
    title: projeto?.nome ?? 'Projeto não encontrado',
    description: projeto?.descricao ?? '',
  };
}

export const generateStaticParams = async () => {
  const projetos = await prisma.projeto.findMany();
  return projetos.map(p => ({ slug: p.slug }));
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProjetoPage({ params }: Props) {
  const { slug } = await params;

  const projeto = await prisma.projeto.findUnique({
    where: { slug },
    include: {
      membros: true,
    }
  });

  if (!projeto) notFound();

  return (
    <div className="min-h-screen">
      {/* Hero com cor do projeto */}
      <div style={{ background: `linear-gradient(135deg, ${projeto.corPrimaria} 0%, ${projeto.corPrimaria}cc 100%)` }} className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Breadcrumb */}
          <Link href="/projetos" className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Voltar aos projetos
          </Link>

          {/* Cabeçalho */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white font-black text-4xl border border-white/30">
              {projeto.nome.charAt(0)}
            </div>
            <div>
              <h1 className="text-4xl font-black text-white mb-2">{projeto.nome}</h1>
              <p className="text-white/80 text-lg max-w-2xl">{projeto.descricao}</p>
            </div>
          </div>

          {/* Info rápida */}
          <div className="mt-8 flex flex-wrap gap-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/20 flex items-center gap-3">
              <Users className="w-5 h-5 text-white" />
              <span className="text-white font-semibold">{projeto.coordenador}</span>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/20 flex items-center gap-3">
              <Award className="w-5 h-5 text-white" />
              <span className="text-white font-semibold">{projeto.area}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container mx-auto px-4 max-w-7xl py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna principal */}
          <div className="lg:col-span-2 space-y-8">
            {/* Descrição completa */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8">
              <h2 className="font-bold text-gray-900 text-2xl mb-4">Sobre o Projeto</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{projeto.descricao}</p>
            </div>

            {/* Membros */}
            {projeto.membros && projeto.membros.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8">
                <h2 className="font-bold text-gray-900 text-2xl mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-azul-eletrico" />
                  Equipe ({projeto.membros.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {projeto.membros.map(membro => (
                    <div key={membro.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="font-semibold text-gray-900 text-sm">{membro.nome}</p>
                      <p className="text-xs text-gray-500">{membro.funcao}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Card de info */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-24 space-y-4">
              <h3 className="font-bold text-gray-900">Informações</h3>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1 ${
                    projeto.status === 'EM_EXECUCAO' ? 'bg-green-100 text-green-700' :
                    projeto.status === 'ENVIADO_2026' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {projeto.status === 'EM_EXECUCAO' ? '🟢 Ativo' : projeto.status}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Área</p>
                  <p className="text-gray-900 font-semibold mt-1">{projeto.area}</p>
                </div>

                {projeto.dataInicio && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Início
                    </p>
                    <p className="text-gray-900 font-semibold mt-1">
                      {formatDate(new Date(projeto.dataInicio), { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                )}

                {projeto.email && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Contato
                    </p>
                    <a href={`mailto:${projeto.email}`} className="text-azul-eletrico hover:underline text-sm mt-1">
                      {projeto.email}
                    </a>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <p className="text-xs text-gray-500">Quer participar deste projeto?</p>
                <Link href="/editais" className="block">
                  <Button className="w-full">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Ver Editais de Bolsas
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 3️⃣ IMPLEMENTAR BUSCA/FILTRO REAL

### 🔍 Criar API: `src/app/api/editais/route.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.toLowerCase() ?? '';
    const categoria = searchParams.get('categoria') ?? 'Todas';
    const status = searchParams.get('status') ?? 'Todos';
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = 10;

    // Construir filtros
    const where: any = {};

    if (search) {
      where.OR = [
        { titulo: { contains: search, mode: 'insensitive' } },
        { resumo: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (categoria !== 'Todas') {
      where.categoria = categoria;
    }

    if (status !== 'Todos') {
      where.status = status;
    }

    // Buscar dados
    const [editais, total] = await Promise.all([
      prisma.edital.findMany({
        where,
        orderBy: { dataEncerramento: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.edital.count({ where })
    ]);

    return NextResponse.json({
      data: editais,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar editais:', error);
    return NextResponse.json({ error: 'Erro ao buscar' }, { status: 500 });
  }
}
```

### 🎨 Usar em Componente: `src/app/editais/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function EditaisPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [categoria, setCategoria] = useState(searchParams.get('categoria') ?? 'Todas');
  const [editais, setEditais] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/editais?search=${search}&categoria=${categoria}`)
      .then(r => r.json())
      .then(data => setEditais(data.data))
      .finally(() => setLoading(false));
  }, [search, categoria]);

  return (
    <div>
      {/* Search e filtros com valores controlados */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar editais..."
      />
      <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
        {/* options */}
      </select>

      {/* Loading state */}
      {loading && <p>Carregando...</p>}

      {/* Resultado */}
      {!loading && editais.length === 0 && <p>Nenhum edital encontrado</p>}
      {editais.map(edital => (/* renderizar */))}
    </div>
  );
}
```

---

## 4️⃣ VERIFICAR LINKS EXTERNOS

### ✅ Checklist de Verificação

```bash
# Testar links do footer:

# 1. Site Oficial IFPR
curl -I https://ifpr.edu.br/ivaipora
# Esperado: 200 OK ou 301 Redirect

# 2. E-mail
# Enviar teste: ivaipora@ifpr.edu.br

# 3. Instagram
curl -I https://instagram.com/ifpr.ivaipora
# Esperado: 200 OK ou 301 Redirect
```

### 🔗 Se Link Estiver Quebrado

```typescript
// src/components/layout/Footer.tsx
<a
  href="https://ifpr.edu.br/ivaipora"  // ← Corrigir URL aqui
  target="_blank"
  rel="noopener noreferrer"
/>
```

---

## 5️⃣ TESTAR RESPONSIVIDADE

### 📱 Viewports para Testar

Usar Chrome DevTools ou responsively.app:

```
Mobile:    320px, 375px, 425px
Tablet:    768px, 1024px
Desktop:   1280px, 1920px
```

### ⚠️ Pontos Críticos para Verificar

1. **Header**
   - Menu mobile abre/fecha?
   - Logo e nav items têm espaço suficiente?

2. **Cards de Edital**
   - Texto não fica muito pequeno?
   - Imagens não distorcem?

3. **Modais/Forms**
   - Padding suficiente em celulares?
   - Botões são clicáveis (mín 44px)?

4. **Tabelas/Listas**
   - Não scroll horizontal indesejado?

---

## 📋 ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

1. ✅ **Dia 1-2:** Fazer os 5 pontos críticos acima
2. ✅ **Dia 2-3:** Testar e corrigir bugs
3. ✅ **Dia 3:** Deploy para produção
4. 📅 **Futuro:** Implementar melhorias de UX

---

## 🚀 COMANDO PARA TESTAR LOCALMENTE

```bash
# Instalar deps
npm install

# Sincronizar banco
npm run db:generate
npm run db:push

# Seed (opcional - popular com dados teste)
npm run db:seed

# Iniciar dev
npm run dev

# Acessar em http://localhost:3000
```

---

Gerado: 2026-06-16
