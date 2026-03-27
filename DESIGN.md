# Design: 30 Days of Agentic Coding — Static Site

**Date:** 2026-03-24
**Author:** HawkBot (Opus)
**Target URL:** learning.edufalcao.com
**Status:** Implemented and live

---

## 1. Overview

Static site built with **Nuxt 4**, publishing the 30 lessons of the "Agentic Coding" series in a polished, navigable format. The goal is for Eduardo to share the content publicly as a technical reference.

---

## 2. Architecture

### Stack
- **Nuxt 4** with `nuxt generate` (static output)
- **@nuxt/content** — reads `.md` files natively, automatic routing
- **Tailwind CSS v3** — styling (via `@nuxtjs/tailwindcss`)
- **Shiki** — syntax highlighting (built into Nuxt Content)
- **Cloudflare Pages** — deployment (zero config with Nuxt)

### File Structure
```
agentic-coding-site/
├── content/
│   ├── index.md              # home page content
│   └── days/
│       ├── day-01.md ... day-30.md  # lesson files
├── pages/
│   ├── index.vue             # homepage
│   └── days/
│       └── [slug].vue        # individual lesson page
├── components/
│   ├── DayCard.vue           # day card in grid
│   ├── WeekSection.vue       # weekly grouping
│   ├── LessonNav.vue         # previous/next navigation
│   ├── ProgressBar.vue       # 30-day progress bar
│   └── CodeBlock.vue         # highlight wrapper
├── layouts/
│   ├── default.vue           # layout with sidebar
│   └── home.vue              # homepage layout
├── nuxt.config.ts
└── tailwind.config.ts
```

### Routing
- `/` → Homepage
- `/days/day-01` → Day 1 lesson
- `/days/day-07` → Week 1 review
- etc.

---

## 3. Visual Design

### Visual Identity
- **Theme:** Dark (developer-first)
- **Primary colors:** Cyan (`#00E5CC`) + Magenta (`#FF006E`) — same visual identity as personal-website, diffspot, and configspot
- **Background:** `#0D0D0D` (near-black, not pure)
- **Surface cards:** `#1A1A1A` with `rgba(255,255,255,0.08)` border
- **Body font:** DM Sans (system-ui fallback)
- **Display font:** Space Grotesk
- **Code font:** JetBrains Mono

### Palette
| Token | Value |
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

### Typography
- `text-sm` muted for metadata (day, week)
- `text-2xl font-bold` for lesson titles
- `text-base leading-7` for prose
- Code blocks with line numbers and `github-dark` theme

---

## 4. Pages

### 4.1 Homepage (`/`)

**Sections:**
1. **Hero** — series title, subtitle, badge "30 days · Eduardo Falcão"
2. **Progress bar** — 30-day visual (shows published days vs total)
3. **Weeks** (4 blocks) — each week has a title + day grid
4. **Footer** — credits, link to edufalcao.com

**Hero copy:**
> **30 Days of Agentic Coding**
> A structured series on building agent systems — one lesson per day, each under 10 minutes.
> Week 1: Foundations · Week 2: Architecture · Week 3: Implementation · Week 4: Production

**Day grid:**
- 30 cards in responsive grid (5 columns desktop, 3 tablet, 2 mobile)
- Each card: day number + short title + week indicator
- Card hover: accent border + slight lift

---

### 4.2 Lesson Page (`/days/day-XX`)

**Layout:** Left sidebar (day list) + main content

**Components:**
- **Breadcrumb:** Home → Week X → Day N
- **Lesson header:** Day, week, title
- **Content:** Markdown rendered with Nuxt Content
- **Code blocks:** Shiki syntax highlighting with copy button
- **Nav:** Previous / Next buttons at the bottom of content
- **Sidebar:** Collapsible list by week, current day highlighted

---

## 5. HTML Mockups

Mockups are located in:
- `docs/mockups/home.html`
- `docs/mockups/day.html`

(Generated separately — see files)

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

## 7. Implementation Plan (phases)

**Phase 1 — Foundation (1-2h)**
- Scaffold Nuxt 4 + Nuxt Content + Tailwind
- Copy the 30 `.md` files to `content/days/`
- Dynamic routing working

**Phase 2 — Homepage (1h)**
- Hero layout + weekly grid
- Cards with hover states

**Phase 3 — Lesson Page (1h)**
- Layout with sidebar
- Previous/next navigation
- Code blocks with copy button

**Phase 4 — Polish (30min)**
- SEO meta tags
- Open Graph (sharing)
- Favicon + fonts

**Phase 5 — Deploy (15min)**
- Connect repo to Cloudflare Pages
- Configure DNS

**Total estimate:** ~4-5h of implementation

---

## 8. Design Decisions

| Decision | Alternative considered | Reason |
|----------|----------------------|--------|
| Dark theme | Light theme | Developer audience, code is central |
| Sidebar navigation | Top nav only | 30 days need quick access |
| Nuxt Content | Manual MDX | Zero boilerplate, built-in highlighting |
| Cloudflare Pages | Vercel | Already in Eduardo's Cloudflare ecosystem |
| Cyan + Magenta as primary colors | Blue/green | Consistency with personal-website, diffspot, and configspot |
