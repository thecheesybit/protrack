// Timetable uses dayOfWeek 0=Mon … 6=Sun and minutes-from-midnight.
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const DAY_FULL = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export const DAY_START_MIN = 6 * 60 // 06:00
export const DAY_END_MIN = 24 * 60 // 24:00
export const PX_PER_MIN = 0.8
export const MIN_SLOT = 20

/** 0=Mon … 6=Sun for "today". */
export function todayDow() {
  return (new Date().getDay() + 6) % 7
}

export function minutesToLabel(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  const ampm = h >= 12 && h < 24 ? 'PM' : 'AM'
  const hh = ((h + 11) % 12) + 1
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Compact axis label, e.g. "6a", "12p", "9p". */
export function minutesToAxis(min) {
  const h = Math.floor(min / 60) % 24
  const ampm = h >= 12 ? 'p' : 'a'
  const hh = ((h + 11) % 12) + 1
  return `${hh}${ampm}`
}

export function snap(min, step = 5) {
  return Math.round(min / step) * step
}

export function clampMin(min) {
  return Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, min))
}

export function durationLabel(startMin, endMin) {
  const mins = endMin - startMin
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

/**
 * Next calendar occurrence of a weekly slot, as ISO strings — used to push a
 * recurring weekly event to Google Calendar.
 */
export function nextOccurrence(dayOfWeek, startMin, endMin) {
  const now = new Date()
  const todayJs = now.getDay() // 0=Sun
  const targetJs = (dayOfWeek + 1) % 7 // convert Mon=0 → Sun=0 indexing
  let delta = (targetJs - todayJs + 7) % 7
  const start = new Date(now)
  start.setDate(now.getDate() + delta)
  start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)
  if (delta === 0 && start < now) start.setDate(start.getDate() + 7)
  const end = new Date(start)
  end.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0)
  return { startISO: start.toISOString(), endISO: end.toISOString() }
}
