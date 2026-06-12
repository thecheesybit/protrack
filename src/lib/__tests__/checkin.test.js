import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  currentSlot,
  selectQuestion,
  shouldPrompt,
  energyTrend,
  checkinInsight,
} from '../checkin.js'
import { ymd } from '../dates.js'

// Pin to June 15 2024 (local time) like the deadline tests.
const Y = 2024
const M = 5 // June (0-indexed)
const D = 15
const at = (h, m = 0) => new Date(Y, M, D, h, m, 0, 0)
const dayKey = (offset) => ymd(new Date(Y, M, D + offset))

// ---------------------------------------------------------------------------
// currentSlot
// ---------------------------------------------------------------------------
describe('currentSlot', () => {
  it('maps local hours onto the three slots', () => {
    expect(currentSlot(at(5))).toBe('morning')
    expect(currentSlot(at(11, 59))).toBe('morning')
    expect(currentSlot(at(12))).toBe('midday')
    expect(currentSlot(at(16, 59))).toBe('midday')
    expect(currentSlot(at(17))).toBe('evening')
    expect(currentSlot(at(22, 59))).toBe('evening')
  })

  it('returns null at night — no prompts while the user should be asleep', () => {
    expect(currentSlot(at(23))).toBeNull()
    expect(currentSlot(at(2))).toBeNull()
    expect(currentSlot(at(4, 59))).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// selectQuestion
// ---------------------------------------------------------------------------
describe('selectQuestion', () => {
  it('is deterministic for a given date and varies across days', () => {
    const a = selectQuestion('morning', { date: at(8) })
    const b = selectQuestion('morning', { date: at(8) })
    expect(a).toEqual(b)
    const days = [0, 1, 2].map((n) =>
      selectQuestion('morning', { date: new Date(Y, M, D + n, 8) }).id,
    )
    expect(new Set(days).size).toBe(3) // 3-question bank rotates daily
  })

  it('returns the right shape per slot', () => {
    expect(selectQuestion('morning', { date: at(8) }).type).toBe('intent')
    const midday = selectQuestion('midday', { date: at(13) })
    expect(midday.type).toBe('scale')
    expect(midday.low).toBeTruthy()
    expect(midday.high).toBeTruthy()
  })

  it('evening closes the loop on the morning intent when one exists', () => {
    const q = selectQuestion('evening', { date: at(19), morningIntent: 'Finish the physics review' })
    expect(q.id).toBe('e-intent')
    expect(q.type).toBe('scale')
    expect(q.text).toContain('Finish the physics review')
  })

  it('truncates very long intents in the evening question', () => {
    const long = 'x'.repeat(120)
    const q = selectQuestion('evening', { date: at(19), morningIntent: long })
    expect(q.text.length).toBeLessThan(90)
  })

  it('AI override replaces text only, keeping type and marking the id', () => {
    const q = selectQuestion('morning', { date: at(8), overrideText: 'Ready to chip away at that streak?' })
    expect(q.text).toBe('Ready to chip away at that streak?')
    expect(q.type).toBe('intent')
    expect(q.id).toMatch(/-ai$/)
  })

  it('returns null for an unknown slot', () => {
    expect(selectQuestion(null)).toBeNull()
    expect(selectQuestion('night')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// shouldPrompt
// ---------------------------------------------------------------------------
describe('shouldPrompt', () => {
  const base = {
    enabled: true,
    slot: 'midday',
    todayDoc: null,
    snoozedUntil: 0,
    now: 1_000_000,
    sessionStartedAt: 0,
    settleMs: 90_000,
  }

  it('prompts when every gate passes', () => {
    expect(shouldPrompt(base)).toBe(true)
  })

  it('never prompts when disabled or outside a slot', () => {
    expect(shouldPrompt({ ...base, enabled: false })).toBe(false)
    expect(shouldPrompt({ ...base, slot: null })).toBe(false)
  })

  it('waits for the settle period after app start', () => {
    expect(shouldPrompt({ ...base, sessionStartedAt: base.now - 30_000 })).toBe(false)
    expect(shouldPrompt({ ...base, sessionStartedAt: base.now - 90_000 })).toBe(true)
  })

  it('respects an active snooze', () => {
    expect(shouldPrompt({ ...base, snoozedUntil: base.now + 1 })).toBe(false)
    expect(shouldPrompt({ ...base, snoozedUntil: base.now })).toBe(true)
  })

  it('does not re-ask an already answered slot', () => {
    const todayDoc = { answers: { midday: { type: 'scale', value: 4 } } }
    expect(shouldPrompt({ ...base, todayDoc })).toBe(false)
    expect(shouldPrompt({ ...base, todayDoc, slot: 'evening' })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// energyTrend + checkinInsight (both depend on "now" via lastNDays)
// ---------------------------------------------------------------------------
describe('energyTrend', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(at(12))
  })
  afterEach(() => vi.useRealTimers())

  const docFor = (offset, values) => ({
    date: dayKey(offset),
    answers: Object.fromEntries(
      values.map((v, i) => [['midday', 'evening'][i], { type: 'scale', value: v }]),
    ),
  })

  it('averages scale answers per day and leaves gaps as null', () => {
    const trend = energyTrend([docFor(0, [3, 5]), docFor(-2, [2])], 7)
    expect(trend).toHaveLength(7)
    expect(trend[6]).toMatchObject({ key: dayKey(0), value: 4 })
    expect(trend[4]).toMatchObject({ key: dayKey(-2), value: 2 })
    expect(trend[5].value).toBeNull()
  })

  it('ignores intent answers — only scales carry a numeric signal', () => {
    const doc = { date: dayKey(0), answers: { morning: { type: 'intent', value: 'ship it' } } }
    expect(energyTrend([doc], 7)[6].value).toBeNull()
  })
})

describe('checkinInsight', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(at(12))
  })
  afterEach(() => vi.useRealTimers())

  const docFor = (offset, value) => ({
    date: dayKey(offset),
    answers: { midday: { type: 'scale', value } },
  })

  it('stays quiet without enough signal', () => {
    expect(checkinInsight([])).toBeNull()
    expect(checkinInsight([docFor(0, 4), docFor(-1, 4)])).toBeNull()
  })

  it('celebrates a strong week', () => {
    const docs = [docFor(0, 5), docFor(-1, 4), docFor(-2, 4)]
    expect(checkinInsight(docs)).toMatch(/Strong week/)
  })

  it('softens a heavy week', () => {
    const docs = [docFor(0, 2), docFor(-1, 1), docFor(-2, 2)]
    expect(checkinInsight(docs)).toMatch(/heavy/)
  })

  it('notices an upward trend at a moderate average', () => {
    const docs = [docFor(-3, 2), docFor(-2, 2), docFor(-1, 4), docFor(0, 4)]
    expect(checkinInsight(docs)).toMatch(/trending up/)
  })

  it('returns null for a steady, unremarkable week', () => {
    const docs = [docFor(0, 3), docFor(-1, 3), docFor(-2, 3)]
    expect(checkinInsight(docs)).toBeNull()
  })
})
