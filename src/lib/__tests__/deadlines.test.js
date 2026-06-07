import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { classifyDeadline, isDueToday, dueAtToMinutes, getUpcomingItems } from '../deadlines.js'

// Use a local-time constructor so tests behave consistently across time zones.
// "Pin" to June 15 2024 at noon.
const Y = 2024
const M = 5 // June (0-indexed)
const D = 15

const noon = () => new Date(Y, M, D, 12, 0, 0, 0)
const todayAt = (h, m = 0) => new Date(Y, M, D, h, m, 0, 0)
const tomorrowAt = (h, m = 0) => new Date(Y, M, D + 1, h, m, 0, 0)
const daysLater = (n) => new Date(Y, M, D + n, 12, 0, 0, 0)

// ---------------------------------------------------------------------------
// classifyDeadline
// ---------------------------------------------------------------------------
describe('classifyDeadline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(noon())
  })
  afterEach(() => vi.useRealTimers())

  it('returns null for missing / falsy dueAt', () => {
    expect(classifyDeadline(null)).toBeNull()
    expect(classifyDeadline(undefined)).toBeNull()
  })

  it('returns overdue for a time earlier today', () => {
    expect(classifyDeadline(todayAt(9))).toBe('overdue')
  })

  it('returns overdue for yesterday', () => {
    expect(classifyDeadline(daysLater(-1))).toBe('overdue')
  })

  it('returns due_today for a time later today', () => {
    expect(classifyDeadline(todayAt(18))).toBe('due_today')
  })

  it('returns due_soon for tomorrow', () => {
    expect(classifyDeadline(tomorrowAt(10))).toBe('due_soon')
  })

  it('returns due_soon for 2 days out', () => {
    expect(classifyDeadline(daysLater(2))).toBe('due_soon')
  })

  it('returns upcoming for 7 days out', () => {
    expect(classifyDeadline(daysLater(7))).toBe('upcoming')
  })

  it('works with a Firestore-like Timestamp (toDate method)', () => {
    const firestoreTs = { toDate: () => todayAt(9) }
    expect(classifyDeadline(firestoreTs)).toBe('overdue')
  })

  it('works with an ISO string', () => {
    // Use epoch ms number to stay timezone-safe
    expect(classifyDeadline(todayAt(9).getTime())).toBe('overdue')
  })
})

// ---------------------------------------------------------------------------
// isDueToday
// ---------------------------------------------------------------------------
describe('isDueToday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(noon())
  })
  afterEach(() => vi.useRealTimers())

  it('returns false for null', () => expect(isDueToday(null)).toBe(false))

  it('returns true for a time earlier today', () => {
    expect(isDueToday(todayAt(8))).toBe(true)
  })

  it('returns true for a time later today', () => {
    expect(isDueToday(todayAt(22))).toBe(true)
  })

  it('returns false for yesterday', () => {
    expect(isDueToday(daysLater(-1))).toBe(false)
  })

  it('returns false for tomorrow', () => {
    expect(isDueToday(tomorrowAt(9))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// dueAtToMinutes
// ---------------------------------------------------------------------------
describe('dueAtToMinutes', () => {
  it('returns null for null input', () => expect(dueAtToMinutes(null)).toBeNull())

  it('converts 9:30 to 570', () => {
    expect(dueAtToMinutes(new Date(Y, M, D, 9, 30))).toBe(570)
  })

  it('converts midnight to 0', () => {
    expect(dueAtToMinutes(new Date(Y, M, D, 0, 0))).toBe(0)
  })

  it('converts 23:59 to 1439', () => {
    expect(dueAtToMinutes(new Date(Y, M, D, 23, 59))).toBe(1439)
  })

  it('works with a Firestore Timestamp-like object', () => {
    const ts = { toDate: () => new Date(Y, M, D, 9, 30) }
    expect(dueAtToMinutes(ts)).toBe(570)
  })
})

// ---------------------------------------------------------------------------
// getUpcomingItems
// ---------------------------------------------------------------------------
describe('getUpcomingItems', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(noon())
  })
  afterEach(() => vi.useRealTimers())

  const makeTodo = (overrides) => ({ id: '1', done: false, text: 'Test', dueAt: null, ...overrides })
  const makeTask = (overrides) => ({ id: '2', column: 'todo', title: 'Task', dueAt: null, ...overrides })

  it('returns empty array when no items provided', () => {
    expect(getUpcomingItems([], [], 48)).toEqual([])
  })

  it('excludes done todos', () => {
    const todo = makeTodo({ done: true, dueAt: todayAt(14) })
    expect(getUpcomingItems([todo], [], 48)).toHaveLength(0)
  })

  it('excludes tasks in the done column', () => {
    const task = makeTask({ column: 'done', dueAt: todayAt(14) })
    expect(getUpcomingItems([], [task], 48)).toHaveLength(0)
  })

  it('includes open todos due within the window', () => {
    const todo = makeTodo({ dueAt: todayAt(15) })
    const result = getUpcomingItems([todo], [], 48)
    expect(result).toHaveLength(1)
    expect(result[0]._kind).toBe('todo')
  })

  it('includes open tasks due within the window', () => {
    const task = makeTask({ dueAt: todayAt(15) })
    const result = getUpcomingItems([], [task], 48)
    expect(result).toHaveLength(1)
    expect(result[0]._kind).toBe('task')
  })

  it('excludes items beyond the window', () => {
    const todo = makeTodo({ dueAt: daysLater(5) })
    expect(getUpcomingItems([todo], [], 48)).toHaveLength(0)
  })

  it('sorts items by due date ascending', () => {
    const t1 = makeTodo({ id: 'a', dueAt: todayAt(16) })
    const t2 = makeTodo({ id: 'b', dueAt: todayAt(13) })
    const result = getUpcomingItems([t1, t2], [], 48)
    expect(result[0].id).toBe('b')
    expect(result[1].id).toBe('a')
  })

  it('mixes todos and tasks together sorted', () => {
    const todo = makeTodo({ id: 'todo', dueAt: todayAt(17) })
    const task = makeTask({ id: 'task', dueAt: todayAt(14) })
    const result = getUpcomingItems([todo], [task], 48)
    expect(result[0].id).toBe('task')
    expect(result[1].id).toBe('todo')
  })

  it('attaches _urgency to each returned item', () => {
    const todo = makeTodo({ dueAt: todayAt(15) })
    const [item] = getUpcomingItems([todo], [], 48)
    expect(['overdue', 'due_today', 'due_soon', 'upcoming']).toContain(item._urgency)
  })
})
