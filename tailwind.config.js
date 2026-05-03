/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        apple: {
          blue: '#0071e3',
          'blue-hover': '#0066cc',
          'blue-light': 'rgba(0,113,227,0.08)',
          gray: '#f5f5f7',
          'gray-2': '#e8e8ed',
          'gray-3': '#d2d2d7',
          'text-1': '#1d1d1f',
          'text-2': '#6e6e73',
          'text-3': '#aeaeb2',
          red: '#ff3b30',
          green: '#34c759',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        'apple-xs': '0 1px 3px rgba(0,0,0,0.06)',
        'apple-sm': '0 2px 10px rgba(0,0,0,0.08)',
        apple: '0 4px 20px rgba(0,0,0,0.1)',
        'apple-lg': '0 8px 40px rgba(0,0,0,0.14)',
        'apple-modal': '0 32px 80px rgba(0,0,0,0.22)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '22px',
        '4xl': '28px',
      },
      backdropBlur: {
        xl: '20px',
      },
    },
  },
  plugins: [],
}

