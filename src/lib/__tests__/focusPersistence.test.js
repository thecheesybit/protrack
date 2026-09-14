/**
 * The test env is `node`, so localStorage doesn't exist — install a minimal
 * stub, matching the convention in lib/__tests__/sound.test.js.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveFocusSnapshot,
  readFocusSnapshot,
  clearFocusSnapshot,
  resumableSessionMatches,
} from '@/lib/focusPersistence'

function makeStorage(initial = {}) {
  let map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => (map = new Map()),
  }
}

beforeEach(() => {
  global.localStorage = makeStorage()
})

describe('focusPersistence', () => {
  it('returns null when nothing has been saved', () => {
    expect(readFocusSnapshot()).toBeNull()
  })

  it('round-trips a saved snapshot, stamping savedAt', () => {
    const before = Date.now()
    saveFocusSnapshot({
      status: 'running',
      phase: 'focus',
      session: { label: 'Chemistry' },
      startedAt: 12345,
      phaseTotalSec: 1500,
      secondsLeft: 900,
      customTimerSetting: { work: 1500, break: 300 },
    })
    const snap = readFocusSnapshot()
    expect(snap.status).toBe('running')
    expect(snap.session).toEqual({ label: 'Chemistry' })
    expect(snap.secondsLeft).toBe(900)
    expect(snap.savedAt).toBeGreaterThanOrEqual(before)
  })

  it('clears the snapshot', () => {
    saveFocusSnapshot({ status: 'paused' })
    expect(readFocusSnapshot()).not.toBeNull()
    clearFocusSnapshot()
    expect(readFocusSnapshot()).toBeNull()
  })

  it('never throws when localStorage is unavailable', () => {
    const original = global.localStorage
    // @ts-expect-error simulating an environment without localStorage
    global.localStorage = undefined
    expect(() => saveFocusSnapshot({ status: 'running' })).not.toThrow()
    expect(readFocusSnapshot()).toBeNull()
    expect(() => clearFocusSnapshot()).not.toThrow()
    global.localStorage = original
  })

  it('returns null for corrupted JSON instead of throwing', () => {
    global.localStorage.setItem('protrack:focus:snapshot_v1', '{not json')
    expect(readFocusSnapshot()).toBeNull()
  })
})

describe('resumableSessionMatches', () => {
  const bySlot = { session: { slotId: 'slot-1', todoId: null } }
  const byTodo = { session: { slotId: null, todoId: 'todo-1' } }

  it('is false when there is no resumable session', () => {
    expect(resumableSessionMatches(null, { slotId: 'slot-1' })).toBe(false)
  })

  it('matches on slotId', () => {
    expect(resumableSessionMatches(bySlot, { slotId: 'slot-1' })).toBe(true)
    expect(resumableSessionMatches(bySlot, { slotId: 'slot-2' })).toBe(false)
  })

  it('matches on todoId', () => {
    expect(resumableSessionMatches(byTodo, { todoId: 'todo-1' })).toBe(true)
    expect(resumableSessionMatches(byTodo, { todoId: 'todo-2' })).toBe(false)
  })

  it('is false when the target has neither id', () => {
    expect(resumableSessionMatches(bySlot, {})).toBe(false)
  })
})
