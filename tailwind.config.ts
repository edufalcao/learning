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
        accent: {
          DEFAULT: '#00E5CC',
          dim: '#005C52',
          glow: 'rgba(0,229,204,0.15)',
        },
        accent2: {
          DEFAULT: '#FF006E',
          dim: '#660029',
          glow: 'rgba(255,0,110,0.15)',
        },
        bg: '#0D0D0D',
        surface: {
          DEFAULT: '#1A1A1A',
          2: '#242424',
        },
        border: 'hsla(0, 0%, 100%, 0.08)',
        'text-main': '#F5F5F5',
        'text-muted': '#8B8B8B',
        'text-dim': '#999999',
        'code-bg': '#1A1A1A',
        week1: '#3B82F6',
        week2: '#10B981',
        week3: '#8B5CF6',
        week4: '#00E5CC',
      },
      fontFamily: {
        sans: ['DM Sans', 'Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Space Grotesk', 'DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.8s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#C9C9C9',
            '--tw-prose-headings': '#ffffff',
            '--tw-prose-links': '#00E5CC',
            '--tw-prose-bold': '#ffffff',
            '--tw-prose-code': '#00E5CC',
            '--tw-prose-pre-bg': '#1A1A1A',
            '--tw-prose-pre-code': '#D4D4D4',
            '--tw-prose-quotes': '#999999',
            '--tw-prose-quote-borders': '#00E5CC',
            '--tw-prose-counters': '#8B8B8B',
            '--tw-prose-bullets': '#8B8B8B',
            '--tw-prose-hr': 'hsla(0, 0%, 100%, 0.08)',
            '--tw-prose-th-borders': 'hsla(0, 0%, 100%, 0.08)',
            '--tw-prose-td-borders': 'hsla(0, 0%, 100%, 0.08)',
            'h2': {
              color: '#ffffff',
              fontWeight: '700',
              letterSpacing: '-0.02em',
            },
            'h3': {
              color: '#F5F5F5',
              fontWeight: '600',
            },
            'a': {
              color: '#00E5CC',
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
              color: '#00E5CC',
              fontWeight: '400',
            },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            'pre': {
              background: '#1A1A1A',
              border: '1px solid rgba(255,255,255,0.08)',
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
              borderLeftColor: '#00E5CC',
              background: 'rgba(0,229,204,0.05)',
              padding: '1rem 1.25rem',
              borderRadius: '0 8px 8px 0',
              fontStyle: 'normal',
            },
            'blockquote p': {
              color: '#F5F5F5',
            },
            'table': {
              fontSize: '0.85rem',
            },
            'thead tr': {
              borderBottomColor: 'rgba(255,255,255,0.08)',
            },
            'th': {
              color: '#999999',
              fontWeight: '600',
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            },
            'td': {
              borderBottomColor: 'rgba(255,255,255,0.08)',
            },
            'hr': {
              borderColor: 'rgba(255,255,255,0.08)',
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
