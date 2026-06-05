/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // All theme-aware tokens map to CSS variables (see src/index.css).
        // This lets us swap light/dark with a smooth, single-class transition.
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        ink: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--border) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          2: 'rgb(var(--accent-2) / <alpha-value>)',
        },
      },
      boxShadow: {
        glass: '0 8px 32px -8px rgba(0, 0, 0, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.04)',
        glow: '0 0 0 1px rgb(var(--accent) / 0.35), 0 8px 40px -8px rgb(var(--accent) / 0.45)',
      },
      borderRadius: {
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'aurora-shift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(4%, -6%) scale(1.08)' },
          '66%': { transform: 'translate(-5%, 4%) scale(0.96)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite',
        aurora: 'aurora-shift 22s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
