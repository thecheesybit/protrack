/**
 * Tests for the pure `missedToday` helper exported from useHabitReminders.
 *
 * useHabitReminders.js has side-effect imports (React hooks, Firebase, notify),
 * so we mock all of them to ensure the module loads cleanly in a Node environment.
 * vi.mock calls are hoisted by Vitest's transform, so they run before any import.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn(() => ({ user: null })) }))
vi.mock('@/hooks/useWellness', () => ({
  useHabits: vi.fn(() => []),
  useTodos: vi.fn(() => []),
}))
vi.mock('@/lib/notify', () => ({
  notify: vi.fn(),
  ensureNotificationPermission: vi.fn(() => Promise.resolve(false)),
}))
vi.mock('@/services/habitService', () => ({
  toggleHabitToday: vi.fn(() => Promise.resolve()),
}))

import { missedToday } from '../useHabitReminders.js'
import { ymd } from '../../lib/dates.js'

// ---------------------------------------------------------------------------
// Helpers — local-time constructor, June 15 2024
// ---------------------------------------------------------------------------
const june15 = (h, m = 0) => new Date(2024, 5, 15, h, m, 0, 0)

describe('missedToday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(june15(12)) // pin system clock to noon on June 15
  })
  afterEach(() => vi.useRealTimers())

  // -------------------------------------------------------------------------
  // Edge cases — no interval
  // -------------------------------------------------------------------------
  it('returns 0 when habit has no interval', () => {
    expect(missedToday({ interval: 'none', timesPerDay: 1, doneDates: [] })).toBe(0)
  })

  it('returns 0 when interval is null', () => {
    expect(missedToday({ interval: null })).toBe(0)
  })

  it('returns 0 for an undefined habit', () => {
    expect(missedToday(undefined)).toBe(0)
  })

  // -------------------------------------------------------------------------
  // Done today suppresses all missed counts
  // -------------------------------------------------------------------------
  it('returns 0 when the habit is already marked done today (timesPerDay:1)', () => {
    // completionsToday() returns 0 or 1 (not a full count). Suppression fires
    // only when done >= timesPerDay, so this must be 1 to trigger the early-exit.
    const todayStr = ymd() // '2024-06-15' — matches fake system time
    const habit = { interval: 'every-1h', timesPerDay: 1, doneDates: [todayStr] }
    expect(missedToday(habit, june15(12))).toBe(0)
  })

  // -------------------------------------------------------------------------
  // Interval-based habits (every-1h, every-2h …)
  // -------------------------------------------------------------------------
  it('returns 0 for every-1h before 9am start', () => {
    const habit = { interval: 'every-1h', timesPerDay: 5, doneDates: [] }
    expect(missedToday(habit, june15(8))).toBe(0)
  })

  it('returns 0 for every-1h exactly at 9am start', () => {
    const habit = { interval: 'every-1h', timesPerDay: 5, doneDates: [] }
    // elapsed = 0 min, floor(0/60)+1 = 1, but expected = min(5,1) = 1 — actually 1 missed
    // Wait: elapsed = 0, floor(0/60) = 0, expected = 0+1 = 1
    // Hmm, let me re-check the logic:
    // elapsedMin = (9am - 9am) / 60000 = 0
    // expected = min(5, floor(0/60) + 1) = min(5, 1) = 1
    // So at exactly 9am, 1 ping is expected and missed.
    expect(missedToday(habit, june15(9))).toBe(1)
  })

  it('returns 4 for every-1h at noon (3 hours past 9am)', () => {
    // elapsed = 180 min, floor(180/60)+1 = 4, min(10, 4) = 4
    const habit = { interval: 'every-1h', timesPerDay: 10, doneDates: [] }
    expect(missedToday(habit, june15(12))).toBe(4)
  })

  it('caps missed count at timesPerDay', () => {
    // At 6pm: elapsed = 9h = 540min, floor(540/60)+1 = 10, but timesPerDay = 3
    const habit = { interval: 'every-1h', timesPerDay: 3, doneDates: [] }
    expect(missedToday(habit, june15(18))).toBe(3)
  })

  it('returns 1 for every-2h at 11am (2h past 9am)', () => {
    // elapsed = 120 min, floor(120/120)+1 = 2 → but wait:
    // floor(120/120) = 1, +1 = 2, min(timesPerDay, 2)
    // With timesPerDay: 5 → expected = 2
    const habit = { interval: 'every-2h', timesPerDay: 5, doneDates: [] }
    expect(missedToday(habit, june15(11))).toBe(2)
  })

  // -------------------------------------------------------------------------
  // Fixed time-of-day habits (morning / afternoon / evening)
  // -------------------------------------------------------------------------
  it('returns 1 for a missed morning cue (noon > 9am)', () => {
    const habit = { interval: 'morning', timesPerDay: 1, doneDates: [] }
    expect(missedToday(habit, june15(12))).toBe(1)
  })

  it('returns 0 for morning cue before 9am', () => {
    const habit = { interval: 'morning', timesPerDay: 1, doneDates: [] }
    expect(missedToday(habit, june15(8))).toBe(0)
  })

  it('returns 0 for an afternoon cue before 2pm', () => {
    const habit = { interval: 'afternoon', timesPerDay: 1, doneDates: [] }
    expect(missedToday(habit, june15(12))).toBe(0)
  })

  it('returns 1 for a missed afternoon cue (after 2pm)', () => {
    const habit = { interval: 'afternoon', timesPerDay: 1, doneDates: [] }
    expect(missedToday(habit, june15(16))).toBe(1)
  })

  it('returns 0 for evening cue before 7pm', () => {
    const habit = { interval: 'evening', timesPerDay: 1, doneDates: [] }
    expect(missedToday(habit, june15(15))).toBe(0)
  })

  it('returns 1 for a missed evening cue (after 7pm)', () => {
    const habit = { interval: 'evening', timesPerDay: 1, doneDates: [] }
    expect(missedToday(habit, june15(20))).toBe(1)
  })

  // -------------------------------------------------------------------------
  // Multi-completion tracking with dayLogs
  // -------------------------------------------------------------------------
  it('deducts logged completions today from dayLogs count', () => {
    const todayStr = ymd()
    const habit = {
      interval: 'every-1h',
      timesPerDay: 8,
      doneDates: [todayStr],
      dayLogs: { [todayStr]: 3 },
    }
    // At noon (3 hours past 9am), 4 expected pings. 3 logged in dayLogs.
    expect(missedToday(habit, june15(12))).toBe(1)
  })

  it('returns 0 when dayLogs meets or exceeds timesPerDay target', () => {
    const todayStr = ymd()
    const habit = {
      interval: 'every-1h',
      timesPerDay: 4,
      doneDates: [todayStr],
      dayLogs: { [todayStr]: 4 },
    }
    expect(missedToday(habit, june15(16))).toBe(0)
  })

  it('supports customIntervalMin', () => {
    // customIntervalMin: 120 (same as every-2h). At 11am (2h past 9am), expected = 2
    const habit = {
      interval: 'custom',
      customIntervalMin: 120,
      timesPerDay: 6,
      doneDates: [],
    }
    expect(missedToday(habit, june15(11))).toBe(2)
  })
})

