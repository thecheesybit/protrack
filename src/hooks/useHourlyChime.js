import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { playTempleBell } from '@/lib/sound'

/**
 * Hourly Chime Hook — rings a deep bronze temple bell every hour on the hour (:00).
 *
 * Runs continuously in the background. When the clock turns to XX:00:
 *  1. Rings `playTempleBell()` (resonant Tibetan singing bowl / bronze gong).
 *  2. Dispatches a peaceful dynamic island reminder: "XX:00 · A new hour begins".
 *  3. Guards against duplicate rings within the same hour window.
 */
export function useHourlyChime() {
  const pushIsland = useStore((s) => s.pushIsland)
  const lastChimedHourRef = useRef(null)

  useEffect(() => {
    const checkHourlyChime = () => {
      const now = new Date()
      const minute = now.getMinutes()
      const second = now.getSeconds()
      const currentHour = now.getHours()

      // Trigger within the first 6 seconds of :00
      if (minute === 0 && second <= 6) {
        if (lastChimedHourRef.current !== currentHour) {
          lastChimedHourRef.current = currentHour

          // Ring the resonant temple bell
          playTempleBell()

          // Format 12h display
          let h12 = currentHour % 12
          if (h12 === 0) h12 = 12
          const period = currentHour >= 12 ? 'PM' : 'AM'
          const timeLabel = `${String(h12).padStart(2, '0')}:00 ${period}`

          pushIsland?.({
            kind: 'temple',
            title: timeLabel,
            detail: 'A new hour begins · Stay mindful & present',
            duration: 4500,
          })
        }
      } else if (minute !== 0) {
        // Reset guard as soon as we leave minute 0
        lastChimedHourRef.current = null
      }
    }

    // Check every second
    const interval = setInterval(checkHourlyChime, 1000)
    return () => clearInterval(interval)
  }, [pushIsland])
}
