/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // `sans` follows the user's typography preference (useFontScale writes
        // --font-sans); DM Sans is the design-system default.
        sans: ['var(--font-sans)', 'DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        // Modern geometric sans for brand identity and hero titles.
        outfit: ['Outfit', 'DM Sans', 'system-ui', 'sans-serif'],
        brand: ['Outfit', 'Inter', 'DM Sans', 'sans-serif'],
        // Display serif for hero numbers and widget/section titles.
        display: ['Fraunces', 'Lora', 'Georgia', 'serif'],
        // Counters, time labels, badges.
        mono: ['DM Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
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
        // Premium design-system surfaces (docs/DESIGN_SYSTEM.md §2).
        canvas: 'var(--color-canvas)',
        island: 'var(--color-island)',
      },
      boxShadow: {
        // Elevation scale — obsidian-friendly, soft, with an inner top highlight.
        glass:
          'inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 8px 30px -12px rgba(0, 0, 0, 0.5)',
        'glass-lg':
          'inset 0 1px 0 0 rgba(255, 255, 255, 0.06), 0 28px 70px -24px rgba(0, 0, 0, 0.7)',
        glow: '0 0 0 1px rgb(var(--accent) / 0.35), 0 12px 44px -12px rgb(var(--accent) / 0.5)',
        'glow-sm': '0 0 22px -6px rgb(var(--accent) / 0.55)',
        // Premium design system elevation
        'premium-sm': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'premium-md': '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'premium-lg': '0 8px 40px rgba(0,0,0,0.12)',
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
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '33%': { transform: 'translate3d(4%, -6%, 0) scale(1.08)' },
          '66%': { transform: 'translate3d(-5%, 4%, 0) scale(0.96)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.1' },
          '50%': { opacity: '1' },
        },
        // Meteor + drifter keyframes live in index.css (they read per-object CSS
        // vars set by SpaceObjects.jsx for randomized direction/distance).
        'moon-bob': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite',
        aurora: 'aurora-shift 22s ease-in-out infinite',
        twinkle: 'twinkle 4.5s ease-in-out infinite',
        'moon-bob': 'moon-bob 12s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
