/**
 * Tests for the pure prompt-queue slice. We drive it with a tiny fake `set`
 * that applies the immutable patch, exactly as Zustand would.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createPromptSlice } from '../promptSlice.js'

function makeSlice() {
  let state = {}
  const set = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch
    state = { ...state, ...next }
  }
  state = createPromptSlice(set)
  return {
    get: () => state,
    api: () => state, // actions live on state
  }
}

describe('promptSlice', () => {
  let slice
  beforeEach(() => {
    slice = makeSlice()
  })

  it('starts empty', () => {
    expect(slice.get().activePrompt).toBeNull()
    expect(slice.get().promptQueue).toEqual([])
  })

  it('first push becomes active, second waits in the queue', () => {
    const id1 = slice.get().pushPrompt({ type: 'checkin', payload: { slot: 'morning' } })
    expect(slice.get().activePrompt).toMatchObject({ id: id1, type: 'checkin' })
    expect(slice.get().promptQueue).toHaveLength(0)

    const id2 = slice.get().pushPrompt({ type: 'quote' })
    expect(slice.get().activePrompt.id).toBe(id1)
    expect(slice.get().promptQueue).toHaveLength(1)
    expect(slice.get().promptQueue[0]).toMatchObject({ id: id2, type: 'quote' })
    expect(id2).toBeGreaterThan(id1)
  })

  it('applies defaults: type checkin, payload null, snoozeMs null, dismissible true', () => {
    slice.get().pushPrompt({})
    expect(slice.get().activePrompt).toMatchObject({
      type: 'checkin',
      payload: null,
      snoozeMs: null,
      dismissible: true,
    })
  })

  it('honours an explicit dismissible:false and a numeric snoozeMs', () => {
    slice.get().pushPrompt({ type: 'routine', dismissible: false, snoozeMs: 600000 })
    expect(slice.get().activePrompt).toMatchObject({ dismissible: false, snoozeMs: 600000 })
  })

  it('resolvePrompt advances to the next queued prompt', () => {
    slice.get().pushPrompt({ type: 'checkin' })
    const id2 = slice.get().pushPrompt({ type: 'routine' })
    slice.get().resolvePrompt()
    expect(slice.get().activePrompt.id).toBe(id2)
    expect(slice.get().promptQueue).toHaveLength(0)
  })

  it('resolvePrompt on the last prompt clears the active slot', () => {
    slice.get().pushPrompt({ type: 'quote' })
    slice.get().resolvePrompt()
    expect(slice.get().activePrompt).toBeNull()
    expect(slice.get().promptQueue).toEqual([])
  })

  it('snoozePrompt advances the queue exactly like resolvePrompt', () => {
    slice.get().pushPrompt({ type: 'checkin' })
    const id2 = slice.get().pushPrompt({ type: 'quote' })
    slice.get().snoozePrompt()
    expect(slice.get().activePrompt.id).toBe(id2)
  })

  it('dismissPrompt removes a queued prompt without disturbing the active one', () => {
    const id1 = slice.get().pushPrompt({ type: 'checkin' })
    const id2 = slice.get().pushPrompt({ type: 'routine' })
    const id3 = slice.get().pushPrompt({ type: 'quote' })
    slice.get().dismissPrompt(id2)
    expect(slice.get().activePrompt.id).toBe(id1)
    expect(slice.get().promptQueue.map((p) => p.id)).toEqual([id3])
  })

  it('dismissPrompt on the active prompt promotes the next in line', () => {
    const id1 = slice.get().pushPrompt({ type: 'checkin' })
    const id2 = slice.get().pushPrompt({ type: 'routine' })
    slice.get().dismissPrompt(id1)
    expect(slice.get().activePrompt.id).toBe(id2)
  })

  it('clearPrompts empties everything', () => {
    slice.get().pushPrompt({ type: 'checkin' })
    slice.get().pushPrompt({ type: 'routine' })
    slice.get().clearPrompts()
    expect(slice.get().activePrompt).toBeNull()
    expect(slice.get().promptQueue).toEqual([])
  })

  it('never mutates the previous queue array', () => {
    slice.get().pushPrompt({ type: 'checkin' })
    const q1 = slice.get().promptQueue
    slice.get().pushPrompt({ type: 'routine' })
    const q2 = slice.get().promptQueue
    expect(q1).not.toBe(q2)
  })
})
