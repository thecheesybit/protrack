import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

/**
 * Reflects the user's typography preference to the DOM: writes
 * `data-font-scale` on <html> so the CSS variable cascade in `index.css`
 * picks up the new --root-font-size, which every `rem` in the app scales
 * against. Mounted once in App.jsx; cheap (no listeners, no rAF).
 */
const FONT_MAP = {
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
    const val = FONT_MAP[fontFamily] || FONT_MAP.inter
    el.style.setProperty('--font-sans', val)
  }, [fontFamily])
}
