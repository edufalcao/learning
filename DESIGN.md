# Design: 30 Days of Agentic Coding — Static Site

**Date:** 2026-03-24  
**Author:** HawkBot (Opus)  
**Target URL:** learning.edufalcao.com  
**Status:** Awaiting approval

---

## 1. Overview

Site estático em **Nuxt 3** publicando as 30 lições da série "Agentic Coding" de forma polida e navegável. O objetivo é que Eduardo possa compartilhar o conteúdo publicamente como referência técnica.

---

## 2. Arquitetura

### Stack
- **Nuxt 3** com `nuxt generate` (output estático)
- **@nuxt/content** — lê os `.md` nativamente, roteamento automático
- **Tailwind CSS v4** — styling
- **Shiki** — syntax highlighting (built-in no Nuxt Content)
- **Cloudflare Pages** — deploy (zero config com Nuxt)

### Estrutura de arquivos
```
agentic-coding-site/
├── content/
│   ├── index.md              # conteúdo da home
│   └── days/
│       ├── day-01.md ... day-30.md  # lições copiadas
├── pages/
│   ├── index.vue             # homepage
│   └── days/
│       └── [slug].vue        # página individual da lição
├── components/
│   ├── DayCard.vue           # card do dia no grid
│   ├── WeekSection.vue       # agrupador semanal
│   ├── LessonNav.vue         # navegação anterior/próximo
│   ├── ProgressBar.vue       # barra de progresso 30 dias
│   └── CodeBlock.vue         # wrapper do highlight
├── layouts/
│   ├── default.vue           # layout com sidebar
│   └── home.vue              # layout da homepage
├── nuxt.config.ts
└── tailwind.config.ts
```

### Roteamento
- `/` → Homepage
- `/days/day-01` → Lição do dia 1
- `/days/day-07` → Review da semana 1
- etc.

---

## 3. Visual Design

### Identidade visual
- **Tema:** Dark (developer-first)
- **Cor primária:** Ciano (`#00E5CC`) + Magenta (`#FF006E`) — mesma identidade visual do personal-website, diffspot e configspot
- **Background:** `#0D0D0D` (quase preto, não puro)
- **Surface cards:** `#1A1A1A` com borda `rgba(255,255,255,0.08)`
- **Fonte texto:** DM Sans (system-ui fallback)
- **Fonte display:** Space Grotesk
- **Fonte código:** JetBrains Mono

### Paleta
| Token | Valor |
|-------|-------|
| `accent` | `#00E5CC` |
| `accent2` | `#FF006E` |
| `bg` | `#0D0D0D` |
| `surface` | `#1A1A1A` |
| `surface-2` | `#242424` |
| `border` | `hsla(0, 0%, 100%, 0.08)` |
| `text-main` | `#F5F5F5` |
| `text-muted` | `#8B8B8B` |
| `code-bg` | `#1A1A1A` |

### Tipografia
- `text-sm` muted para metadados (dia, semana)
- `text-2xl font-bold` para títulos de lição
- `text-base leading-7` para prosa
- Code blocks com linha numerada e tema `github-dark`

---

## 4. Páginas

### 4.1 Homepage (`/`)

**Seções:**
1. **Hero** — título da série, subtítulo, badge "30 dias · Eduardo Falcão"
2. **Progress bar** — visual de 30 dias (pode mostrar dias publicados vs total)
3. **Semanas** (4 blocos) — cada semana tem título + grid de dias
4. **Footer** — créditos, link para edufalcao.com

**Hero copy:**
> **30 Days of Agentic Coding**  
> A structured series on building agent systems — one lesson per day, each under 10 minutes.  
> Week 1: Foundations · Week 2: Architecture · Week 3: Implementation · Week 4: Production

**Grid de dias:**
- 30 cards em grid responsivo (5 colunas desktop, 3 tablet, 2 mobile)
- Cada card: número do dia + título curto + indicador de semana
- Card hover: border âmbar + slight lift

---

### 4.2 Página da Lição (`/days/day-XX`)

**Layout:** Sidebar esquerda (lista de dias) + conteúdo principal

**Componentes:**
- **Breadcrumb:** Home → Week X → Day N
- **Header da lição:** Dia, semana, título
- **Conteúdo:** Markdown renderizado com Nuxt Content
- **Code blocks:** Syntax highlight Shiki, com botão "copy"
- **Nav:** botões Anterior / Próximo no rodapé do conteúdo
- **Sidebar:** lista colapsável por semana, dia atual destacado

---

## 5. Mockups HTML

Os mockups estão em:
- `docs/mockups/home.html`
- `docs/mockups/day.html`

(Gerados separadamente — ver arquivos)

---

## 6. Deploy

### Cloudflare Pages
```bash
# Build command
npx nuxi generate

# Output dir
.output/public
```

### DNS
```
learning.edufalcao.com → CNAME → <pages-project>.pages.dev
```

---

## 7. Plano de implementação (fases)

**Fase 1 — Estrutura base (1-2h)**
- Scaffold Nuxt 3 + Nuxt Content + Tailwind
- Copiar os 30 `.md` para `content/days/`
- Roteamento dinâmico funcionando

**Fase 2 — Homepage (1h)**
- Layout hero + grid semanal
- Cards com hover states

**Fase 3 — Página de lição (1h)**
- Layout com sidebar
- Nav anterior/próximo
- Code blocks com copy button

**Fase 4 — Polish (30min)**
- SEO meta tags
- Open Graph (compartilhamento)
- Favicon + fontes

**Fase 5 — Deploy (15min)**
- Conectar repo ao Cloudflare Pages
- Configurar DNS

**Estimativa total:** ~4-5h de implementação

---

## 8. Decisões de design

| Decisão | Alternativa considerada | Razão |
|---------|------------------------|-------|
| Dark theme | Light theme | Audiência dev, código é central |
| Sidebar navigation | Topnav only | 30 dias precisam de acesso rápido |
| Nuxt Content | MDX manual | Zero boilerplate, highlight built-in |
| Cloudflare Pages | Vercel | Já no ecossistema Cloudflare do Eduardo |
| Ciano + Magenta como cores primárias | Azul/verde | Consistência com personal-website, diffspot e configspot |
