/**
 * Pure Chrono constants, palette definitions, and slot calculation helpers.
 * Kept separate from React hooks to prevent circular dependencies in Zustand slices.
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
 * @returns {import('@/store/slices/chronoSlice').ChronoSlot}
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

export const TIMED_THEMES = [
  { id: 'auto', label: 'Auto (Clock)', icon: 'Clock', desc: 'Syncs with your local time of day' },
  { id: 'morning', label: 'Morning', icon: 'Sunrise', desc: 'Rising sun & morning mist', slot: 'dawn' },
  { id: 'day', label: 'Day', icon: 'Sun', desc: 'Radiant sun, drifting clouds & rain', slot: 'midday' },
  { id: 'sunset', label: 'Sunset', icon: 'Sunset', desc: 'Coral golden hour & soaring birds', slot: 'dusk' },
  { id: 'night', label: 'Night', icon: 'Moon', desc: 'Moon, stars, asteroids & satellites', slot: 'deep_night' },
]

/**
 * Maps a chrono slot to one of the 4 primary celestial theme categories.
 * @param {string} slot
 * @returns {'morning'|'day'|'sunset'|'night'}
 */
export function getThemeCategory(slot) {
  if (slot === 'deep_night' || slot === 'evening') return 'night'
  if (slot === 'dawn' || slot === 'morning') return 'morning'
  if (slot === 'midday' || slot === 'afternoon') return 'day'
  if (slot === 'dusk') return 'sunset'
  return 'night'
}

export function readChronoOverride() {
  try {
    if (typeof localStorage === 'undefined') return null
    const v = localStorage.getItem(CHRONO_OVERRIDE_KEY)
    if (!v) return null
    if (CHRONO_SLOTS.includes(v)) return v
    // Support category IDs
    if (v === 'morning') return 'dawn'
    if (v === 'day') return 'midday'
    if (v === 'sunset') return 'dusk'
    if (v === 'night') return 'deep_night'
    return null
  } catch {
    return null
  }
}

export function setChronoOverride(val) {
  try {
    if (typeof localStorage === 'undefined') return
    if (!val || val === 'auto') {
      localStorage.removeItem(CHRONO_OVERRIDE_KEY)
    } else if (val === 'morning') {
      localStorage.setItem(CHRONO_OVERRIDE_KEY, 'dawn')
    } else if (val === 'day') {
      localStorage.setItem(CHRONO_OVERRIDE_KEY, 'midday')
    } else if (val === 'sunset') {
      localStorage.setItem(CHRONO_OVERRIDE_KEY, 'dusk')
    } else if (val === 'night') {
      localStorage.setItem(CHRONO_OVERRIDE_KEY, 'deep_night')
    } else {
      localStorage.setItem(CHRONO_OVERRIDE_KEY, val)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CHRONO_OVERRIDE_EVENT))
    }
  } catch {}
}

/**
 * Computes the initial chrono slot synchronously on application bootstrap.
 * @returns {string}
 */
export function getInitialChronoSlot() {
  const override = readChronoOverride()
  if (override) return override
  return slotForHour(new Date().getHours())
}
