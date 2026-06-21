import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Share Tech Mono"', '"Courier New"', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
      },
      colors: {
        ds: {
          black: '#0a0a0f',
          green: '#00ff41',
          'green-dim': '#00cc33',
          'green-dark': '#003300',
          blue: '#0ff',
          purple: '#bf5fff',
          red: '#ff2d55',
          yellow: '#ffd60a',
          gray: '#1a1a2e',
          'gray-light': '#16213e',
          border: '#1e2d1e',
        },
      },
      animation: {
        scanline: 'scanline 8s linear infinite',
        blink: 'blink 1s step-start infinite',
        'pulse-green': 'pulseGreen 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        flicker: 'flicker 0.15s infinite',
      },
      keyframes: {
        scanline: {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        pulseGreen: {
          '0%, 100%': { boxShadow: '0 0 5px #00ff41, 0 0 10px #00ff41' },
          '50%': {
            boxShadow:
              '0 0 20px #00ff41, 0 0 40px #00ff41, 0 0 60px #00ff41',
          },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.95' },
        },
      },
      backgroundImage: {
        'grid-green':
          'linear-gradient(rgba(0,255,65,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.03) 1px, transparent 1px)',
        scanlines:
          'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)',
      },
      backgroundSize: {
        'grid-sm': '30px 30px',
      },
    },
  },
  plugins: [],
};

export default config;
