import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas:   'rgb(var(--canvas-rgb) / <alpha-value>)',
        surface:  'rgb(var(--surface-rgb) / <alpha-value>)',
        ink:      'rgb(var(--ink-rgb) / <alpha-value>)',
        muted:    'rgb(var(--muted-rgb) / <alpha-value>)',
        subtle:   'rgb(var(--subtle-rgb) / <alpha-value>)',
        border:   'var(--border)',
        critical: 'rgb(var(--critical-rgb) / <alpha-value>)',
        warning:  'rgb(var(--warning-rgb) / <alpha-value>)',
        info:     'rgb(var(--info-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        hero: ['68px', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg:  '12px',
        xl:  '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        card:     '0 4px 24px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.10)',
        nav:      '0 1px 0 rgba(0,0,0,0.06)',
      },
      animation: {
        'fade-in':  'fadeIn 300ms ease-out',
        'slide-up': 'slideUp 350ms ease-out',
        shimmer:    'shimmer 1.6s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition:  '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
