/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          50:  'var(--brand-dim)',
          100: 'rgba(0,212,200,0.15)',
          200: 'rgba(0,212,200,0.25)',
          300: '#00e5d8',
          400: '#00d4c8',
          500: '#00d4c8',
          600: '#00b8ad',
          700: '#009990',
          800: '#007a73',
          900: '#005c57',
        },
        // Surface — point to CSS variables (theme-aware)
        surface: {
          50:  'var(--bg)',
          100: 'var(--card)',
          200: 'var(--card-2)',
        },
        // Ink text tokens — CSS variables so they switch with theme
        ink: {
          900: 'var(--text)',
          800: 'var(--text)',
          700: 'var(--text-2)',
          600: 'var(--text-2)',
          500: 'var(--text-2)',
          400: 'var(--text-3)',
          300: 'var(--text-4)',
          200: 'var(--text-4)',
        },
      },
      boxShadow: {
        card:      '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px var(--border)',
        'card-hover': '0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px var(--brand)',
        modal:     '0 32px 100px rgba(0,0,0,0.5)',
        glow:      '0 0 30px var(--brand-glow)',
        'glow-lg': '0 0 60px var(--brand-glow)',
      }
    }
  },
  plugins: [],
}
