import { useState, useEffect } from 'react'

// Timestamp of initial module load / app launch
export const APP_BOOT_TIME = typeof performance !== 'undefined' ? performance.now() : Date.now()

/**
 * Ensures the application holds the loader for at least `minTimeMs` (default 2500ms / 2.5s).
 * If network or data takes longer than `minTimeMs`, the loader continues naturally until ready.
 *
 * @param {number} [minTimeMs=2500] Minimum duration in milliseconds
 * @returns {boolean} True once the minimum duration has elapsed
 */
export function useMinLoadTime(minTimeMs = 2500) {
  const [ready, setReady] = useState(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    return now - APP_BOOT_TIME >= minTimeMs
  })

  useEffect(() => {
    if (ready) return undefined

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const elapsed = now - APP_BOOT_TIME
    const remaining = Math.max(0, minTimeMs - elapsed)

    if (remaining === 0) {
      setReady(true)
      return undefined
    }

    const timer = setTimeout(() => {
      setReady(true)
    }, remaining)

    return () => clearTimeout(timer)
  }, [minTimeMs, ready])

  return ready
}
