/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          50:  'rgba(0,212,200,0.08)',
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
        dark: {
          950: '#060609',
          900: '#0d0d14',
          800: '#13131f',
          700: '#1a1a2a',
          600: '#222236',
          500: '#2c2c42',
          400: '#383854',
        },
        // Light surface tokens — now pointing to dark values
        surface: {
          50:  '#0d0d14',
          100: '#13131f',
          200: '#1a1a2a',
        },
        // Text tokens — flipped to light-on-dark
        ink: {
          900: '#ffffff',
          800: 'rgba(255,255,255,0.87)',
          700: 'rgba(255,255,255,0.70)',
          500: 'rgba(255,255,255,0.50)',
          400: 'rgba(255,255,255,0.35)',
          300: 'rgba(255,255,255,0.20)',
          200: 'rgba(255,255,255,0.10)',
        }
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
        'card-hover': '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,200,0.2)',
        'modal':      '0 32px 100px rgba(0,0,0,0.6)',
        'glow':       '0 0 30px rgba(0,212,200,0.25)',
        'glow-lg':    '0 0 60px rgba(0,212,200,0.2)',
      }
    }
  },
  plugins: [],
}
