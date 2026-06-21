import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        ds: {
          blue: '#4da2ff',
          'blue-soft': '#dff1ff',
          'blue-pale': '#f3faff',
          ink: '#102a43',
          muted: '#627d98',
          line: '#d8e7f1',
          shell: '#edf3f7',
          screen: '#071b2d',
          coral: '#ff6b6b',
          green: '#28b888',
        },
      },
    },
  },
  plugins: [],
};

export default config;
