import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

/**
 * The 7-slot time-of-day theme (docs/DESIGN_SYSTEM.md §6). Slot boundaries:
 * deep_night 0–4 · dawn 5–6 · morning 7–10 · midday 11–14 · afternoon 15–17 ·
 * dusk 18–20 · evening 21–23.
 *
 * @typedef {'deep_night'|'dawn'|'morning'|'midday'|'afternoon'|'dusk'|'evening'} ChronoSlot
 */

export const CHRONO_SLOTS = [
  'deep_night',
  'dawn',
  'morning',
  'midday',
  'afternoon',
  'dusk',
  'evening',
]

/** DEV-only preview override (Settings → Appearance). Empty = live clock. */
export const CHRONO_OVERRIDE_KEY = 'protrack:chrono:override'
export const CHRONO_OVERRIDE_EVENT = 'protrack:chrono-override'

/**
 * Maps a local hour (0-23) to a chrono slot.
 * @param {number} hour
 * @returns {ChronoSlot}
 */
export function slotForHour(hour) {
  if (hour < 5) return 'deep_night'
  if (hour < 7) return 'dawn'
  if (hour < 11) return 'morning'
  if (hour < 15) return 'midday'
  if (hour < 18) return 'afternoon'
  if (hour < 21) return 'dusk'
  return 'evening'
}

/**
 * Per-slot accent palette. The global `--accent` (every glow, ring, gradient,
 * button, and aurora blob) rotates through the day in BOTH themes. RGB channel
 * triplets for Tailwind's `<alpha-value>`, plus a hex for raw consumers.
 *
 *  deep_night → violet   dawn → amber/rose   morning → sky
 *  midday → sky/sage     afternoon → amber   dusk → rose/amber
 *  evening → violet
 */
export const CHRONO_ACCENT = {
  deep_night: { accent: '139 92 246', accent2: '167 139 250', hex: '#8b5cf6' },
  dawn: { accent: '245 158 11', accent2: '251 113 133', hex: '#f59e0b' },
  morning: { accent: '14 165 233', accent2: '56 189 248', hex: '#0ea5e9' },
  midday: { accent: '14 165 233', accent2: '74 222 128', hex: '#0ea5e9' },
  afternoon: { accent: '245 158 11', accent2: '251 191 36', hex: '#f59e0b' },
  dusk: { accent: '244 63 94', accent2: '251 146 60', hex: '#f43f5e' },
  evening: { accent: '124 58 237', accent2: '167 139 250', hex: '#7c3aed' },
}

/** Slots whose canvas turns dark in BOTH themes (drives auto theme + stars). */
export const DARK_SLOTS = new Set(['deep_night', 'dawn', 'dusk', 'evening'])

export function readChronoOverride() {
  try {
    const v = localStorage.getItem(CHRONO_OVERRIDE_KEY)
    return CHRONO_SLOTS.includes(v) ? v : null
  } catch {
    return null
  }
}

/**
 * Drives the chrono-adaptive aesthetics:
 *  1. Writes `data-chrono` on <html> — index.css turns the canvas, surfaces,
 *     island tint, aurora and starfield per slot.
 *  2. Rotates the global accent (the single owner of `--accent*`).
 *  3. When the user's theme preference is "auto", follows the slot (light
 *     during morning/midday/afternoon, dark otherwise).
 *
 * Re-evaluates every minute — cheap, no rAF. DEV builds can pin a slot via
 * the localStorage override (Settings → Appearance) to preview all seven.
 * Mounted once in the Dashboard.
 */
export function useChronoTheme() {
  const setChronoSlot = useStore((s) => s.setChronoSlot)

  useEffect(() => {
    const apply = () => {
      const override = import.meta.env.DEV ? readChronoOverride() : null
      const slot = override || slotForHour(new Date().getHours())
      const root = document.documentElement

      if (root.dataset.chrono !== slot) {
        root.dataset.chrono = slot
      }

      const ac = CHRONO_ACCENT[slot]
      if (ac) {
        root.style.setProperty('--accent', ac.accent)
        root.style.setProperty('--accent-2', ac.accent2)
        root.style.setProperty('--accent-hex', ac.hex)
      }

      // Auto theme follows the sky.
      const savedTheme = localStorage.getItem('protrack:theme')
      if (savedTheme === 'auto') {
        root.classList.toggle('dark', DARK_SLOTS.has(slot))
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
