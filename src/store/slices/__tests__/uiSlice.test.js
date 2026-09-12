import { describe, it, expect, beforeEach } from 'vitest'
import { createUiSlice } from '../uiSlice.js'
import { ymd } from '@/lib/dates'

function makeSlice() {
  let state = {}
  const set = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch
    state = { ...state, ...next }
  }
  const get = () => state
  state = createUiSlice(set, get)
  return { get: () => state }
}

describe('uiSlice — selectedDate & day synchronization', () => {
  let slice
  beforeEach(() => {
    slice = makeSlice()
  })

  it('initializes selectedDate to today', () => {
    expect(slice.get().selectedDate).toBe(ymd(new Date()))
  })

  it('setSelectedDate updates date from string', () => {
    slice.get().setSelectedDate('2026-09-10')
    expect(slice.get().selectedDate).toBe('2026-09-10')
  })

  it('setSelectedDate updates date from Date instance', () => {
    const d = new Date(2026, 8, 15) // Sep 15, 2026
    slice.get().setSelectedDate(d)
    expect(slice.get().selectedDate).toBe('2026-09-15')
  })

  it('resetSelectedDate resets to current date', () => {
    slice.get().setSelectedDate('2026-10-01')
    expect(slice.get().selectedDate).toBe('2026-10-01')
    slice.get().resetSelectedDate()
    expect(slice.get().selectedDate).toBe(ymd(new Date()))
  })

  it('setSelectedDate ignores falsy or invalid input', () => {
    slice.get().setSelectedDate('2026-09-10')
    slice.get().setSelectedDate(null)
    expect(slice.get().selectedDate).toBe('2026-09-10')
    slice.get().setSelectedDate('')
    expect(slice.get().selectedDate).toBe('2026-09-09' !== slice.get().selectedDate ? '2026-09-10' : '2026-09-09')
  })

  it('restores modeRailOpen when scope dropdown closes', () => {
    slice.get().setScopeDropdownOpen(true)
    expect(slice.get().scopeDropdownOpen).toBe(true)

    slice.get().setScopeDropdownOpen(false)
    expect(slice.get().scopeDropdownOpen).toBe(false)
    expect(slice.get().modeRailOpen).toBe(true)
  })
})
