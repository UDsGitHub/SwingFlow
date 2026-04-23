/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          950: '#07090f',
          900: '#0b0f1a',
          800: '#101624',
          750: '#141d2e',
          700: '#192236',
          600: '#1f2d44',
          500: '#283857',
          400: '#344970',
        },
        brand: {
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        bull: {
          400: '#4ade80',
          500: '#22c55e',
        },
        bear: {
          400: '#f87171',
          500: '#ef4444',
        },
        warn: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        data: {
          up: '#4ade80',
          down: '#f87171',
          neutral: '#94a3b8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'sf-section': ['0.8125rem', { lineHeight: '1.25rem', fontWeight: '600' }],
        'sf-label': ['0.75rem', { lineHeight: '1.125rem', fontWeight: '400' }],
        'sf-field': ['0.6875rem', { lineHeight: '1rem', fontWeight: '400' }],
        'sf-body': ['0.875rem', { lineHeight: '1.375rem', fontWeight: '400' }],
        'sf-value': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        'sf-value-lg': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '700' }],
        'sf-cell': ['0.8125rem', { lineHeight: '1.25rem', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};
