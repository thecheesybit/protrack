import { describe, it, expect, beforeEach } from 'vitest'
import {
  getAlarms,
  saveAlarms,
  createAlarm,
  updateAlarm,
  deleteAlarm,
  toggleAlarm,
  snoozeAlarm,
  dismissAlarm,
  isAlarmDue,
  formatTime12h,
  to24hTime,
  timeRemainingLabel,
  ALARMS_STORAGE_KEY,
} from '../alarmService'
import { buildDayTimeline } from '@/lib/dayAgenda'

let store = {}

function setupStorageMock() {
  store = {}
  global.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} },
  }
  global.window = {
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

describe('alarmService CRUD & storage', () => {
  beforeEach(() => {
    setupStorageMock()
  })

  it('initializes with empty alarms when storage is empty', () => {
    expect(getAlarms()).toEqual([])
  })

  it('creates and persists a new alarm sorted by time', () => {
    const a1 = createAlarm({ time: '14:30', label: 'Study Session', repeat: 'daily' })
    const a2 = createAlarm({ time: '07:15', label: 'Morning Wakeup', repeat: 'weekdays' })

    const stored = getAlarms()
    expect(stored).toHaveLength(2)
    // 07:15 before 14:30
    expect(stored[0].time).toBe('07:15')
    expect(stored[0].label).toBe('Morning Wakeup')
    expect(stored[1].time).toBe('14:30')
    expect(stored[1].label).toBe('Study Session')
  })

  it('updates an existing alarm', () => {
    const a = createAlarm({ time: '10:00', label: 'Original' })
    updateAlarm(a.id, { label: 'Renamed', time: '11:00' })

    const stored = getAlarms()
    expect(stored[0].label).toBe('Renamed')
    expect(stored[0].time).toBe('11:00')
  })

  it('toggles an alarm on and off', () => {
    const a = createAlarm({ time: '12:00', enabled: true })
    toggleAlarm(a.id)
    expect(getAlarms()[0].enabled).toBe(false)
    toggleAlarm(a.id)
    expect(getAlarms()[0].enabled).toBe(true)
  })

  it('deletes an alarm', () => {
    const a = createAlarm({ time: '09:00' })
    expect(getAlarms()).toHaveLength(1)
    deleteAlarm(a.id)
    expect(getAlarms()).toHaveLength(0)
  })
})

describe('alarmService timing & due check', () => {
  beforeEach(() => {
    setupStorageMock()
  })

  it('correctly converts 12h to 24h and back', () => {
    expect(to24hTime(8, 30, 'AM')).toBe('08:30')
    expect(to24hTime(12, 0, 'PM')).toBe('12:00')
    expect(to24hTime(12, 15, 'AM')).toBe('00:15')
    expect(to24hTime(7, 5, 'PM')).toBe('19:05')

    expect(formatTime12h('08:30').formatted).toBe('08:30 AM')
    expect(formatTime12h('12:00').formatted).toBe('12:00 PM')
    expect(formatTime12h('00:15').formatted).toBe('12:15 AM')
    expect(formatTime12h('19:05').formatted).toBe('07:05 PM')
  })

  it('detects when an alarm is due', () => {
    const alarm = {
      id: 'test-1',
      time: '15:45',
      enabled: true,
      repeat: 'daily',
    }

    const matchingDate = new Date(2026, 8, 9, 15, 45, 10) // 15:45
    const differentMinute = new Date(2026, 8, 9, 15, 46, 0) // 15:46

    expect(isAlarmDue(alarm, matchingDate)).toBe(true)
    expect(isAlarmDue(alarm, differentMinute)).toBe(false)
  })

  it('respects weekdays repetition', () => {
    const alarm = {
      id: 'test-wd',
      time: '08:00',
      enabled: true,
      repeat: 'weekdays',
    }

    // Monday (day 1)
    const monday = new Date(2026, 8, 7, 8, 0, 0)
    expect(isAlarmDue(alarm, monday)).toBe(true)

    // Sunday (day 0)
    const sunday = new Date(2026, 8, 6, 8, 0, 0)
    expect(isAlarmDue(alarm, sunday)).toBe(false)
  })

  it('snoozes an alarm and marks due when snooze expires', () => {
    const a = createAlarm({ time: '08:00', enabled: true })
    snoozeAlarm(a.id, -1) // snoozed 1 minute ago

    const snoozed = getAlarms()[0]
    expect(isAlarmDue(snoozed, new Date())).toBe(true)
  })

  it('dismisses an alarm and disables one-time alarms', () => {
    const a = createAlarm({ time: '10:00', repeat: 'once', enabled: true })
    dismissAlarm(a.id)

    const updated = getAlarms()[0]
    expect(updated.enabled).toBe(false)
    expect(updated.snoozedUntil).toBeNull()
  })

  it('computes time remaining label', () => {
    const label = timeRemainingLabel('23:59')
    expect(label).toMatch(/in \d+[hm]/)
  })
})

describe('calendar visibility integration', () => {
  it('includes visibleOnCalendar alarms in day agenda timeline', () => {
    const alarm = {
      id: 'alarm_1',
      time: '10:15',
      label: 'Team Sync',
      visibleOnCalendar: true,
      enabled: true,
      repeat: 'daily',
    }

    const today = new Date()
    const timeline = buildDayTimeline({
      alarms: [alarm],
      date: today,
    })

    const alarmItem = timeline.find((i) => i.kind === 'alarm')
    expect(alarmItem).toBeDefined()
    expect(alarmItem.title).toBe('Alarm: Team Sync')
    expect(alarmItem.startMin).toBe(10 * 60 + 15)
    expect(alarmItem.color).toBe('#f43f5e')
  })

  it('omits alarms when visibleOnCalendar is false', () => {
    const alarm = {
      id: 'alarm_hidden',
      time: '10:15',
      label: 'Secret Reminder',
      visibleOnCalendar: false,
      enabled: true,
      repeat: 'daily',
    }

    const timeline = buildDayTimeline({
      alarms: [alarm],
      date: new Date(),
    })

    const alarmItem = timeline.find((i) => i.kind === 'alarm')
    expect(alarmItem).toBeUndefined()
  })
})
