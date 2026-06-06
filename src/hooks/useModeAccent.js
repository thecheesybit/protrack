import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { rgbTriplet, lighten } from '@/lib/color'

/**
 * Drives the app-wide accent from the ACTIVE mode's color, so every glow,
 * ring, gradient, and aurora blob re-tints when you switch workspaces.
 * Falls back to the stylesheet default (indigo) when no mode is active.
 * One tiny effect, no re-renders — just CSS variables on <html>.
 */
export function useModeAccent() {
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const color = modes.find((m) => m.id === activeModeId)?.accentColor

  useEffect(() => {
    const root = document.documentElement
    if (color) {
      root.style.setProperty('--accent', rgbTriplet(color))
      root.style.setProperty('--accent-2', lighten(color, 0.2))
      root.style.setProperty('--accent-hex', color)
    } else {
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-2')
      root.style.removeProperty('--accent-hex')
    }
  }, [color])
}
