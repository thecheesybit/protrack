import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

/**
 * Maps a local hour (0-23) to a chrono band.
 * @param {number} hour
 * @returns {'dawn'|'day'|'dusk'|'night'}
 */
export function bandForHour(hour) {
  if (hour >= 5 && hour < 9) return 'dawn'
  if (hour >= 9 && hour < 17) return 'day'
  if (hour >= 17 && hour < 21) return 'dusk'
  return 'night'
}

/**
 * Time-of-day accent palette. The global `--accent` (used by every glow, ring,
 * gradient, button, and aurora blob) rotates through the day in BOTH light and
 * dark themes. Each entry carries the RGB channel triplet (for Tailwind's
 * `<alpha-value>` support) plus a hex for raw consumers.
 *
 *  dawn  → warm rose      day   → sky blue
 *  dusk  → amber / orange  night → deep violet
 */
export const CHRONO_ACCENT = {
  dawn: { accent: '251 113 133', accent2: '253 164 175', hex: '#fb7185' },
  day: { accent: '59 130 246', accent2: '96 165 250', hex: '#3b82f6' },
  dusk: { accent: '249 115 22', accent2: '251 146 60', hex: '#f97316' },
  night: { accent: '139 92 246', accent2: '167 139 250', hex: '#8b5cf6' },
}

/**
 * Drives chrono-adaptive aesthetics:
 *  1. Writes `data-chrono` on <html> so CSS can deepen/lift surfaces and dim the
 *     aurora by time of day.
 *  2. Rotates the global accent color through the day (dawn→rose, day→blue,
 *     dusk→orange, night→violet) in both themes — the single owner of the
 *     `--accent*` CSS variables.
 *  3. When the user's theme preference is "auto", flips light/dark by band.
 *
 * Re-evaluates every minute — cheap, no rAF, no listeners. Mounted once in the
 * Dashboard.
 */
export function useChronoTheme() {
  const setChronoBand = useStore((s) => s.setChronoBand)

  useEffect(() => {
    const apply = () => {
      const band = bandForHour(new Date().getHours())
      const root = document.documentElement

      if (root.dataset.chrono !== band) {
        root.dataset.chrono = band
      }

      // Rotate the global accent by time of day (overrides mode color).
      const ac = CHRONO_ACCENT[band]
      if (ac) {
        root.style.setProperty('--accent', ac.accent)
        root.style.setProperty('--accent-2', ac.accent2)
        root.style.setProperty('--accent-hex', ac.hex)
      }

      // Enforce auto theme based on time of day.
      const savedTheme = localStorage.getItem('protrack:theme')
      if (savedTheme === 'auto') {
        const isDay = band === 'dawn' || band === 'day'
        root.classList.toggle('dark', !isDay)
      }

      setChronoBand(band)
    }
    apply()
    const id = setInterval(apply, 60 * 1000)
    return () => clearInterval(id)
  }, [setChronoBand])
}
