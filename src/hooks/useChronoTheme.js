import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

/**
 * The 7-slot time-of-day theme (docs/DESIGN_SYSTEM.md §6). Slot boundaries:
 * deep_night 0–4 · dawn 5–6 · morning 7–10 · midday 11–14 · afternoon 15–17 ·
 * dusk 18–20 · evening 21–23.
 *
 * @typedef {'deep_night'|'dawn'|'morning'|'midday'|'afternoon'|'dusk'|'evening'} ChronoSlot
 */

export {
  CHRONO_SLOTS,
  CHRONO_OVERRIDE_KEY,
  CHRONO_OVERRIDE_EVENT,
  CHRONO_ACCENT,
  CHRONO_ACCENT_LIGHT,
  DARK_SLOTS,
  TIMED_THEMES,
  slotForHour,
  getThemeCategory,
  readChronoOverride,
  setChronoOverride,
  getInitialChronoSlot,
} from '@/lib/chrono'

import {
  CHRONO_ACCENT,
  CHRONO_ACCENT_LIGHT,
  DARK_SLOTS,
  CHRONO_OVERRIDE_EVENT,
  slotForHour,
  readChronoOverride,
} from '@/lib/chrono'

/**
 * Drives the chrono-adaptive aesthetics:
 *  1. Writes `data-chrono` on <html> — index.css turns the canvas, surfaces,
 *     island tint, aurora and starfield per slot.
 *  2. Rotates the global accent (the single owner of `--accent*`).
 *  3. When the user's theme preference is "auto", follows the slot (light
 *     during morning/midday/afternoon, dark otherwise).
 *
 * Re-evaluates every minute — cheap, no rAF.
 * Mounted once in the Dashboard.
 */
export function useChronoTheme() {
  const setChronoSlot = useStore((s) => s.setChronoSlot)

  useEffect(() => {
    const apply = () => {
      const override = readChronoOverride()
      const slot = override || slotForHour(new Date().getHours())
      const root = document.documentElement

      if (root.dataset.chrono !== slot) {
        root.dataset.chrono = slot
      }

      // Auto theme follows the sky — toggle dark class BEFORE accent selection
      // so the palette picker reads the correct final light/dark state.
      const savedTheme = localStorage.getItem('protrack:theme')
      if (savedTheme === 'auto') {
        root.classList.toggle('dark', DARK_SLOTS.has(slot))
      }

      const ac = CHRONO_ACCENT[slot]
      // Use WCAG-safe darker shades in light mode so text-accent and
      // bg-accent buttons maintain ≥4.5:1 contrast on white/parchment.
      const isDark = root.classList.contains('dark')
      const palette = isDark ? ac : (CHRONO_ACCENT_LIGHT[slot] || ac)
      if (palette) {
        root.style.setProperty('--accent', palette.accent)
        root.style.setProperty('--accent-2', palette.accent2)
        root.style.setProperty('--accent-hex', palette.hex)
      }

      setChronoSlot(slot)
    }
    apply()
    const id = setInterval(apply, 60 * 1000)
    window.addEventListener(CHRONO_OVERRIDE_EVENT, apply)
    return () => {
      clearInterval(id)
      window.removeEventListener(CHRONO_OVERRIDE_EVENT, apply)
    }
  }, [setChronoSlot])
}
