/** Local YYYY-MM-DD for a date (default: now). */
export function ymd(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Consecutive-day streak ending today (or yesterday if today is empty). */
export function computeStreak(days) {
  if (!days?.length) return 0
  const set = new Set(days)
  const cur = new Date()
  if (!set.has(ymd(cur))) {
    cur.setDate(cur.getDate() - 1)
    if (!set.has(ymd(cur))) return 0
  }
  let streak = 0
  while (set.has(ymd(cur))) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

/** Array of the last n local dates (oldest → newest) as {key, label}. */
export function lastNDays(n) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push({
      key: ymd(d),
      label: d.toLocaleDateString([], { weekday: 'short' }),
      short: d.toLocaleDateString([], { day: 'numeric', month: 'short' }),
    })
  }
  return out
}

/**
 * Return the local Date for dayIndex (0=Mon … 6=Sun) of the week containing refDate.
 * Resets time to midnight (00:00:00.000) in local timezone.
 */
export function getWeekDate(dayIndex, refDate = new Date()) {
  const d = new Date(refDate)
  const nowDow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() + (dayIndex - nowDow))
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Return a local Date set to dayIndex at the given minute-from-midnight of the week containing refDate.
 */
export function dayMinToDate(dayIndex, min, refDate = new Date()) {
  const d = getWeekDate(dayIndex, refDate)
  d.setHours(Math.floor(min / 60), min % 60, 0, 0)
  return d
}
