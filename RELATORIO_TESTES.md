# 📋 Relatório de Testes - Portal Conecta IFPR

**Data:** 16 de junho de 2026  
**Status:** ⚠️ **CRÍTICO** - Múltiplos problemas encontrados

---

## 🔴 PROBLEMAS CRÍTICOS

### 1. **Dados Mock em Todas as Páginas Principais**
**Severidade:** 🔴 CRÍTICO  
**Localização:** `src/app/page.tsx`, `src/app/editais/page.tsx`, `src/app/agenda/page.tsx`  
**Descrição:** As páginas estão usando dados hardcoded (mock) em vez de buscar informações reais do banco de dados.

**Problema:**
- Homepage carrega `editaisDestaque` e `proximosEventos` como arrays estáticos
- Página de Editais carrega dados hardcoded também
- Página de Agenda usa dados mock do arquivo
- Isso significa que **qualquer mudança no banco não aparece** nas páginas

**Código Problema:**
```typescript
// src/app/page.tsx - linha 14-43
const editaisDestaque = [
  {
    id: '1',
    titulo: 'Auxílio Estudantil...',
    // ... dados hardcoded
  }
];
```

**Como Arrumar:**
```typescript
// ✅ CORRETO - Buscar do banco
import { prisma } from '@/lib/prisma';

export default async function HomePage() {
  const editaisDestaque = await prisma.edital.findMany({
    where: { destaque: true, status: 'ATIVO' },
    take: 3,
    orderBy: { dataEncerramento: 'asc' }
  });
  
  const proximosEventos = await prisma.evento.findMany({
    where: { data: { gte: new Date() } },
    take: 4,
    orderBy: { data: 'asc' }
  });
  
  // ... resto do código
}
```

---

### 2. **Página de Edital [slug] Não Carrega do Banco**
**Severidade:** 🔴 CRÍTICO  
**Localização:** `src/app/editais/[slug]/page.tsx` (linhas 36-100)  
**Descrição:** Dados dos editais individuais estão hardcoded.

**Problema:**
```typescript
const editaisData: Record<string, Edital> = {
  'auxilio-estudantil-2025': { /* dados mock */ },
  'proex-bolsas-extensao-2025': { /* dados mock */ },
  // ...
};
```
Qualquer edital novo no banco não terá página.

**Como Arrumar:**
```typescript
export const generateStaticParams = async () => {
  const editais = await prisma.edital.findMany();
  return editais.map(e => ({ slug: e.slug }));
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EditalPage({ params }: Props) {
  const { slug } = await params;
  
  const edital = await prisma.edital.findUnique({
    where: { slug }
  });
  
  if (!edital) notFound();
  
  return (/* página com dados reais */);
}
```

---

### 3. **Página de Projeto [slug] Sem Banco**
**Severidade:** 🔴 CRÍTICO  
**Localização:** `src/app/projetos/[slug]/page.tsx`  
**Descrição:** Arquivo não foi encontrado, a página provavelmente retorna erro 404.

**Como Arrumar:**  
Criar o arquivo e implementar:
```typescript
export default async function ProjetoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const projeto = await prisma.projeto.findUnique({ where: { slug } });
  if (!projeto) notFound();
  // renderizar
}
```

---

### 4. **Filtros e Buscas Não Funcionam**
**Severidade:** 🟠 ALTO  
**Localização:** 
- `src/app/editais/page.tsx` (linhas 120-137)
- `src/app/projetos/page.tsx` (linhas 68-90)
- `src/app/agenda/page.tsx` (linhas 187-201)

**Problema:**
```typescript
// Existe UI para filtro:
<input type="search" placeholder="Buscar editais..." />
<select>
  {categorias.map(cat => <option>{cat}</option>)}
</select>
```
Mas **não há lógica** que realmente filtra/busca. Tudo é estático.

**Como Arrumar:**  
Usar `useState` com filtros que chamam uma API:
```typescript
'use client';

export default function EditaisPage() {
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [editais, setEditais] = useState([]);
  
  useEffect(() => {
    fetch(`/api/editais?search=${search}&categoria=${categoria}`)
      .then(r => r.json())
      .then(setEditais);
  }, [search, categoria]);
  
  return (/* com inputs controlados */);
}
```

---

### 5. **Links Externos Podem Estar Quebrados**
**Severidade:** 🟠 ALTO  
**Localização:** `src/components/layout/Footer.tsx` (linhas 84-111)

**Links Verificados:**
| Link | Status | Problema |
|------|--------|----------|
| `https://ifpr.edu.br/ivaipora` | ❓ Desconhecido | Precisa verificar se existe |
| `mailto:ivaipora@ifpr.edu.br` | ✅ OK | Email parece válido |
| `https://instagram.com/ifpr.ivaipora` | ❓ Desconhecido | Precisa verificar se conta existe |

**Como Arrumar:**
1. Testar manualmente cada link
2. Se algum estiver quebrado, corrigir no Footer

---

## 🟡 PROBLEMAS MODERADOS

### 6. **Status da Página de Projetos - Mistura de Mock e Real**
**Severidade:** 🟡 MODERADO  
**Localização:** `src/app/projetos/page.tsx` (linhas 14-24)  
**Descrição:** A página **CORRETAMENTE** busca projetos do banco, mas há um problema: alguns projetos podem não ter as propriedades esperadas.

**Problema:**
```typescript
const projetos = await prisma.projeto.findMany({
  orderBy: { nome: 'asc' }
});

// Depois usa:
projeto.destaque  // Campo pode não existir no schema
projeto.corPrimaria  // Campo pode não existir
```

**Como Arrumar:**  
Verificar no schema do Prisma se os campos existem e estão sendo populados.

---

### 7. **Componentes "Destaque" Podem Estar Vazios**
**Severidade:** 🟡 MODERADO  
**Localização:** `src/app/projetos/page.tsx` (linha 99)

**Problema:**
```typescript
{projetos.filter((p) => p.destaque).map((projeto) => (...))}
```
Se nenhum projeto tem `destaque: true`, a seção fica vazia, deixando espaço em branco estranho.

**Como Arrumar:**
```typescript
const destaques = projetos.filter(p => p.destaque);

{destaques.length > 0 && (
  <div className="mb-10">
    <h2>Projetos em Destaque</h2>
    {/* ... */}
  </div>
)}
```

---

### 8. **Botões e Links Funcionam Mas Levam a Páginas Vazias**
**Severidade:** 🟡 MODERADO  
**Localização:** Múltiplos arquivos

**Links que precisam de páginas:**
- ❌ `/projetos/[slug]` - **Não existe**
- ✅ `/editais/[slug]` - Existe (mas com mock data)
- ✅ `/editais` - Existe (mock data)
- ✅ `/projetos` - Existe
- ✅ `/agenda` - Existe (mock data)
- ✅ `/admin/login` - Existe
- ✅ `/admin` - Existe

---

### 9. **Responsividade - Pontos Fracos**
**Severidade:** 🟡 MODERADO  
**Observações:**

✅ **Bom:**
- Header tem navegação mobile com menu hambúrguer
- Grids se adaptam bem (`grid-cols-1 md:grid-cols-3`)
- Buttons têm `w-full` em mobile

⚠️ **Pode Melhorar:**
- Em alguns componentes faltam testes de viewport muito pequeno (320px)
- Modals/overlays podem não ter padding suficiente em celulares
- Seção stats `grid grid-cols-2 md:grid-cols-4` - em tablet médio fica desalinhado

---

## 🟢 O QUE ESTÁ BOM

✅ **Estrutura de Componentes:** Bem organizada  
✅ **Design System:** UI components reutilizáveis  
✅ **Tipos TypeScript:** Bem tipado  
✅ **Autenticação:** Implementada (Firebase/SUAP)  
✅ **Página de Projetos:** Carrega dados reais do banco  
✅ **Header/Footer:** Responsivos e bem implementados  

---

## 📝 CHECKLIST DE CORREÇÕES (Prioridade)

### 🔴 CRÍTICO (Fazer URGENTE)
- [ ] **Página Home:** Substituir mock data por Prisma
- [ ] **Página Editais:** Substituir mock data por Prisma
- [ ] **Página Edital [slug]:** Substituir mock data por Prisma
- [ ] **Criar página Projetos [slug]:** Implementar detalhe de projeto
- [ ] **Página Agenda:** Substituir mock data por Prisma

### 🟠 ALTO (Fazer na próxima iteração)
- [ ] Implementar filtros/busca reais (com API)
- [ ] Verificar links externos
- [ ] Testar responsividade em devices reais
- [ ] Verificar schema Prisma tem campos `destaque`, `corPrimaria`

### 🟡 MODERADO (Melhorias futuras)
- [ ] Adicionar fallback quando não há destaques
- [ ] Melhorar responsividade em viewports pequenos
- [ ] Adicionar paginação nas listas
- [ ] Adicionar mensagens "sem resultados" quando aplicável

---

## 💾 DADOS QUE ESTÃO SENDO IGNORADOS

Você tem esses dados em `/src/app/page.tsx` que poderiam vir do banco:

```
❌ editaisDestaque (hardcoded)
   → Deveria vir de: prisma.edital.findMany({ where: { destaque: true } })

❌ proximosEventos (hardcoded)
   → Deveria vir de: prisma.evento.findMany({ orderBy: { data: 'asc' } })

❌ stats (hardcoded como 4, 25+, 300+, 12)
   → Deveria vir de: count() no banco
```

---

## 🎯 PRÓXIMOS PASSOS

1. **Emergência:** Substituir dados mock por queries do Prisma
2. **Alta Prioridade:** Implementar busca/filtros reais
3. **Média Prioridade:** Verificar links externos
4. **Baixa Prioridade:** Melhorias de UX/responsividade

---

**Gerado em:** 2026-06-16
