export const THEME_TOKENS = {
  colors: {
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
    slate: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    }
  }
} as const;
