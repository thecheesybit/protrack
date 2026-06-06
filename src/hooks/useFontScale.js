import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

/**
 * Reflects the user's typography preference to the DOM: writes
 * `data-font-scale` on <html> so the CSS variable cascade in `index.css`
 * picks up the new --root-font-size, which every `rem` in the app scales
 * against. Mounted once in App.jsx; cheap (no listeners, no rAF).
 */
export function useFontScale() {
  const fontScale = useStore((s) => s.fontScale)

  useEffect(() => {
    const el = document.documentElement
    if (el.dataset.fontScale !== fontScale) {
      el.dataset.fontScale = fontScale
    }
  }, [fontScale])
}
