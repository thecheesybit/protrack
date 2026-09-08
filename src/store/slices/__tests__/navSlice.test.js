/**
 * Tests for the pure cross-module nav bus. Driven with a tiny fake `set` that
 * applies the immutable patch, exactly as Zustand would.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createNavSlice, NAV_STACK_MAX } from '../navSlice.js'

function makeSlice() {
  let state = {}
  const set = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch
    state = { ...state, ...next }
  }
  state = createNavSlice(set)
  return { get: () => state }
}

describe('navSlice', () => {
  let slice
  beforeEach(() => {
    slice = makeSlice()
  })

  it('starts empty', () => {
    expect(slice.get().moduleContext).toBeNull()
    expect(slice.get().navStack).toEqual([])
  })

  it('openModule sets a fully-shaped context with activate defaulting true', () => {
    slice.get().openModule('todos', { itemType: 'todo', itemId: 'abc' })
    expect(slice.get().moduleContext).toMatchObject({
      widgetId: 'todos',
      itemType: 'todo',
      itemId: 'abc',
      subjectId: null,
      date: null,
      tag: null,
      activate: true,
    })
    expect(typeof slice.get().moduleContext.seq).toBe('number')
  })

  it('openModule is a no-op when widgetId is falsy', () => {
    slice.get().openModule('', { itemId: 'x' })
    expect(slice.get().moduleContext).toBeNull()
    expect(slice.get().navStack).toEqual([])
  })

  it('honours an explicit activate:false and passes through subjectId/date/tag', () => {
    slice.get().openModule('focus', {
      itemType: 'subject',
      itemId: 's1',
      subjectId: 's1',
      date: '2026-09-07',
      tag: 'deep-work',
      activate: false,
    })
    expect(slice.get().moduleContext).toMatchObject({
      widgetId: 'focus',
      subjectId: 's1',
      date: '2026-09-07',
      tag: 'deep-work',
      activate: false,
    })
  })

  it('assigns a strictly increasing seq on every openModule', () => {
    slice.get().openModule('todos', {})
    const a = slice.get().moduleContext.seq
    slice.get().openModule('todos', {})
    const b = slice.get().moduleContext.seq
    expect(b).toBeGreaterThan(a)
  })

  it('first openModule does not create a back entry (nothing to return to)', () => {
    slice.get().openModule('todos', {})
    expect(slice.get().navStack).toEqual([])
  })

  it('second openModule pushes the prior context onto navStack', () => {
    slice.get().openModule('todos', { itemId: 't1' })
    const first = slice.get().moduleContext
    slice.get().openModule('subjects', { itemId: 's1' })
    expect(slice.get().navStack).toHaveLength(1)
    expect(slice.get().navStack[0]).toBe(first)
    expect(slice.get().moduleContext.widgetId).toBe('subjects')
  })

  it('navBack restores the previous context and shrinks the stack', () => {
    slice.get().openModule('todos', { itemId: 't1' })
    slice.get().openModule('subjects', { itemId: 's1' })
    slice.get().navBack()
    expect(slice.get().moduleContext.widgetId).toBe('todos')
    expect(slice.get().moduleContext.itemId).toBe('t1')
    expect(slice.get().navStack).toEqual([])
  })

  it('navBack with an empty stack clears the context', () => {
    slice.get().openModule('todos', {})
    expect(slice.get().navStack).toEqual([])
    slice.get().navBack()
    expect(slice.get().moduleContext).toBeNull()
  })

  it('navBack is a no-op when already empty', () => {
    slice.get().navBack()
    expect(slice.get().moduleContext).toBeNull()
    expect(slice.get().navStack).toEqual([])
  })

  it('clearModuleContext nulls the context but leaves the stack intact', () => {
    slice.get().openModule('todos', {})
    slice.get().openModule('subjects', {})
    slice.get().clearModuleContext()
    expect(slice.get().moduleContext).toBeNull()
    expect(slice.get().navStack).toHaveLength(1)
  })

  it(`bounds the back-stack to the last ${NAV_STACK_MAX} entries`, () => {
    const calls = NAV_STACK_MAX + 5
    for (let i = 0; i < calls; i++) {
      slice.get().openModule('todos', { itemId: `n${i}` })
    }
    expect(slice.get().navStack).toHaveLength(NAV_STACK_MAX)
    // The first openModule pushes nothing, so (calls - 1) contexts were pushed;
    // the oldest (calls - 1 - MAX) of them fell off the front.
    const firstSurviving = calls - 1 - NAV_STACK_MAX
    expect(slice.get().navStack[0].itemId).toBe(`n${firstSurviving}`)
    expect(slice.get().navStack[NAV_STACK_MAX - 1].itemId).toBe(`n${calls - 2}`)
  })

  it('never mutates the previous navStack array', () => {
    slice.get().openModule('todos', {})
    slice.get().openModule('subjects', {})
    const s1 = slice.get().navStack
    slice.get().openModule('notes', {})
    const s2 = slice.get().navStack
    expect(s1).not.toBe(s2)
  })
})
