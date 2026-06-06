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
 * Drives chrono-adaptive aesthetics: writes `data-chrono` on <html> so CSS can
 * deepen/lift surfaces and dim the aurora by time of day, and mirrors the band
 * into the store. Re-evaluates every minute — cheap, no rAF, no listeners.
 * Mounted once in the Dashboard.
 */
export function useChronoTheme() {
  const setChronoBand = useStore((s) => s.setChronoBand)

  useEffect(() => {
    const apply = () => {
      const band = bandForHour(new Date().getHours())
      if (document.documentElement.dataset.chrono !== band) {
        document.documentElement.dataset.chrono = band
      }
      setChronoBand(band)
    }
    apply()
    const id = setInterval(apply, 60 * 1000)
    return () => clearInterval(id)
  }, [setChronoBand])
}
