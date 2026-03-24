import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default <Config>{
  content: [
    './components/**/*.vue',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#F59E0B',
          dim: '#78350F',
          glow: 'rgba(245,158,11,0.15)',
        },
        bg: '#0A0A0A',
        surface: {
          DEFAULT: '#111111',
          2: '#161616',
        },
        border: '#222222',
        'text-main': '#E5E5E5',
        'text-muted': '#666666',
        'text-dim': '#999999',
        'code-bg': '#141414',
        week1: '#3B82F6',
        week2: '#10B981',
        week3: '#8B5CF6',
        week4: '#F59E0B',
      },
      fontFamily: {
        sans: ['Outfit', 'Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Space Grotesk', 'Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#C9C9C9',
            '--tw-prose-headings': '#ffffff',
            '--tw-prose-links': '#F59E0B',
            '--tw-prose-bold': '#ffffff',
            '--tw-prose-code': '#F59E0B',
            '--tw-prose-pre-bg': '#141414',
            '--tw-prose-pre-code': '#D4D4D4',
            '--tw-prose-quotes': '#999999',
            '--tw-prose-quote-borders': '#F59E0B',
            '--tw-prose-counters': '#666666',
            '--tw-prose-bullets': '#666666',
            '--tw-prose-hr': '#222222',
            '--tw-prose-th-borders': '#222222',
            '--tw-prose-td-borders': '#222222',
            'h2': {
              color: '#ffffff',
              fontWeight: '700',
              letterSpacing: '-0.02em',
            },
            'h3': {
              color: '#E5E5E5',
              fontWeight: '600',
            },
            'a': {
              color: '#F59E0B',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
            'code:not(pre code)': {
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              fontSize: '0.82em',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '0.1em 0.35em',
              borderRadius: '4px',
              color: '#F59E0B',
              fontWeight: '400',
            },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            'pre': {
              background: '#141414',
              border: '1px solid #222222',
              borderRadius: '10px',
              padding: '1.25rem 1rem',
              fontSize: '0.825rem',
              lineHeight: '1.65',
            },
            'pre code': {
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              fontSize: '0.825rem',
            },
            'blockquote': {
              borderLeftColor: '#F59E0B',
              background: 'rgba(245,158,11,0.05)',
              padding: '1rem 1.25rem',
              borderRadius: '0 8px 8px 0',
              fontStyle: 'normal',
            },
            'blockquote p': {
              color: '#E5E5E5',
            },
            'table': {
              fontSize: '0.85rem',
            },
            'thead tr': {
              borderBottomColor: '#222222',
            },
            'th': {
              color: '#999999',
              fontWeight: '600',
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            },
            'td': {
              borderBottomColor: '#222222',
            },
            'hr': {
              borderColor: '#222222',
            },
            'strong': {
              color: '#ffffff',
              fontWeight: '600',
            },
            'em': {
              color: '#999999',
            },
          },
        },
      },
    },
  },
  plugins: [typography],
}
