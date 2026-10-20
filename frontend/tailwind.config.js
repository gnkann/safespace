/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: { 50: '#f0f7f6', 600: '#1f6f68', 700: '#175650' } },
    },
  },
  plugins: [],
};
