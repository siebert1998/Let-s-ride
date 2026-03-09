import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        shell: '#090d12',
        panel: '#111922',
        panelSoft: '#18232f',
        line: '#263444',
        textMain: '#f2f7f7',
        textMuted: '#9cadbf',
        accent: '#b5ff49',
        accentStrong: '#8be01e',
      },
      boxShadow: {
        card: '0 10px 40px rgba(0, 0, 0, 0.35)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
