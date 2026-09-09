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

  it('enforces mutual exclusion between bottomDockOpen and timetableLegendsExpanded', () => {
    slice.get().setTimetableLegendsEnabled(true)
    slice.get().setTimetableLegendsExpanded(false)
    expect(slice.get().bottomDockOpen).toBe(false)
    expect(slice.get().timetableLegendsExpanded).toBe(false)

    // Expanding timetable legends closes bottom dock
    slice.get().setBottomDockOpen(true)
    expect(slice.get().bottomDockOpen).toBe(true)

    slice.get().setTimetableLegendsExpanded(true)
    expect(slice.get().timetableLegendsExpanded).toBe(true)
    expect(slice.get().bottomDockOpen).toBe(false)

    // Opening bottom dock closes timetable legends
    slice.get().setBottomDockOpen(true)
    expect(slice.get().bottomDockOpen).toBe(true)
    expect(slice.get().timetableLegendsExpanded).toBe(false)
  })

  it('enforces mutual exclusion between modeRailOpen ("The Pill") and timetableLegendsExpanded ("The Legend")', () => {
    slice.get().setTimetableLegendsEnabled(true)
    slice.get().setTimetableLegendsExpanded(false)
    slice.get().setModeRailOpen(true)
    // 1. Initial state: modeRailOpen is true, timetableLegendsExpanded is false
    expect(slice.get().modeRailOpen).toBe(true)
    expect(slice.get().timetableLegendsExpanded).toBe(false)

    // 2. If legend opens and the pill is open, the pill closes
    slice.get().setTimetableLegendsExpanded(true)
    expect(slice.get().timetableLegendsExpanded).toBe(true)
    expect(slice.get().modeRailOpen).toBe(false)

    // 3. If legend is open and I open the pill, the legend closes
    slice.get().setModeRailOpen(true)
    expect(slice.get().modeRailOpen).toBe(true)
    expect(slice.get().timetableLegendsExpanded).toBe(false)

    // 4. Both can be closed at the same time
    slice.get().setModeRailOpen(false)
    expect(slice.get().modeRailOpen).toBe(false)
    expect(slice.get().timetableLegendsExpanded).toBe(false)

    // 5. But both cannot be open at the same time
    slice.get().setTimetableLegendsExpanded(true)
    expect(slice.get().timetableLegendsExpanded).toBe(true)
    expect(slice.get().modeRailOpen).toBe(false)
  })

  it('enforces scope dropdown rules: closes legend on open, and blocks legend from opening while open', () => {
    slice.get().setTimetableLegendsEnabled(true)
    // 1. Legend is open
    slice.get().setTimetableLegendsExpanded(true)
    expect(slice.get().timetableLegendsExpanded).toBe(true)

    // 2. User clicks selected scope dropdown list and it drops down -> legend always closes
    slice.get().setScopeDropdownOpen(true)
    expect(slice.get().scopeDropdownOpen).toBe(true)
    expect(slice.get().timetableLegendsExpanded).toBe(false)

    // 3. While selecting scope (scopeDropdownOpen = true), legend can't open
    slice.get().setTimetableLegendsExpanded(true)
    expect(slice.get().timetableLegendsExpanded).toBe(false)

    // 4. Once scope dropdown closes ("gone back up"), pill reappears!
    slice.get().setScopeDropdownOpen(false)
    expect(slice.get().scopeDropdownOpen).toBe(false)
    expect(slice.get().modeRailOpen).toBe(true)

    // And legend can open again
    slice.get().setTimetableLegendsExpanded(true)
    expect(slice.get().timetableLegendsExpanded).toBe(true)
  })

  it('handles L key toggle for legends on and off (locked by default, remains closed when off)', () => {
    // Locked by default
    expect(slice.get().timetableLegendsEnabled).toBe(false)
    expect(slice.get().timetableLegendsExpanded).toBe(false)

    // 1. When locked, it remains closed even if setTimetableLegendsExpanded(true) is called
    slice.get().setTimetableLegendsExpanded(true)
    expect(slice.get().timetableLegendsExpanded).toBe(false)

    // 2. Toggle on using toggleTimetableLegends (pressing L unlocks and expands)
    slice.get().toggleTimetableLegends()
    expect(slice.get().timetableLegendsEnabled).toBe(true)
    expect(slice.get().timetableLegendsExpanded).toBe(true)

    // 3. Toggle off using toggleTimetableLegends while expanded (pressing L locks and closes)
    slice.get().toggleTimetableLegends()
    expect(slice.get().timetableLegendsEnabled).toBe(false)
    expect(slice.get().timetableLegendsExpanded).toBe(false)

    // 4. Toggle back on using setTimetableLegendsEnabled(true)
    slice.get().setTimetableLegendsEnabled(true)
    expect(slice.get().timetableLegendsEnabled).toBe(true)
    expect(slice.get().timetableLegendsExpanded).toBe(true)

    // 5. Toggle off using setTimetableLegendsEnabled(false)
    slice.get().setTimetableLegendsEnabled(false)
    expect(slice.get().timetableLegendsEnabled).toBe(false)
    expect(slice.get().timetableLegendsExpanded).toBe(false)
  })
})
