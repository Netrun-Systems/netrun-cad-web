/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'cad-bg': '#1a1a2e',
        'cad-grid': '#16213e',
        'cad-accent': '#0f3460',
        'cad-highlight': '#e94560',
        'cad-surface': '#0f0f23',
        'cad-text': '#e0e0e0',
        'cad-dim': '#7b7b8e',
      },
    },
  },
  plugins: [],
};
