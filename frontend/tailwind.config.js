/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          950: 'rgb(var(--surface-950) / <alpha-value>)',
          900: 'rgb(var(--surface-900) / <alpha-value>)',
          800: 'rgb(var(--surface-800) / <alpha-value>)',
          750: 'rgb(var(--surface-750) / <alpha-value>)',
          700: 'rgb(var(--surface-700) / <alpha-value>)',
          600: 'rgb(var(--surface-600) / <alpha-value>)',
          500: 'rgb(var(--surface-500) / <alpha-value>)',
          400: 'rgb(var(--surface-400) / <alpha-value>)',
        },
        brand: {
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
        },
        bull: {
          400: 'rgb(var(--bull-400) / <alpha-value>)',
          500: 'rgb(var(--bull-500) / <alpha-value>)',
        },
        bear: {
          400: 'rgb(var(--bear-400) / <alpha-value>)',
          500: 'rgb(var(--bear-500) / <alpha-value>)',
        },
        warn: {
          400: 'rgb(var(--warn-400) / <alpha-value>)',
          500: 'rgb(var(--warn-500) / <alpha-value>)',
        },
        data: {
          up: 'rgb(var(--data-up) / <alpha-value>)',
          down: 'rgb(var(--data-down) / <alpha-value>)',
          neutral: 'rgb(var(--data-neutral) / <alpha-value>)',
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
