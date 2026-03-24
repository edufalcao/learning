export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  modules: [
    '@nuxt/content',
    '@nuxtjs/tailwindcss',
  ],

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Eduardo Falcão — Learning Hub',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Structured learning series on software engineering & AI. By Eduardo Falcão.' },
        { property: 'og:title', content: 'Eduardo Falcão — Learning Hub' },
        { property: 'og:description', content: 'Structured learning series on software engineering & AI.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://learning.edufalcao.com' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Eduardo Falcão — Learning Hub' },
        { name: 'twitter:description', content: 'Structured learning series on software engineering & AI.' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap' },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  content: {
    build: {
      markdown: {
        highlight: {
          theme: 'github-dark',
          langs: [
            'javascript', 'typescript', 'python', 'json', 'bash', 'shell',
            'yaml', 'markdown', 'html', 'css', 'sql', 'go', 'rust',
          ],
        },
      },
    },
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/'],
    },
  },
})
