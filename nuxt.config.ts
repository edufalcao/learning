export default defineNuxtConfig({

  modules: [
    '@nuxt/content',
    '@nuxt/eslint',
    '@nuxtjs/color-mode',
    '@nuxtjs/tailwindcss'
  ],

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Eduardo Falcão — learning hub',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Structured learning series on software engineering & AI. By Eduardo Falcão.' },
        { property: 'og:title', content: 'Eduardo Falcão — learning hub' },
        { property: 'og:description', content: 'Structured learning series on software engineering & AI.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://learning.edufalcao.com' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Eduardo Falcão — learning hub' },
        { name: 'twitter:description', content: 'Structured learning series on software engineering & AI.' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700;800&display=swap' }
      ]
    },
    pageTransition: { name: 'page', mode: 'out-in' }
  },

  colorMode: {
    classSuffix: '',
    preference: 'dark',
    fallback: 'dark'
  },

  content: {
    build: {
      markdown: {
        highlight: {
          theme: 'github-dark',
          langs: [
            'javascript', 'typescript', 'python', 'json', 'bash', 'shell',
            'yaml', 'markdown', 'html', 'css', 'sql', 'go', 'rust'
          ]
        }
      }
    }
  },

  future: {
    compatibilityVersion: 4
  },
  compatibilityDate: '2025-06-01',

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/']
    }
  },

  eslint: {
    config: {
      stylistic: {
        semi: true,
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
});
