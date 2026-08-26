# Relatório de Usabilidade (UI/UX) - PortalConecta 2.0

**Data:** 2026-07-24
**Escopo:** Análise completa de usabilidade, acessibilidade, padrões de design e repetições

---

## SUMÁRIO

| Categoria | Issues Encontradas | Prioridade Alta |
|-----------|-------------------|-----------------|
| Repetições de Código | 8 | 3 |
| Fluxo de Usuário | 6 | 2 |
| Acessibilidade | 5 | 2 |
| Consistência Visual | 4 | 1 |
| Performance/UX | 3 | 1 |
| **Total** | **26** | **9** |

---

## 1. REPETIÇÕES DE CÓDIGO (Componentes Duplicados)

### R1. Tabela de Inscrições — 3 implementações quase idênticas
**Localização:**
- `src/app/admin/inscricoes/page.tsx`
- `src/app/professor/inscricoes/page.tsx`
- `src/app/professor/projetos/[id]/page.tsx`

**Problema:** Código de tabela com colunas (Protocolo, Inscrito, Curso, Tipo, Data, Status, Ações) duplicado 3 vezes. Filtros de busca e status também duplicados.

**Sugestão:** Extrair componente `<InscricoesTable projetoId={} userEmail={} />` reutilizável.

---

### R2. Filtros de Status — implementação diferente em cada página
**Localização:**
- `admin/inscricoes`: botões `todos/recebida/em_analise/selecionado/nao_selecionado`
- `professor/inscricoes`: botões `todos/recebida/em_analise/selecionado/nao_selecionado`
- `admin/projetos`: select dropdown com todos os status
- `admin/relatorio`: botões com 7 status

**Problema:** Cada página reinventa os filtros de status com markup diferente.

**Sugestão:** Extrair componente `<StatusFilter options={} selected={} onChange={} />` padronizado.

---

### R3. Modal de Detalhes da Inscrição — duplicado em 3+ páginas
**Localização:**
- `admin/inscricoes/page.tsx` (linhas 231-282)
- `professor/relatorio/page.tsx`
- `professor/projetos/[id]/page.tsx` (usa `alert()` com JSON)

**Problema:** O modal lateral (side panel) com campos da inscrição é re-implementado em cada lugar. O professor/projetos/[id] usa `alert()` em vez de modal — inconsistente.

**Sugestão:** Extrair componente `<InscricaoDetailModal inscricao={} onClose={} />`.

---

### R4. Botões de Ação (Lápis/Lixeira) — código idêntico em todas as tabelas CRUD
**Localização:**
- `admin/projetos/page.tsx` (linhas 221-227)
- `admin/editais/page.tsx` (linhas 138-144)
- `admin/usuarios/page.tsx` (linhas 187-191)
- `admin/posts/page.tsx`
- `admin/rag/page.tsx`

**Problema:** Padrão `<button onClick={...}><Pencil/></button>` + `<button onClick={confirm + delete}><Trash2/></button>` repetido em todas as tabelas.

**Sugestão:** Extrair componente `<ActionButtons onEdit={} onDelete={} />`.

---

### R5. Empty State — ícone + mensagem repetido em todas as listas
**Localização:**
- Todas as páginas de listagem (projetos, editais, usuarios, posts, agenda, inscricoes)

**Problema:** Padrão `<div className="text-center py-16 text-gray-400"><Icon.../><p>Nenhum...</p></div>` repetido ~10 vezes.

**Sugestão:** Extrair componente `<EmptyState icon={} title={} message={} action={} />`.

---

### R6. Header de Página — título + descrição + breadcrumbs
**Localização:**
- `projetos/page.tsx`, `editais/page.tsx`, `agenda/page.tsx` (hero sections)

**Problema:** Hero com breadcrumbs + título + descrição + ícone duplicado em 3 páginas públicas.

**Sugestão:** Extrair componente `<PageHero icon={} title={} description={} breadcrumbs={} />`.

---

### R7. Barra de Filtros — busca + dropdowns
**Localização:**
- `admin/projetos/page.tsx` (linhas 128-176)
- `admin/inscricoes/page.tsx` (linhas 139-166)
- `professor/inscricoes/page.tsx`

**Problema:** Barra de filtros com input de busca + dropdowns + botão "Limpar" duplicada.

**Sugestão:** Extrair componente `<FilterBar>` com slots para filtros customizáveis.

---

### R8. Export CSV — botão + lógica de download duplicada
**Localização:**
- `admin/inscricoes/page.tsx` (linhas 59-70)
- `professor/inscricoes/page.tsx` (linhas 58-69)
- `professor/relatorio/page.tsx`
- `meus-dados/page.tsx`

**Problema:** Lógica de `exportInscricoesCSV` → `new Blob` → `createObjectURL` → `a.click()` duplicada 4 vezes.

**Sugestão:** Extrair função utilitária `downloadCSV(csv, filename)` ou componente `<ExportCSVButton />`.

---

## 2. FLUXO DE USUÁRIO

### F1. Status de Inscrição atualiza sem confirmação
**Localização:** `admin/inscricoes`, `professor/inscricoes`, `professor/projetos/[id]`

**Problema:** Mudar o select de status atualiza imediatamente no banco. Sem confirmação, sem undo, sem feedback visual além da mudança silenciosa.

**Impacto:** Usuário pode mudar status por engano (ex: arrastando o mouse) e não tem como desfazer.

**Sugestão:** Adicionar toast "Status alterado. Desfazer?" com undo temporário (5 segundos).

---

### F2. Exclusão usa `confirm()` nativo do browser
**Localização:** Todas as páginas CRUD (projetos, editais, usuarios, posts, agenda, rag)

**Problema:** `confirm('Excluir este projeto permanentemente?')` é um modal nativo sem estilo, sem explicação do que será perdido, sem preview.

**Sugestão:** Modal customizado mostrando: (1) o que será excluído, (2) consequências, (3) confirmação com input de texto.

---

### F3. Mensagens de erro genéricas em Server Actions
**Localização:** `admin.ts`, `perfil.ts`, `professor.ts`

**Problema:** Erros do Prisma aparecem como strings técnicas (ex: "Record to delete does not exist"). Usuário final não entende.

**Sugestão:** Traduzir erros comuns: "Registro não encontrado", "Erro de conexão", "Dados inválidos".

---

### F4. Painel de edição deslizante sem animação de saída
**Localização:** `admin/projetos`, `admin/editais`

**Problema:** O painel abre com transição suave mas ao fechar some instantaneamente (sem slide-out).

**Sugestão:** Adicionar animação de slide-out ao fechar o painel.

---

### F5. Campo "Turma" readOnly pode confundir
**Localização:** `inscricao/[slug]/page.tsx` (linha 328-337)

**Problema:** Campo preenchido automaticamente como "Turma {anoInicio}" mas é readOnly. Usuário pode tentar editar e não entender por que não funciona.

**Sugestão:** Adicionar tooltip ou mensagem "Calculado automaticamente" mais visível (atualmente tem texto abaixo, mas pode passar despercebido).

---

### F6. Tela de sucesso da inscrição sem opção de nova inscrição
**Localização:** `inscricao/[slug]/page.tsx` (linhas 152-189)

**Problema:** Após inscrever, mostra "Inscrição Confirmada!" com botões "Voltar aos Projetos" e "Ir para o Início". Não tem opção de fazer outra inscrição.

**Sugestão:** Adicionar botão "Inscrever-se em outro projeto".

---

## 3. ACESSIBILIDADE

### A1. Inputs sem `aria-label` ou `aria-describedby`
**Localização:** Todos os formulários

**Problema:** Campos de input não têm atributos de acessibilidade para leitores de tela. `<label>` existe mas não está associado via `htmlFor`/`id`.

**Sugestão:** Adicionar `id` nos inputs e `htmlFor` nos labels, ou usar `aria-label`.

---

### A2. Modais não trapem foco (Tab pode sair do modal)
**Localização:** Painéis laterais (projetos, editais, inscricoes), modal de exclusão (perfil)

**Problema:** Ao abrir um modal/painel, o Tab pode navegar para elementos atrás do modal (no backdrop).

**Sugestão:** Implementar focus trap: quando modal abre, prender foco dentro dele. Fechar com Escape.

---

### A3. Contraste de cores pode ser insuficiente
**Localização:** `text-gray-400` em várias páginas

**Problema:** Texto cinza claro (`text-gray-400`) em fundo branco pode não atingir razão de contraste 4.5:1 (WCAG AA).

**Exemplos:**
- "Calculado automaticamente" na inscrição
- "Nenhum projeto encontrado" nos empty states
- Labels de campos nos formulários

**Sugestão:** Usar `text-gray-500` no mínimo para textos secundários.

---

### A4. Botões de ação (ícones) sem texto alternativo acessível
**Localização:** Todas as tabelas CRUD

**Problema:** Botões com apenas ícones (Pencil, Trash2) não têm `aria-label`. Leitores de tela announce "button" sem contexto.

**Sugestão:** Adicionar `aria-label="Editar"` e `aria-label="Excluir"` em todos os botões de ícone.

---

### A5. Radio buttons e checkboxes sem `fieldset`/`legend`
**Localização:** Formulário de inscrição (gênero, tipo interesse, disponibilidade, termos)

**Problema:** Grupos de radio buttons e checkboxes não estão dentro de `<fieldset>` com `<legend>`. Leitores de tela não conseguem agrupar semanticamente.

**Sugestão:** Envolver grupos related em `<fieldset>` com `<legend>` descritivo.

---

## 4. CONSISTÊNCIA VISUAL

### C1. Empty states com estilos diferentes
**Localização:**
- `admin/projetos`: ícone FolderOpen + "Nenhum projeto"
- `admin/editais`: ícone FileText + "Nenhum edital"
- `admin/usuarios`: ícone Users + "Nenhum usuário"
- `editais/page.tsx`: ícone BookOpen + "Nenhum edital publicado"

**Problema:** Cada página usa ícone e texto diferentes para o mesmo conceito (lista vazia).

**Sugestão:** Padronizar: mesma estrutura, cores e tipografia para todos os empty states.

---

### C2. Estilos de botões variam entre páginas
**Localização:**
- Dashboard: `<Link>` com estilo card
- Admin projetos: `<button>` com `bg-roxo-luminoso`
- Admin editais: `<button>` com `bg-azul-eletrico`
- Admin inscricoes: `<button>` com `border border-gray-200`

**Problema:** Botões primários usam cores diferentes sem padrão claro (roxo para projetos, azul para editais).

**Sugestão:** Definir paleta de botões: primário = azul, secundário = outline, perigo = vermelho.

---

### C3. Bordas arredondadas inconsistentes
**Localização:**
- Cards: `rounded-2xl` (maioria) mas `rounded-xl` em alguns
- Botões: `rounded-xl` (maioria) mas `rounded-lg` em filtros
- Inputs: `rounded-xl` (maioria) mas `rounded-lg` em alguns selects

**Problema:** Mistura de `rounded-xl` e `rounded-lg` sem padrão consistente.

**Sugestão:** Padronizar: `rounded-xl` para cards, `rounded-lg` para botões/inputs, `rounded-full` para badges.

---

### C4. Tipografia de títulos varia
**Localização:**
- Hero sections: `text-3xl md:text-4xl font-black`
- Admin pages: `text-2xl font-black`
- Section headers: `font-bold text-lg`
- Modal titles: `font-bold text-gray-900`

**Problema:** Hierarquia de títulos não é consistente entre páginas públicas e admin.

**Sugestão:** Definir escala: H1 = `text-3xl font-black`, H2 = `text-xl font-bold`, H3 = `text-base font-semibold`.

---

## 5. PERFORMANCE/UX

### P1. Skeleton loading em vez de "Carregando..." em texto
**Localização:** Todas as páginas com carregamento

**Problema:** Mensagem "Carregando..." ou spinner isolado não dá noção do que vai aparecer. Usuário não sabe se a página vai ter tabela, cards, ou formulário.

**Sugestão:** Usar skeleton screens (retângulos cinza animados) que simulem a estrutura do conteúdo.

---

### P2. Sem paginação em listas
**Localização:** `admin/usuarios`, `admin/projetos`, `admin/editais`, `admin/posts`

**Problema:** Listas carregam todos os registros de uma vez. Com muitos dados, a página fica lenta e scrollável.

**Sugestão:** Adicionar paginação ou infinite scroll com limite de 20-50 itens por página.

---

### P3. Busca global inexistente
**Localização:** Sistema inteiro

**Problema:** Não há um campo de busca que funcione em todas as entidades. Usuário precisa navegar até cada página para buscar.

**Sugestão:** Adicionar busca global (Ctrl+K) que pesquise em editais, projetos, usuários e posts simultaneamente.

---

## 6. MAPA DE COMPONENTES REUTILIZÁVEIS SUGERIDOS

| Componente | Onde usar | Complexidade |
|-----------|-----------|-------------|
| `<EmptyState>` | Todas as listas | Baixa |
| `<PageHero>` | Páginas públicas (editais, projetos, agenda) | Baixa |
| `<FilterBar>` | Admin projetos, inscricoes, relatorio | Média |
| `<StatusFilter>` | Inscricoes, relatorio | Baixa |
| `<ActionButtons>` | Todas as tabelas CRUD | Baixa |
| `<InscricoesTable>` | Admin/professor inscricoes, relatorio | Alta |
| `<InscricaoDetailModal>` | Admin/professor inscricoes, relatorio | Média |
| `<ExportCSVButton>` | Inscricoes, relatorio, meus-dados | Baixa |
| `<ConfirmDeleteModal>` | Todas as exclusões | Média |
| `<SkeletonLoader>` | Todas as páginas com carregamento | Média |
| `<Toast>` | Todas as ações de sucesso/erro | Média |

---

## 7. RECOMENDAÇÕES PRIORIZADAS

### Prioridade 1 (Curto prazo — melhoria imediata de UX)
1. **Substituir `confirm()` por modal de exclusão customizado** — impacto alto em todas as páginas CRUD
2. **Adicionar feedback visual (toast) para ações** — especialmente mudança de status
3. **Corrigir contraste de cores** — `text-gray-400` → `text-gray-500` mínimo
4. **Adicionar `aria-label` em botões de ícone** — acessibilidade básica

### Prioridade 2 (Médio prazo — redução de repetição)
5. **Extrair `<EmptyState>`** — componente mais simples e mais repetido
6. **Extrair `<ActionButtons>`** — reduz código em 5+ páginas
7. **Extrair `<ExportCSVButton>`** — lógica de download duplicada 4 vezes
8. **Extrair `<PageHero>`** — hero sections duplicadas em 3 páginas

### Prioridade 3 (Longo prazo — consistência e escala)
9. **Extrair `<InscricoesTable>`** — componente maior mas mais impactante
10. **Padronizar border radius e tipografia** — definir design system
11. **Adicionar skeleton loading** — melhoria de percepção de performance
12. **Adicionar paginação** — necessidade quando o sistema crescer

---

## 8. CHECKLIST DE ACESSIBILIDADE (WCAG 2.1 AA)

| Critério | Status | Notas |
|----------|--------|-------|
| 1.1.1 Texto Alternativo | PARCIAL | Ícones Lucide não têm aria-label |
| 1.3.1 Info e Relações | FALHA | Inputs sem label associado |
| 1.4.3 Contraste Mínimo | FALHA | text-gray-400 pode não atingir 4.5:1 |
| 1.4.4 Redimensionar Texto | OK | Layout responsivo |
| 2.1.1 Teclado | PARCIAL | Focus trap ausente em modais |
| 2.4.1 Blocos de Pular | OK | Landmarks presentes |
| 2.4.3 Foco | FALHA | Focus pode sair de modais |
| 2.4.6 Títulos e Rótulos | PARCIAL | Títulos existem mas hierarquia inconsistente |
| 3.3.1 Erro de Identificação | OK | Mensagens de erro presentes |
| 3.3.2 Rótulos ou Instruções | PARCIAL | Labels existem mas não associados |
| 4.1.2 Nome, Função, Valor | FALHA | Botões de ícone sem nome acessível |

---

*Relatório gerado por análise estática do código e revisão visual das páginas. Testes de screen reader e dispositivos de assistência requerem ferramentas especializadas (NVDA, VoiceOver, etc.).*
