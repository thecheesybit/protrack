import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  eventToItem,
  itemToEvent,
  mergeStrategy,
  itemSignature,
  toMs,
} from '@/lib/gcalMap'

// Pin "now" so nextOccurrence() (used by itemToEvent for slots) is deterministic.
// 2026-09-08 is a Tuesday (app dayOfWeek 1).
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 8, 12, 0, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('eventToItem', () => {
  it('maps a weekly recurring timed event to a slot', () => {
    const item = eventToItem({
      id: 'evt_weekly',
      status: 'confirmed',
      summary: 'Algebra lecture',
      start: { dateTime: '2026-09-08T09:00:00' },
      end: { dateTime: '2026-09-08T10:30:00' },
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=TU'],
      updated: '2026-09-07T08:00:00.000Z',
    })
    expect(item).toMatchObject({
      kind: 'slot',
      googleEventId: 'evt_weekly',
      source: 'gcal',
      label: 'Algebra lecture',
      dayOfWeek: 1, // Tuesday
      startMin: 540,
      endMin: 630,
      recurrenceType: 'weekly',
    })
  })

  it('maps a one-off timed event to an event todo', () => {
    const item = eventToItem({
      id: 'evt_oneoff',
      status: 'confirmed',
      summary: 'Dentist',
      start: { dateTime: '2026-09-10T14:00:00' },
      end: { dateTime: '2026-09-10T14:45:00' },
      updated: '2026-09-07T08:00:00.000Z',
    })
    expect(item).toMatchObject({
      kind: 'todo',
      type: 'event',
      text: 'Dentist',
      eventDate: '2026-09-10',
      eventStartMin: 840,
      eventEndMin: 885,
      googleEventId: 'evt_oneoff',
    })
  })

  it('maps an all-day event to a dated todo anchored at 09:00 local', () => {
    const item = eventToItem({
      id: 'evt_allday',
      status: 'confirmed',
      summary: 'Project deadline',
      start: { date: '2026-09-12' },
      end: { date: '2026-09-13' },
      updated: '2026-09-07T08:00:00.000Z',
    })
    expect(item.kind).toBe('todo')
    expect(item.allDay).toBe(true)
    expect(item.text).toBe('Project deadline')
    const d = new Date(item.dueAt)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(12)
    expect(d.getHours()).toBe(9)
  })

  it('flags a cancelled event for deletion', () => {
    expect(eventToItem({ id: 'gone', status: 'cancelled' })).toEqual({
      kind: 'cancelled',
      googleEventId: 'gone',
    })
  })

  it('returns null for an event with no id or no start', () => {
    expect(eventToItem(null)).toBeNull()
    expect(eventToItem({ status: 'confirmed', summary: 'x' })).toBeNull()
    expect(eventToItem({ id: 'no_start', status: 'confirmed' })).toBeNull()
  })

  it('rejects a weekly slot whose end is not after its start', () => {
    expect(
      eventToItem({
        id: 'bad',
        status: 'confirmed',
        summary: 'overnight',
        start: { dateTime: '2026-09-08T23:00:00' },
        end: { dateTime: '2026-09-09T01:00:00' },
        recurrence: ['RRULE:FREQ=WEEKLY'],
      }),
    ).toBeNull()
  })
})

describe('itemToEvent', () => {
  it('maps a slot to a weekly recurring event on its next occurrence', () => {
    const ev = itemToEvent({
      dayOfWeek: 3, // Thursday
      startMin: 600,
      endMin: 660,
      label: 'Lab',
    })
    expect(ev.summary).toBe('Lab')
    expect(ev.recurrence).toEqual(['RRULE:FREQ=WEEKLY'])
    const start = new Date(ev.start.dateTime)
    expect(start.getDay()).toBe(4) // JS Thursday
    expect(start.getHours()).toBe(10)
  })

  it('maps an event todo to a single dateTime event', () => {
    const ev = itemToEvent({
      type: 'event',
      eventDate: '2026-09-15',
      eventStartMin: 780,
      eventEndMin: 840,
      text: 'Study group',
    })
    expect(ev.recurrence).toBeUndefined()
    expect(ev.summary).toBe('Study group')
    expect(new Date(ev.start.dateTime).getHours()).toBe(13)
    expect(new Date(ev.end.dateTime).getHours()).toBe(14)
  })

  it('maps a timed todo (dueAt with a time) to a 30-minute event', () => {
    const dueAt = new Date(2026, 8, 20, 16, 0, 0).toISOString()
    const ev = itemToEvent({ text: 'Submit essay', dueAt })
    expect(ev.start.dateTime).toBe(dueAt)
    expect(new Date(ev.end.dateTime).getTime() - new Date(ev.start.dateTime).getTime()).toBe(
      30 * 60000,
    )
  })

  it('maps an all-day todo to an all-day event spanning one day', () => {
    const dueAt = new Date(2026, 8, 20, 9, 0, 0).toISOString()
    const ev = itemToEvent({ title: 'Holiday', dueAt, allDay: true })
    expect(ev.start.date).toBe('2026-09-20')
    expect(ev.end.date).toBe('2026-09-21')
  })

  it('returns null when there is nothing time-like to sync', () => {
    expect(itemToEvent({ text: 'someday maybe' })).toBeNull()
    expect(itemToEvent(null)).toBeNull()
  })
})

describe('mergeStrategy', () => {
  it('newer local wins', () => {
    expect(mergeStrategy('2026-09-08T10:00:00Z', '2026-09-08T09:00:00Z')).toBe('local')
  })
  it('newer remote wins', () => {
    expect(mergeStrategy('2026-09-08T09:00:00Z', '2026-09-08T10:00:00Z')).toBe('remote')
  })
  it('equal timestamps → remote wins', () => {
    const t = '2026-09-08T09:00:00Z'
    expect(mergeStrategy(t, t)).toBe('remote')
  })
  it('missing both → remote wins', () => {
    expect(mergeStrategy(null, undefined)).toBe('remote')
  })
  it('only local has a timestamp → local wins', () => {
    expect(mergeStrategy('2026-09-08T09:00:00Z', null)).toBe('local')
  })
  it('only remote has a timestamp → remote wins', () => {
    expect(mergeStrategy(undefined, '2026-09-08T09:00:00Z')).toBe('remote')
  })
})

describe('itemSignature', () => {
  it('changes when a slot field changes, stable otherwise', () => {
    const a = { dayOfWeek: 1, startMin: 540, endMin: 600, label: 'X' }
    expect(itemSignature(a)).toBe(itemSignature({ ...a }))
    expect(itemSignature(a)).not.toBe(itemSignature({ ...a, startMin: 555 }))
  })
  it('distinguishes event todos from dated todos', () => {
    const sig = itemSignature({ type: 'event', eventDate: '2026-09-10', eventStartMin: 60, eventEndMin: 120, text: 'e' })
    expect(sig.startsWith('event|')).toBe(true)
    expect(itemSignature({ text: 't', dueAt: 123 }).startsWith('todo|')).toBe(true)
  })
})

describe('toMs', () => {
  it('handles Date, ISO string, epoch, Firestore Timestamp, and nullish', () => {
    expect(toMs(new Date(0))).toBe(0)
    expect(toMs('1970-01-01T00:00:00.000Z')).toBe(0)
    expect(toMs(1234)).toBe(1234)
    expect(toMs({ toDate: () => new Date(5000) })).toBe(5000)
    expect(toMs(null)).toBeNull()
    expect(toMs('not a date')).toBeNull()
  })
})
