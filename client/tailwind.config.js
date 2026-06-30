/** @type {import('tailwindcss').Config} */
export default {
  important: '#root',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    { pattern: /bg-(amber|blue|purple|green|cyan|orange|rose|teal|indigo|pink|gray|red|yellow|emerald|slate|violet|sky)-(50|100|200|300|400|500|600|700)/ },
    { pattern: /text-(amber|blue|purple|green|cyan|orange|rose|teal|indigo|pink|gray|red|yellow|emerald|slate|violet|sky|primary)-(50|100|200|300|400|500|600|700|800|900)/ },
    { pattern: /border-(amber|blue|purple|green|cyan|orange|rose|teal|indigo|pink|gray|red|yellow|primary)-(50|100|200|300|400|500|600|700)/ },
    { pattern: /from-(amber|blue|purple|green|orange|rose|red|gray|emerald|indigo|slate)-\d+/ },
    { pattern: /to-(amber|blue|purple|green|orange|rose|red|gray|emerald|indigo|slate)-\d+/ },
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
};
