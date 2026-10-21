/** @type {import('tailwindcss').Config} */

// Single brand accent (terracotta). Existing `indigo-*` / `violet-*` classes across
// the app resolve to this scale, so the accent stays consistent everywhere.
const clay = {
  50: '#fbf5f1',
  100: '#f6e7de',
  200: '#edcbb9',
  300: '#e1a88c',
  400: '#d0774f',
  500: '#b9562f',
  600: '#9c4626',
  700: '#7f3a22',
  800: '#66311f',
  900: '#542a1d',
  950: '#2e140c',
}

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        clay,
        indigo: clay,
        violet: clay,
        purple: clay,
        apple: {
          blue: clay[600],
          'blue-hover': clay[700],
          'blue-light': 'rgba(156,70,38,0.08)',
          gray: '#f8fafc',
          'gray-2': '#f1f5f9',
          'gray-3': '#e2e8f0',
          'text-1': '#0f172a',
          'text-2': '#475569',
          'text-3': '#94a3b8',
          red: '#dc2626',
          green: '#059669',
        },
      },
      fontFamily: {
        sans: [
          'Geist',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        'apple-xs': '0 1px 2px rgba(15,23,42,0.05)',
        'apple-sm': '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px -2px rgba(15,23,42,0.06)',
        apple: '0 2px 4px rgba(15,23,42,0.04), 0 8px 24px -4px rgba(15,23,42,0.10)',
        'apple-lg': '0 4px 8px rgba(15,23,42,0.04), 0 16px 40px -8px rgba(15,23,42,0.16)',
        'apple-modal': '0 -8px 32px -8px rgba(15,23,42,0.18), 0 24px 64px -12px rgba(15,23,42,0.28)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '28px',
      },
      backdropBlur: {
        xl: '24px',
      },
      screens: {
        'xs': '475px',
      },
    },
  },
  plugins: [],
}

