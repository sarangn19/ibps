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
          green: '#16A34A',
          'green-dark': '#15803D',
          blue: '#2563EB',
          'blue-dark': '#1D4ED8',
          red: '#DC2626',
          'red-dark': '#B91C1C',
          yellow: '#E2E8F0',
          'yellow-dark': '#64748B',
          purple: '#DBEAFE',
          'purple-dark': '#2563EB',
          orange: '#F1F5F9',
          'orange-dark': '#64748B',
          bg: '#F8FAFC',
          border: '#E2E8F0',
        },
      },
      boxShadow: {
        lingo: '0 2px 0 rgba(15,23,42,0.10)',
        'lingo-sm': '0 1px 0 rgba(15,23,42,0.08)',
      },
    },
  },
  plugins: [],
}
