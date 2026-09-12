import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

/**
 * Reflects the user's typography preference to the DOM: writes
 * `data-font-scale` on <html> so index.css sets --text-scale, a multiplier
 * applied only inside Tailwind's fontSize scale (tailwind.config.js) — text
 * grows/shrinks with this preference, but the document root's font-size
 * itself stays fixed at 16px so spacing/sizing/border-radius utilities never
 * pick up fractional pixel values. Mounted once in App.jsx; cheap (no
 * listeners, no rAF).
 */
const FONT_MAP = {
  dmsans: "'DM Sans', system-ui, -apple-system, sans-serif",
  inter: "'Inter', system-ui, -apple-system, sans-serif",
  outfit: "'Outfit', system-ui, -apple-system, sans-serif",
  lora: "'Lora', Georgia, serif",
  playfair: "'Playfair Display', serif",
  mono: "'JetBrains Mono', monospace",
}

export function useFontScale() {
  const fontScale = useStore((s) => s.fontScale)
  const fontFamily = useStore((s) => s.fontFamily)

  useEffect(() => {
    const el = document.documentElement
    if (el.dataset.fontScale !== fontScale) {
      el.dataset.fontScale = fontScale
    }
  }, [fontScale])

  useEffect(() => {
    const el = document.documentElement
    const val = FONT_MAP[fontFamily] || FONT_MAP.dmsans
    el.style.setProperty('--font-sans', val)
  }, [fontFamily])
}
