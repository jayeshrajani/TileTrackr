/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        apple: {
          blue: '#6366f1',
          'blue-hover': '#4f46e5',
          'blue-light': 'rgba(99,102,241,0.06)',
          gray: '#f8fafc',
          'gray-2': '#f1f5f9',
          'gray-3': '#e2e8f0',
          'text-1': '#0f172a',
          'text-2': '#475569',
          'text-3': '#94a3b8',
          red: '#ef4444',
          green: '#10b981',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        'apple-xs': '0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
        'apple-sm': '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        apple: '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'apple-lg': '0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
        'apple-modal': '0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        '2xl': '14px',
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

