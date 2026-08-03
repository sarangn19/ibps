/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lingo: {
          green: '#58CC02',
          'green-dark': '#46A302',
          blue: '#1CB0F6',
          'blue-dark': '#1899D6',
          red: '#FF4B4B',
          'red-dark': '#D33131',
          yellow: '#FFC800',
          'yellow-dark': '#E0A800',
          purple: '#CE82FF',
          'purple-dark': '#A568CC',
          orange: '#FF9600',
          'orange-dark': '#CC7A00',
          bg: '#F7F7F7',
          border: '#E5E5E5',
        },
      },
      boxShadow: {
        lingo: '0 4px 0 rgba(0,0,0,0.15)',
        'lingo-sm': '0 2px 0 rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
