/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#0a0e1a',
          800: '#111827',
          700: '#1a2235',
          600: '#1e2a40',
          500: '#243048',
        },
        brand: {
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
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
