# 📖 Learning Hub

A static site hosting structured learning series on software engineering and AI. Built with Nuxt 3 and deployed to Cloudflare Pages.

**Live:** [learning.edufalcao.com](https://learning.edufalcao.com)

## Courses

### 30 Days of Agentic Coding

A 30-lesson series covering the fundamentals of building AI agent systems — from mental models to production deployment. Each lesson is designed for ~10 minutes of reading with practical exercises.

| Week | Theme | Days |
|------|-------|------|
| 1 | **Foundations** — What Is an Agent? | 1–7 |
| 2 | **Architecture** — Designing Agent Systems | 8–14 |
| 3 | **Implementation** — Building Real Agents | 15–21 |
| 4 | **Production** — Advanced & Real-World | 22–30 |

Topics include: the agent loop, tools & function calling, context management, memory, MCP, multi-agent orchestration, debugging, testing, security, observability, cost optimization, HITL patterns, and more.

## Stack

- **[Nuxt 4](https://nuxt.com)** — Vue framework with static generation (`nuxt generate`)
- **[@nuxt/content](https://content.nuxt.com)** — Markdown-driven content, auto-routing, Shiki syntax highlighting
- **[Tailwind CSS](https://tailwindcss.com)** — Utility-first styling
- **[Cloudflare Pages](https://pages.cloudflare.com)** — Static hosting with automatic deployments

## Project Structure

```
├── app/                             # Nuxt 4 app directory
│   ├── app.vue
│   ├── pages/
│   │   ├── index.vue                # Hub landing page (course grid)
│   │   └── [course]/
│   │       ├── index.vue            # Course homepage (hero, progress, weekly grid)
│   │       └── [slug].vue           # Lesson page (sidebar, content, prev/next nav)
│   ├── components/
│   │   ├── DayCard.vue              # Lesson card in the weekly grid
│   │   ├── WeekSection.vue          # Weekly grouping with header
│   │   ├── LessonSidebar.vue        # Sidebar navigation (all days)
│   │   ├── LessonNav.vue            # Previous/Next lesson navigation
│   │   ├── ProgressBar.vue          # 30-day visual progress bar
│   │   ├── SiteNav.vue              # Top navigation bar
│   │   └── SiteFooter.vue           # Footer with credits
│   ├── composables/
│   ├── layouts/
│   │   └── default.vue
│   └── assets/
├── content/                         # Stays at root (Nuxt Content)
│   ├── courses/
│   │   └── agentic-coding.yml       # Course metadata (title, weeks, colors)
│   └── agentic-coding/
│       └── day-01.md ... day-30.md
├── public/
│   └── favicon.svg                  # Open book favicon
├── nuxt.config.ts
├── tailwind.config.ts
└── .github/workflows/deploy.yml     # CI/CD to Cloudflare Pages
```

## Adding a New Course

1. Create the course metadata file:
   ```yaml
   # content/courses/my-course.yml
   title: "Course Title"
   description: "Short description."
   slug: my-course
   color: "#10B981"
   lessons: 10
   weeks:
     - number: 1
       name: "Week Name"
       subtitle: "Week subtitle"
       color: "#3B82F6"
   ```

2. Add lesson files with frontmatter:
   ```
   content/my-course/day-01.md ... day-10.md
   ```

3. The hub landing page and routing pick up new courses automatically.

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (http://localhost:3000)
pnpm dev

# Generate static site
pnpm generate

# Preview static build
pnpm preview
```

## Deployment

Automatic via GitHub Actions on push to `main`. The workflow:

1. Installs dependencies (`pnpm install --frozen-lockfile`)
2. Generates static output (`pnpm generate`)
3. Deploys `.output/public` to Cloudflare Pages

**Required GitHub secrets:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Design

- **Theme:** Dark, developer-first
- **Accent:** Amber (`#F59E0B`)
- **Typography:** Space Grotesk (headings) + Outfit (body) + JetBrains Mono (code)
- **Code blocks:** Shiki `github-dark` theme with copy button
- **Responsive:** Mobile-first, 2-column layout on desktop (sidebar + content)

## License

Content is © Eduardo Falcão. All rights reserved.
