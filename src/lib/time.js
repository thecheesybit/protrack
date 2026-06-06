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

/**
 * Check if a slot is active on a given day index (0 = Monday, 6 = Sunday).
 */
export function isSlotOnDay(slot, day) {
  if (!slot) return false
  if (!slot.recurrenceType || slot.recurrenceType === 'weekly') {
    return slot.dayOfWeek === day
  }
  if (slot.recurrenceType === 'daily') {
    return true
  }
  if (slot.recurrenceType === 'custom_days') {
    return Array.isArray(slot.recurrenceDays) && slot.recurrenceDays.includes(day)
  }
  if (slot.recurrenceType === 'interval') {
    if (!slot.recurrenceStartDate || !slot.recurrenceInterval) return false
    
    // Get the Date object for the column 'day' of the current week.
    const now = new Date()
    const currentDayJs = now.getDay() // 0 = Sun, 1 = Mon ...
    const currentDayMonIndex = currentDayJs === 0 ? 6 : currentDayJs - 1
    
    const targetDate = new Date(now)
    targetDate.setDate(now.getDate() + (day - currentDayMonIndex))
    targetDate.setHours(0, 0, 0, 0)
    
    const startDate = new Date(slot.recurrenceStartDate)
    startDate.setHours(0, 0, 0, 0)
    
    const diffTime = targetDate.getTime() - startDate.getTime()
    if (diffTime < 0) return false // Before start date
    
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
    return diffDays % slot.recurrenceInterval === 0
  }
  return false
}
