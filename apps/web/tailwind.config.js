/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/shared/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0f1b33',
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#627d98',
          500: '#486581',
          600: '#334e68',
          700: '#243b53',
          800: '#182744',
          900: '#0f1b33',
          950: '#0a1222',
        },
        primary: {
          DEFAULT: '#0f1b33',
          dark: '#0a1222',
          light: '#1e2d4d',
          hover: '#182744',
        },
        status: {
          healthy: {
            DEFAULT: '#10b981', // green
            light: '#d1fae5',
            dark: '#065f46',
          },
          warning: {
            DEFAULT: '#f59e0b', // yellow/amber
            light: '#fef3c7',
            dark: '#92400e',
          },
          critical: {
            DEFAULT: '#ef4444', // red
            light: '#fee2e2',
            dark: '#991b1b',
          },
          informational: {
            DEFAULT: '#3b82f6', // blue
            light: '#dbeafe',
            dark: '#1e40af',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
