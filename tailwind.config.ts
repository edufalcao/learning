import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default <Config>{
  content: [
    './components/**/*.vue',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue'
  ],
  theme: {
    extend: {
      colors: {
        'accent': {
          DEFAULT: 'var(--color-accent)',
          dim: 'var(--color-accent-dim)',
          glow: 'var(--glow-accent)'
        },
        'accent2': {
          DEFAULT: 'var(--color-accent-2)',
          dim: 'var(--color-accent-2-dim)',
          glow: 'var(--glow-accent-2)'
        },
        'bg': 'var(--color-bg)',
        'surface': {
          DEFAULT: 'var(--color-surface)',
          2: 'var(--color-elevated)'
        },
        'border': 'var(--color-border)',
        'text-main': 'var(--color-text)',
        'text-muted': 'var(--color-muted)',
        'text-dim': 'var(--color-dim)',
        'code-bg': 'var(--color-surface)',
        'week1': '#3B82F6',
        'week2': '#10B981',
        'week3': '#8B5CF6',
        'week4': '#FF006E'
      },
      fontFamily: {
        sans: ['DM Sans', 'Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Space Grotesk', 'DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace']
      },
      animation: {
        'fade-in': 'fadeIn 0.8s ease-out',
        'slide-up': 'slideUp 0.6s ease-out'
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)'
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': 'var(--color-prose-body)',
            '--tw-prose-headings': 'var(--color-headings)',
            '--tw-prose-links': 'var(--color-accent)',
            '--tw-prose-bold': 'var(--color-headings)',
            '--tw-prose-code': 'var(--color-accent)',
            '--tw-prose-pre-bg': 'var(--color-surface)',
            '--tw-prose-pre-code': 'var(--color-prose-body)',
            '--tw-prose-quotes': 'var(--color-dim)',
            '--tw-prose-quote-borders': 'var(--color-accent)',
            '--tw-prose-counters': 'var(--color-muted)',
            '--tw-prose-bullets': 'var(--color-muted)',
            '--tw-prose-hr': 'var(--color-border)',
            '--tw-prose-th-borders': 'var(--color-border)',
            '--tw-prose-td-borders': 'var(--color-border)',
            'h2': {
              color: 'var(--color-headings)',
              fontWeight: '700',
              letterSpacing: '-0.02em'
            },
            'h3': {
              color: 'var(--color-text)',
              fontWeight: '600'
            },
            'a': {
              'color': 'var(--color-accent)',
              'textDecoration': 'none',
              '&:hover': {
                textDecoration: 'underline'
              }
            },
            'code:not(pre code)': {
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              fontSize: '0.82em',
              background: 'var(--color-code-inline-bg)',
              border: '1px solid var(--color-border)',
              padding: '0.1em 0.35em',
              borderRadius: '4px',
              color: 'var(--color-accent)',
              fontWeight: '400'
            },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            'pre': {
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '1.25rem 1rem',
              fontSize: '0.875rem',
              lineHeight: '1.65'
            },
            'pre code': {
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              fontSize: '0.875rem'
            },
            'blockquote': {
              borderLeftColor: 'var(--color-accent)',
              background: 'var(--color-blockquote-bg)',
              padding: '1rem 1.25rem',
              borderRadius: '0 8px 8px 0',
              fontStyle: 'normal'
            },
            'blockquote p': {
              color: 'var(--color-text)'
            },
            'table': {
              fontSize: '0.85rem'
            },
            'thead tr': {
              borderBottomColor: 'var(--color-border)'
            },
            'th': {
              color: 'var(--color-dim)',
              fontWeight: '600',
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            },
            'td': {
              borderBottomColor: 'var(--color-border)'
            },
            'hr': {
              borderColor: 'var(--color-border)'
            },
            'strong': {
              color: 'var(--color-headings)',
              fontWeight: '600'
            },
            'em': {
              color: 'var(--color-dim)'
            }
          }
        }
      }
    }
  },
  plugins: [typography]
};
