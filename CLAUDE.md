# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

learning hub is a static site hosting structured learning series on software engineering and AI. Currently features "30 Days of Agentic Coding" — a 30-lesson series covering AI agent fundamentals through production deployment. Sibling product to [diffspot](https://github.com/edufalcao/diffspot) and [configspot](https://github.com/edufalcao/configspot), sharing the same design language.

**Live:** [learning.edufalcao.com](https://learning.edufalcao.com)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Nuxt 4 (Vue 3 + TypeScript) |
| Content | @nuxt/content (Markdown-driven, Shiki syntax highlighting) |
| Styling | Tailwind CSS 3 (via `@nuxtjs/tailwindcss`) + `@tailwindcss/typography` |
| Icons | None (inline SVGs) |
| Fonts | Google Fonts (Space Grotesk, DM Sans, JetBrains Mono) |
| Hosting | Cloudflare Pages (static output via `nuxt generate`) |
| Linting | ESLint 10 |

## Commands

```bash
pnpm dev            # Start dev server
pnpm generate       # Generate static site (outputs to .output/public)
pnpm preview        # Preview static build
pnpm lint           # Run ESLint
pnpm typecheck      # Run Nuxt typecheck
```

## Verification

Run this checklist before considering any implementation task complete:

```bash
pnpm lint
pnpm typecheck
pnpm generate
```

If any step cannot run or fails for an external reason, call that out explicitly.

## Design System

Shared with diffspot, configspot, and edufalcao.com — dark terminal-chic aesthetic:

- **Dark mode default** — Background: `#0d0d0d`, Surface: `#1a1a1a`, Elevated: `#242424`
- **Light mode** — Background: `#fafafa`, Surface: `#ffffff`, Elevated: `#f0f0f0`
- **Accent colors** — Cyan: `#00e5cc` (dark) / `#00b39e` (light), Pink: `#ff006e` (dark) / `#e0005f` (light)
- **Fonts** — Space Grotesk (headings), DM Sans (body), JetBrains Mono (code)
- **Effects** — Noise overlay, radial gradient background, glow on hover, page transitions
- **Design tokens** — CSS variables in `app/app.vue`, Tailwind theme in `tailwind.config.ts`
- **Week colors** — Week 1: `#3B82F6` (blue), Week 2: `#10B981` (green), Week 3: `#8B5CF6` (purple), Week 4: `#FF006E` (pink)

## Architecture

### Source Structure

```
app/
├── components/
│   ├── SiteNav.vue          # Header (brand, GitHub link, theme toggle)
│   ├── SiteFooter.vue       # Footer (credits, Nuxt link)
│   ├── DayCard.vue          # Lesson card in the weekly grid
│   ├── WeekSection.vue      # Weekly grouping with colored header
│   ├── LessonSidebar.vue    # Sidebar navigation (all days, grouped by week)
│   ├── LessonNav.vue        # Previous/Next lesson navigation
│   └── ProgressBar.vue      # 30-day visual progress bar
├── composables/
│   ├── useDays.ts           # Day/lesson data utilities
│   └── useProgress.ts       # Lesson completion tracking (localStorage)
├── layouts/
│   └── default.vue          # Default layout with SiteNav
├── pages/
│   ├── index.vue            # Hub landing page (course grid)
│   └── [course]/
│       ├── index.vue        # Course homepage (hero, progress, weekly grid)
│       └── [slug].vue       # Lesson page (sidebar, content, prev/next nav)
└── assets/css/
    └── tailwind.css         # Tailwind directives

content/                     # Stays at repo root (Nuxt Content requirement)
├── courses/
│   └── agentic-coding.yml   # Course metadata (title, weeks, colors)
└── agentic-coding/
    └── day-01.md ... day-30.md

source-content/              # Curriculum planning docs
└── PLAN.md                  # 30-day lesson plan
```

### Content Model

Courses are defined by a YAML metadata file in `content/courses/` and lesson Markdown files in `content/<course-slug>/`. Each lesson has frontmatter:

```yaml
title: "Lesson Title"
day: 1
week: 1
weekName: "Foundations"
description: "Short description"
tag: "core"
```

New courses are auto-discovered — add the metadata file and lesson files, and the hub page picks them up.

## Conventions

- TypeScript throughout
- Composition API with `<script setup>` syntax
- Tailwind utility classes; design tokens via CSS variables + `tailwind.config.ts`
- Components: PascalCase (e.g., `DayCard.vue`)
- Composables: `use*` naming (e.g., `useProgress.ts`)
- Lesson files: `day-NN.md` naming (e.g., `day-01.md`)
- Course metadata: `<course-slug>.yml` in `content/courses/`

## Deployment

Automatic via GitHub Actions (`.github/workflows/deploy.yml`) on push to `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm generate`
3. Deploy `.output/public` to Cloudflare Pages

**Required GitHub secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
