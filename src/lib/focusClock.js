/**
 * Deep Focus timer formatting.
 *
 * Historically the timer only ever showed MM:SS, so a 90-minute session read
 * "90:00" — unclear whether that was 90 minutes or 90 seconds. The focus timer
 * now surfaces the hour once a session crosses the 60-minute mark:
 *
 *   45 min  →  45:00        (under an hour: unchanged MM:SS)
 *   90 min  →  1:30:00      (an hour or more: H:MM:SS, second-precision kept)
 *
 * Pure — no imports, safe to unit test and share across every focus surface
 * (lock screen, mini overlay, PiP windows, widget).
 *
 * @param {number} sec seconds remaining (negative values clamp to 0)
 * @returns {string}
 */
export function formatFocusClock(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
