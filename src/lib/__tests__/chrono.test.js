import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  slotForHour,
  getThemeCategory,
  readChronoOverride,
  setChronoOverride,
  getInitialChronoSlot,
  CHRONO_OVERRIDE_KEY,
} from '../chrono'

if (typeof globalThis.localStorage === 'undefined') {
  let store = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = String(v) },
      removeItem: (k) => { delete store[k] },
      clear: () => { store = {} },
    },
    writable: true,
  })
}

describe('chrono utilities', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('slotForHour', () => {
    it('maps 24-hour clock correctly across all 7 chrono slots', () => {
      expect(slotForHour(2)).toBe('deep_night')
      expect(slotForHour(5)).toBe('dawn')
      expect(slotForHour(6)).toBe('dawn')
      expect(slotForHour(8)).toBe('morning')
      expect(slotForHour(12)).toBe('midday')
      expect(slotForHour(16)).toBe('afternoon')
      expect(slotForHour(19)).toBe('dusk')
      expect(slotForHour(22)).toBe('evening')
    })
  })

  describe('getThemeCategory', () => {
    it('maps slots into 4 primary celestial themes', () => {
      expect(getThemeCategory('deep_night')).toBe('night')
      expect(getThemeCategory('evening')).toBe('night')
      expect(getThemeCategory('dawn')).toBe('morning')
      expect(getThemeCategory('morning')).toBe('morning')
      expect(getThemeCategory('midday')).toBe('day')
      expect(getThemeCategory('afternoon')).toBe('day')
      expect(getThemeCategory('dusk')).toBe('sunset')
    })
  })

  describe('readChronoOverride and setChronoOverride', () => {
    it('reads and sets overrides in localStorage', () => {
      expect(readChronoOverride()).toBeNull()
      setChronoOverride('night')
      expect(readChronoOverride()).toBe('deep_night')
      setChronoOverride('day')
      expect(readChronoOverride()).toBe('midday')
      setChronoOverride('morning')
      expect(readChronoOverride()).toBe('dawn')
      setChronoOverride('sunset')
      expect(readChronoOverride()).toBe('dusk')
      setChronoOverride('auto')
      expect(readChronoOverride()).toBeNull()
    })
  })

  describe('getInitialChronoSlot', () => {
    it('respects existing override', () => {
      localStorage.setItem(CHRONO_OVERRIDE_KEY, 'dusk')
      expect(getInitialChronoSlot()).toBe('dusk')
    })

    it('falls back to current hour when no override', () => {
      const now = new Date()
      const expected = slotForHour(now.getHours())
      expect(getInitialChronoSlot()).toBe(expected)
    })
  })
})
