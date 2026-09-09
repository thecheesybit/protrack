import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildDayTimeline, summarizeDay } from '../dayAgenda.js'

// Pin to Saturday, June 15 2024 (local time), matching the deadline/checkin tests.
// getDay() === 6 (Sat) → timetable dow index 5.
const Y = 2024
const M = 5 // June (0-indexed)
const D = 15
const DAY = new Date(Y, M, D, 10, 0, 0, 0)
const at = (h, m = 0) => new Date(Y, M, D, h, m, 0, 0)
const nextDayAt = (h, m = 0) => new Date(Y, M, D + 1, h, m, 0, 0)

const byId = (items, id) => items.find((i) => i.id === id)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(DAY)
})
afterEach(() => vi.useRealTimers())

// ---------------------------------------------------------------------------
// slot recurrence inclusion
// ---------------------------------------------------------------------------
describe('buildDayTimeline — slot recurrence', () => {
  it('includes a weekly slot whose dayOfWeek matches the day (Sat = 5)', () => {
    const slots = [{ id: 's1', dayOfWeek: 5, startMin: 540, endMin: 600, label: 'Maths', color: '#111' }]
    const out = buildDayTimeline({ slots, date: DAY })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'slot:s1', kind: 'slot', startMin: 540, endMin: 600, title: 'Maths' })
    expect(out[0].ref).toBe(slots[0])
  })

  it('excludes a weekly slot on a different day', () => {
    const slots = [{ id: 's2', dayOfWeek: 2, startMin: 540, endMin: 600 }]
    expect(buildDayTimeline({ slots, date: DAY })).toHaveLength(0)
  })

  it('includes a daily-recurrence slot on any day', () => {
    const slots = [{ id: 's3', recurrenceType: 'daily', startMin: 600, endMin: 660 }]
    expect(buildDayTimeline({ slots, date: DAY })).toHaveLength(1)
  })

  it('honours custom_days recurrence', () => {
    const hit = [{ id: 's4', recurrenceType: 'custom_days', recurrenceDays: [5], startMin: 600, endMin: 660 }]
    const miss = [{ id: 's5', recurrenceType: 'custom_days', recurrenceDays: [0, 1], startMin: 600, endMin: 660 }]
    expect(buildDayTimeline({ slots: hit, date: DAY })).toHaveLength(1)
    expect(buildDayTimeline({ slots: miss, date: DAY })).toHaveLength(0)
  })

  it('falls back to the mode accent colour and carries _mode* metadata (All Scopes)', () => {
    const slots = [
      { id: 's6', dayOfWeek: 5, startMin: 600, endMin: 660, _modeId: 'm1', _modeName: 'UPSC', _modeColor: '#abc123' },
    ]
    const [item] = buildDayTimeline({ slots, date: DAY })
    expect(item).toMatchObject({ modeId: 'm1', modeName: 'UPSC', modeColor: '#abc123', color: '#abc123' })
  })

  it('marks a slot done if completedDates contains the current date', () => {
    const slots = [
      { id: 's7', dayOfWeek: 5, startMin: 600, endMin: 660, label: 'Finance', completedDates: ['2024-06-15'] },
    ]
    const [item] = buildDayTimeline({ slots, date: DAY })
    expect(item).toMatchObject({ id: 'slot:s7', done: true })
  })

  it('marks a slot done if a matching completed focus session with slotId exists', () => {
    const slots = [
      { id: 's8', dayOfWeek: 5, startMin: 600, endMin: 660, label: 'Finance' },
    ]
    const sessions = [
      { id: 'sess1', slotId: 's8', targetDate: '2024-06-15', completed: true, durationMin: 60 },
    ]
    const [item] = buildDayTimeline({ slots, sessions, date: DAY })
    expect(item).toMatchObject({ id: 'slot:s8', done: true })
  })
})

// ---------------------------------------------------------------------------
// event-date match
// ---------------------------------------------------------------------------
describe('buildDayTimeline — one-time events', () => {
  it('includes an event whose eventDate is the day, using eventStartMin/eventEndMin', () => {
    const events = [{ id: 'e1', type: 'event', text: 'Mock test', eventDate: '2024-06-15', eventStartMin: 600, eventEndMin: 720 }]
    const [item] = buildDayTimeline({ events, date: DAY })
    expect(item).toMatchObject({ id: 'event:e1', kind: 'event', startMin: 600, endMin: 720, title: 'Mock test' })
  })

  it('excludes an event on a different eventDate', () => {
    const events = [{ id: 'e2', type: 'event', eventDate: '2024-06-16', eventStartMin: 600 }]
    expect(buildDayTimeline({ events, date: DAY })).toHaveLength(0)
  })

  it('falls back to dueAt when no eventDate is present', () => {
    const events = [{ id: 'e3', type: 'event', text: 'Call', dueAt: at(11, 0) }]
    const [item] = buildDayTimeline({ events, date: DAY })
    expect(item).toMatchObject({ id: 'event:e3', startMin: 660 })
  })
})

// ---------------------------------------------------------------------------
// due-today todo / task placement
// ---------------------------------------------------------------------------
describe('buildDayTimeline — due todos & tasks', () => {
  it('places a timed todo at its due minute', () => {
    const todos = [{ id: 't1', text: 'Revise polity', dueAt: at(15, 0) }]
    const [item] = buildDayTimeline({ todos, date: DAY })
    expect(item).toMatchObject({ id: 'todo:t1', kind: 'todo', startMin: 900, endMin: null, done: false })
  })

  it('excludes a todo due on another day', () => {
    const todos = [{ id: 't2', text: 'x', dueAt: nextDayAt(15) }]
    expect(buildDayTimeline({ todos, date: DAY })).toHaveLength(0)
  })

  it('ignores todos flagged type:event in the todos array (they arrive via events)', () => {
    const todos = [{ id: 't3', type: 'event', text: 'dup', dueAt: at(15, 0) }]
    expect(buildDayTimeline({ todos, date: DAY })).toHaveLength(0)
  })

  it('places a timed kanban task and marks a done-column task as done', () => {
    const tasks = [
      { id: 'k1', title: 'Draft essay', dueAt: at(9, 30) },
      { id: 'k2', title: 'Old card', dueAt: at(16, 0), column: 'done' },
    ]
    const out = buildDayTimeline({ tasks, date: DAY })
    expect(byId(out, 'task:k1')).toMatchObject({ kind: 'task', startMin: 570, done: false })
    expect(byId(out, 'task:k2')).toMatchObject({ done: true })
  })
})

// ---------------------------------------------------------------------------
// all-day / "anytime" bucketing
// ---------------------------------------------------------------------------
describe('buildDayTimeline — anytime bucket', () => {
  it('buckets an allDay todo (startMin null) and sorts it ahead of timed items', () => {
    const todos = [
      { id: 'a1', text: 'All-day review', allDay: true, dueAt: at(9, 0) },
      { id: 'a2', text: 'Timed', dueAt: at(9, 0) },
    ]
    const out = buildDayTimeline({ todos, date: DAY })
    expect(out[0]).toMatchObject({ id: 'todo:a1', startMin: null })
    expect(out[1]).toMatchObject({ id: 'todo:a2', startMin: 540 })
  })

  it('treats a midnight dueAt as untimed', () => {
    const todos = [{ id: 'a3', text: 'Midnight', dueAt: at(0, 0) }]
    expect(buildDayTimeline({ todos, date: DAY })[0].startMin).toBeNull()
  })

  it('treats a pre-06:00 dueAt as untimed (mirrors the grid convention)', () => {
    const todos = [{ id: 'a4', text: 'Early', dueAt: at(5, 0) }]
    expect(buildDayTimeline({ todos, date: DAY })[0].startMin).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// sessions as past blocks
// ---------------------------------------------------------------------------
describe('buildDayTimeline — focus sessions', () => {
  it('renders a completed session as a past block with a computed endMin', () => {
    const sessions = [{ id: 'f1', startedAt: at(8, 0), durationMin: 50 }]
    const [item] = buildDayTimeline({ sessions, date: DAY })
    expect(item).toMatchObject({ id: 'session:f1', kind: 'session', startMin: 480, endMin: 530, done: true })
  })

  it('excludes sessions explicitly marked completed:false', () => {
    const sessions = [{ id: 'f2', startedAt: at(8, 0), durationMin: 25, completed: false }]
    expect(buildDayTimeline({ sessions, date: DAY })).toHaveLength(0)
  })

  it('excludes sessions started on another day', () => {
    const sessions = [{ id: 'f3', startedAt: nextDayAt(8), durationMin: 25 }]
    expect(buildDayTimeline({ sessions, date: DAY })).toHaveLength(0)
  })

  it('does not render a duplicate session item if the session is linked to a slot (slotId)', () => {
    const slots = [{ id: 's1', dayOfWeek: 5, startMin: 480, endMin: 540, label: 'Finance' }]
    const sessions = [{ id: 'f4', startedAt: at(8, 0), durationMin: 50, slotId: 's1' }]
    const out = buildDayTimeline({ slots, sessions, date: DAY })
    // Only the slot should appear, marked done, not a separate session item!
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'slot:s1', done: true })
  })

  it('excludes all session items when includeSessions is false', () => {
    const sessions = [{ id: 'f5', startedAt: at(8, 0), durationMin: 50 }]
    const out = buildDayTimeline({ sessions, date: DAY, includeSessions: false })
    expect(out).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// notes
// ---------------------------------------------------------------------------
describe('buildDayTimeline — note deadlines', () => {
  it('includes a note whose dueAt lands on the day', () => {
    const notes = [{ id: 'n1', title: 'Submit SOP', dueAt: at(14, 0) }]
    const [item] = buildDayTimeline({ notes, date: DAY })
    expect(item).toMatchObject({ id: 'note:n1', kind: 'note', startMin: 840, source: 'note' })
  })

  it('excludes notes without a dueAt and notes due on another day', () => {
    const notes = [
      { id: 'n2', title: 'No date' },
      { id: 'n3', title: 'Tomorrow', dueAt: nextDayAt(14) },
    ]
    expect(buildDayTimeline({ notes, date: DAY })).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// sort order
// ---------------------------------------------------------------------------
describe('buildDayTimeline — ordering', () => {
  it('returns anytime items first, then ascending by start time', () => {
    const out = buildDayTimeline({
      slots: [{ id: 's', dayOfWeek: 5, startMin: 780, endMin: 840, label: 'Afternoon' }],
      todos: [
        { id: 'late', text: 'Late', dueAt: at(20, 0) },
        { id: 'anytime', text: 'Anytime', allDay: true, dueAt: at(9, 0) },
        { id: 'early', text: 'Early', dueAt: at(7, 30) },
      ],
      date: DAY,
    })
    expect(out.map((i) => i.id)).toEqual(['todo:anytime', 'todo:early', 'slot:s', 'todo:late'])
  })

  it('breaks a start-time tie by kind (session before slot before todo)', () => {
    const out = buildDayTimeline({
      slots: [{ id: 's', dayOfWeek: 5, startMin: 600, endMin: 660, label: 'Slot' }],
      todos: [{ id: 't', text: 'Todo', dueAt: at(10, 0) }],
      sessions: [{ id: 'f', startedAt: at(10, 0), durationMin: 60 }],
      date: DAY,
    })
    expect(out.map((i) => i.kind)).toEqual(['session', 'slot', 'todo'])
  })

  it('never hides cross-mode items in the global view', () => {
    const out = buildDayTimeline({
      slots: [
        { id: 'x', dayOfWeek: 5, startMin: 600, endMin: 660, _modeId: 'm1' },
        { id: 'y', dayOfWeek: 5, startMin: 660, endMin: 720, _modeId: 'm2' },
      ],
      date: DAY,
    })
    expect(out.map((i) => i.modeId)).toEqual(['m1', 'm2'])
  })
})

// ---------------------------------------------------------------------------
// past stamping
// ---------------------------------------------------------------------------
describe('buildDayTimeline — past stamping', () => {
  it('marks items whose end is at/before nowMin as past', () => {
    const out = buildDayTimeline({
      slots: [
        { id: 'done', dayOfWeek: 5, startMin: 480, endMin: 540 },
        { id: 'future', dayOfWeek: 5, startMin: 900, endMin: 960 },
      ],
      todos: [{ id: 'a', text: 'Anytime', allDay: true, dueAt: DAY }],
      date: DAY,
      nowMin: 600,
    })
    expect(byId(out, 'slot:done').past).toBe(true)
    expect(byId(out, 'slot:future').past).toBe(false)
    expect(byId(out, 'todo:a').past).toBe(false)
  })

  it('defaults past to false when nowMin is omitted', () => {
    const out = buildDayTimeline({
      slots: [{ id: 'z', dayOfWeek: 5, startMin: 480, endMin: 540 }],
      date: DAY,
    })
    expect(out[0].past).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// summarizeDay
// ---------------------------------------------------------------------------
describe('summarizeDay', () => {
  const build = () =>
    buildDayTimeline({
      slots: [{ id: 's', dayOfWeek: 5, startMin: 600, endMin: 660, label: 'Study' }],
      todos: [{ id: 't', text: 'Todo', dueAt: at(18, 0) }],
      sessions: [{ id: 'f', startedAt: at(8, 0), durationMin: 60 }],
      date: DAY,
    })

  it('counts totals and done items across every kind', () => {
    const { totalCount, doneCount } = summarizeDay(build())
    expect(totalCount).toBe(3)
    expect(doneCount).toBe(1) // the completed session
  })

  it('returns null remaining / next when nowMin is omitted', () => {
    expect(summarizeDay(build())).toMatchObject({ remainingMin: null, nextItem: null })
  })

  it('computes remaining minutes to the last upcoming item end and the next item', () => {
    const res = summarizeDay(build(), 9 * 60) // 09:00
    // last upcoming end = the 18:00 todo (no endMin → uses startMin 1080)
    expect(res.remainingMin).toBe(1080 - 540)
    expect(res.nextItem.id).toBe('slot:s') // 10:00 slot is the earliest not-done item after 09:00
  })

  it('counts down to midnight when nothing is left on the clock', () => {
    const res = summarizeDay(build(), 23 * 60) // 23:00, everything past
    expect(res.remainingMin).toBe(24 * 60 - 23 * 60)
    expect(res.nextItem).toBeNull()
  })

  it('tolerates a non-array argument', () => {
    const res = summarizeDay(null, 600)
    expect(res).toMatchObject({ totalCount: 0, doneCount: 0, nextItem: null })
    expect(typeof res.remainingMin).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// misc contract
// ---------------------------------------------------------------------------
describe('buildDayTimeline — contract', () => {
  it('defaults to an empty timeline with no input', () => {
    expect(buildDayTimeline()).toEqual([])
  })

  it('every item exposes id / kind / title / color / ref', () => {
    const todos = [{ id: 't', text: 'Todo', dueAt: at(12, 0) }]
    const [item] = buildDayTimeline({ todos, date: DAY })
    expect(item.id).toBe('todo:t')
    expect(item.kind).toBe('todo')
    expect(item.title).toBe('Todo')
    expect(typeof item.color).toBe('string')
    expect(item.ref).toBe(todos[0])
  })
})

// ---------------------------------------------------------------------------
// carry-forward (P10)
// ---------------------------------------------------------------------------
describe('buildDayTimeline — carry-forward (P10)', () => {
  const yesterdayAt = (h, m = 0) => new Date(Y, M, D - 1, h, m, 0, 0)

  it('carries an incomplete overdue todo forward to today', () => {
    const todos = [{ id: 'overdue1', text: 'Missed yesterday', dueAt: yesterdayAt(14, 0), done: false }]
    const out = buildDayTimeline({ todos, date: DAY, carryForward: true })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      id: 'todo:overdue1',
      kind: 'todo',
      startMin: null, // placed in anytime bucket
      overdue: true,
      carriedFrom: '2024-06-14',
    })
  })

  it('carries an incomplete overdue kanban task forward to today', () => {
    const tasks = [{ id: 'task-overdue', title: 'Finish essay', dueAt: yesterdayAt(18, 0), column: 'todo', done: false }]
    const out = buildDayTimeline({ tasks, date: DAY, carryForward: true })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      id: 'task:task-overdue',
      kind: 'task',
      startMin: null,
      overdue: true,
      carriedFrom: '2024-06-14',
    })
  })

  it('does NOT carry forward a completed todo or done task', () => {
    const todos = [{ id: 'done-todo', text: 'Completed', dueAt: yesterdayAt(12, 0), done: true }]
    const tasks = [{ id: 'done-task', title: 'Done task', dueAt: yesterdayAt(12, 0), column: 'done' }]
    const out = buildDayTimeline({ todos, tasks, date: DAY, carryForward: true })
    expect(out).toHaveLength(0)
  })

  it('does NOT carry forward future items', () => {
    const todos = [{ id: 'future-todo', text: 'Tomorrow', dueAt: nextDayAt(12, 0), done: false }]
    const out = buildDayTimeline({ todos, date: DAY, carryForward: true })
    expect(out).toHaveLength(0)
  })

  it('does NOT carry overdue items onto non-today dates', () => {
    const todos = [{ id: 'overdue-not-today', text: 'Old task', dueAt: yesterdayAt(12, 0), done: false }]
    // Browsing a future day (June 16)
    const out = buildDayTimeline({ todos, date: nextDayAt(10, 0), carryForward: true })
    expect(out).toHaveLength(0)
  })

  it('does not duplicate items that are due on the current day', () => {
    const todos = [{ id: 'due-today', text: 'Due at 14:00 today', dueAt: at(14, 0), done: false }]
    const out = buildDayTimeline({ todos, date: DAY, carryForward: true })
    expect(out).toHaveLength(1)
    expect(out[0].carriedFrom).toBeUndefined()
  })

  it('respects carryForward: false opt-out', () => {
    const todos = [{ id: 'overdue-optout', text: 'Missed', dueAt: yesterdayAt(14, 0), done: false }]
    const out = buildDayTimeline({ todos, date: DAY, carryForward: false })
    expect(out).toHaveLength(0)
  })
})
