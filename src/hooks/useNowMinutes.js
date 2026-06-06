import { useEffect, useState } from 'react'

function currentMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

/**
 * Live minutes-from-midnight, advancing on an interval — drives the calendar's
 * current-time flag. Local-only (zero Firestore cost). Default 20s cadence keeps
 * the flag visibly moving without churning renders.
 */
export function useNowMinutes(intervalMs = 20000) {
  const [minutes, setMinutes] = useState(currentMinutes)

  useEffect(() => {
    const id = setInterval(() => setMinutes(currentMinutes()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return minutes
}
