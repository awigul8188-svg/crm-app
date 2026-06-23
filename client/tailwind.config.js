/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"SF Pro Text"', '"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['"SF Pro Display"', '"Bricolage Grotesque"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Tech Atlantix exact brand cyan
        brand: {
          50:  '#e6fffd',
          100: '#b3fff9',
          200: '#66fff4',
          300: '#33ffef',
          400: '#00e5d8',
          500: '#00d4c8',   // Primary — exact cyan from logo
          600: '#00b8ad',
          700: '#009990',
          800: '#007a73',
          900: '#005c57',
        },
        // Sidebar / dark surfaces — near-black matching logo bg
        dark: {
          950: '#080808',
          900: '#0d0d0d',
          800: '#141414',
          700: '#1c1c1c',
          600: '#242424',
          500: '#2e2e2e',
          400: '#3a3a3a',
        },
        surface: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
        },
        ink: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          500: '#64748b',
          400: '#94a3b8',
          300: '#cbd5e1',
          200: '#e2e8f0',
        }
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)',
        'modal':      '0 24px 80px rgba(0,0,0,0.25)',
        'glow':       '0 0 20px rgba(0,212,200,0.3)',
      }
    }
  },
  plugins: [],
}
