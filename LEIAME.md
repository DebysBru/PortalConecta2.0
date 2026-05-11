# Portal Conecta — IFPR Campus Ivaiporã

Plataforma web de comunicação institucional do IFPR Campus Ivaiporã, mediada pela persona **IFizinha**.

## 🚀 Como rodar localmente

```bash
npm install
npm run dev
# Acesse http://localhost:3000
```

## ⚙️ Configuração do Banco de Dados

1. Crie um projeto no [Supabase](https://supabase.com)
2. Copie `.env.example` → `.env.local` e preencha as credenciais
3. Execute:

```bash
npm run db:generate   # Gera o Prisma Client
npm run db:push       # Sincroniza o schema com o banco
npm run db:seed       # Popula com dados iniciais (28 projetos, 4 editais, 7 eventos)
```

## 📦 Stack

| Tecnologia | Uso |
|---|---|
| Next.js 14 (App Router) | Framework principal |
| TypeScript | Tipagem estática |
| Tailwind CSS | Estilização |
| shadcn/ui | Componentes UI |
| Prisma | ORM |
| Supabase (PostgreSQL) | Banco de dados |
| NextAuth.js | Autenticação |
| Vercel | Deploy |

## 🎨 Identidade Visual

```css
--azul-eletrico: #2F52D3;
--roxo-luminoso: #7B24C7;
--rosa-vibrante: #E83D89;
--ciano-claro: #17A2B8;
--dourado-ifizinha: #FFD700;
```

## 📄 Estrutura de Páginas

```
/                   → Homepage com hero IFizinha, editais, projetos, eventos
/editais            → Listagem de editais com filtros
/editais/[slug]     → Edital individual com abas (IFizinha / Original)
/projetos           → Diretório de projetos (28 projetos cadastrados)
/projetos/[slug]    → Página individual do projeto
/agenda             → Agenda escolar com timeline por mês
```

## 🌱 Seed Data

O seed inclui:
- **28 projetos** de extensão do IFPR Ivaiporã (25 em execução, 2 enviados 2026)
- **4 editais** com tradução IFizinha completa
- **7 eventos** na agenda escolar

## 🚢 Deploy na Vercel

1. Conecte o repositório na Vercel
2. Configure as variáveis de ambiente (igual ao `.env.example`)
3. Deploy automático! ✓
