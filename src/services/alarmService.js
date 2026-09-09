/**
 * alarmService.js — Alarm and reminder scheduling service.
 *
 * Persists alarms to localStorage under `protrack:alarms`.
 * Supports:
 *  - Quick offset & custom time scheduling (12h/24h)
 *  - Recurrence: 'once' | 'daily' | 'weekdays'
 *  - Sound profiles: 'alarm' | 'temple' | 'todo' | 'focus' | 'notification'
 *  - Snoozing (+5m / custom)
 *  - Calendar visibility flag (`visibleOnCalendar`)
 *  - Multi-window / tab sync via storage events
 */

export const ALARMS_STORAGE_KEY = 'protrack:alarms'
export const ALARMS_CHANGED_EVENT = 'protrack:alarms_changed'

export const ALARM_SOUND_OPTIONS = [
  { id: 'alarm', label: 'Vibrant Alarm', icon: 'BellRing' },
  { id: 'temple', label: 'Temple Bell', icon: 'Bell' },
  { id: 'todo', label: 'Crystal Chime', icon: 'Sparkles' },
  { id: 'focus', label: 'Singing Bowl', icon: 'Activity' },
  { id: 'notification', label: 'Marimba Alert', icon: 'Volume2' },
]

export const PRESET_LABELS = [
  'Deep Focus',
  'Take a Break',
  'Drink Water',
  'Stretch & Walk',
  'Review Notes',
  'Submit Assignment',
  'Lecture / Class',
]

/** Read all alarms from localStorage. */
export function getAlarms() {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(ALARMS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn('[alarmService] Failed to read alarms:', err)
    return []
  }
}

/** Save alarms to localStorage and emit change event. */
export function saveAlarms(alarms) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ALARMS_STORAGE_KEY, JSON.stringify(alarms))
      window.dispatchEvent(new CustomEvent(ALARMS_CHANGED_EVENT, { detail: alarms }))
    }
  } catch (err) {
    console.warn('[alarmService] Failed to save alarms:', err)
  }
  return alarms
}

/** Create and persist a new alarm. */
export function createAlarm({
  time = '09:00',
  label = '',
  enabled = true,
  repeat = 'once',
  sound = 'alarm',
  visibleOnCalendar = true,
} = {}) {
  const alarms = getAlarms()
  const newAlarm = {
    id: `alarm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    time: normalizeTime(time),
    label: label.trim(),
    enabled: Boolean(enabled),
    repeat: ['once', 'daily', 'weekdays'].includes(repeat) ? repeat : 'once',
    sound: sound || 'alarm',
    visibleOnCalendar: Boolean(visibleOnCalendar),
    createdAt: Date.now(),
    snoozedUntil: null,
    lastTriggeredDate: null,
    lastTriggeredTime: null,
  }

  alarms.push(newAlarm)
  alarms.sort((a, b) => a.time.localeCompare(b.time))
  saveAlarms(alarms)
  return newAlarm
}

/** Update an existing alarm by id. */
export function updateAlarm(id, updates = {}) {
  const alarms = getAlarms()
  const index = alarms.findIndex((a) => a.id === id)
  if (index === -1) return alarms

  const current = alarms[index]
  alarms[index] = {
    ...current,
    ...updates,
    time: updates.time ? normalizeTime(updates.time) : current.time,
  }
  alarms.sort((a, b) => a.time.localeCompare(b.time))
  return saveAlarms(alarms)
}

/** Toggle enabled state of an alarm. */
export function toggleAlarm(id) {
  const alarms = getAlarms()
  const alarm = alarms.find((a) => a.id === id)
  if (!alarm) return alarms
  return updateAlarm(id, { enabled: !alarm.enabled, snoozedUntil: null })
}

/** Delete an alarm by id. */
export function deleteAlarm(id) {
  const alarms = getAlarms()
  const filtered = alarms.filter((a) => a.id !== id)
  return saveAlarms(filtered)
}

/** Snooze an alarm for N minutes. */
export function snoozeAlarm(id, minutes = 5) {
  const snoozedUntil = Date.now() + minutes * 60 * 1000
  return updateAlarm(id, { snoozedUntil })
}

/** Dismiss an alarm that is ringing. */
export function dismissAlarm(id) {
  const alarms = getAlarms()
  const alarm = alarms.find((a) => a.id === id)
  if (!alarm) return alarms

  const todayStr = getTodayYMD()
  const nowTime = getNowHHMM()

  const updates = {
    snoozedUntil: null,
    lastTriggeredDate: todayStr,
    lastTriggeredTime: nowTime,
  }

  if (alarm.repeat === 'once') {
    updates.enabled = false
  }

  return updateAlarm(id, updates)
}

/** Check if an alarm is due to ring right now. */
export function isAlarmDue(alarm, now = new Date()) {
  if (!alarm || !alarm.enabled) return false

  // Snooze check: has absolute precedence
  if (alarm.snoozedUntil) {
    return Date.now() >= alarm.snoozedUntil
  }

  const nowTime = getNowHHMM(now)
  if (alarm.time !== nowTime) return false

  const todayStr = getTodayYMD(now)

  // Already fired during this exact minute today
  if (alarm.lastTriggeredDate === todayStr && alarm.lastTriggeredTime === nowTime) {
    return false
  }

  // Recurrence check
  const day = now.getDay() // 0 = Sun, 1 = Mon ... 6 = Sat
  if (alarm.repeat === 'weekdays') {
    if (day === 0 || day === 6) return false
  }

  return true
}

/* ── Time & formatting helpers ────────────────────────────────────────────── */

export function normalizeTime(t) {
  if (!t || typeof t !== 'string') return '09:00'
  const parts = t.split(':')
  const h = String(parseInt(parts[0], 10) || 0).padStart(2, '0')
  const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0')
  return `${h}:${m}`
}

export function getNowHHMM(d = new Date()) {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function getTodayYMD(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatTime12h(time24) {
  const [hStr, mStr] = (time24 || '00:00').split(':')
  let h = parseInt(hStr, 10) || 0
  const m = parseInt(mStr, 10) || 0
  const period = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
  return { hour: h, minute: m, period, formatted }
}

export function to24hTime(hour12, minute, period) {
  let h = parseInt(hour12, 10) || 12
  const m = String(parseInt(minute, 10) || 0).padStart(2, '0')
  if (period === 'AM') {
    if (h === 12) h = 0
  } else if (period === 'PM') {
    if (h < 12) h += 12
  }
  return `${String(h).padStart(2, '0')}:${m}`
}

/** Human readable countdown from now to time24. */
export function timeRemainingLabel(time24) {
  const now = new Date()
  const [hStr, mStr] = (time24 || '00:00').split(':')
  const target = new Date(now)
  target.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0)

  if (target <= now) {
    target.setDate(target.getDate() + 1)
  }

  const diffMs = target - now
  const diffMins = Math.round(diffMs / (60 * 1000))
  const hrs = Math.floor(diffMins / 60)
  const mins = diffMins % 60

  if (hrs === 0) {
    return `in ${mins}m`
  }
  if (mins === 0) {
    return `in ${hrs}h`
  }
  return `in ${hrs}h ${mins}m`
}
