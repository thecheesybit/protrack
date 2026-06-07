import { describe, it, expect } from 'vitest'
import {
  minutesToLabel,
  minutesToAxis,
  snap,
  clampMin,
  durationLabel,
  DAY_START_MIN,
  DAY_END_MIN,
} from '../time.js'

describe('minutesToLabel', () => {
  it('converts midnight (0) → "12:00 AM"', () => {
    expect(minutesToLabel(0)).toBe('12:00 AM')
  })

  it('converts 60 (1am) → "1:00 AM"', () => {
    expect(minutesToLabel(60)).toBe('1:00 AM')
  })

  it('converts 570 (9:30am) → "9:30 AM"', () => {
    expect(minutesToLabel(570)).toBe('9:30 AM')
  })

  it('converts 720 (noon) → "12:00 PM"', () => {
    expect(minutesToLabel(720)).toBe('12:00 PM')
  })

  it('converts 780 (1pm) → "1:00 PM"', () => {
    expect(minutesToLabel(780)).toBe('1:00 PM')
  })

  it('converts 1020 (5pm) → "5:00 PM"', () => {
    expect(minutesToLabel(1020)).toBe('5:00 PM')
  })

  it('converts 1439 (11:59pm) → "11:59 PM"', () => {
    expect(minutesToLabel(1439)).toBe('11:59 PM')
  })

  it('pads minutes to two digits', () => {
    expect(minutesToLabel(61)).toBe('1:01 AM')
  })
})

describe('minutesToAxis', () => {
  it('returns compact label for 6am → "6a"', () => {
    expect(minutesToAxis(360)).toBe('6a')
  })

  it('returns "12p" for noon', () => {
    expect(minutesToAxis(720)).toBe('12p')
  })

  it('returns "9p" for 21:00', () => {
    expect(minutesToAxis(1260)).toBe('9p')
  })
})

describe('snap', () => {
  it('rounds down when below midpoint of step', () => {
    expect(snap(7, 5)).toBe(5)
  })

  it('rounds up when above midpoint of step', () => {
    expect(snap(8, 5)).toBe(10)
  })

  it('keeps exact multiples unchanged', () => {
    expect(snap(10, 5)).toBe(10)
    expect(snap(60, 15)).toBe(60)
  })

  it('uses step=5 by default', () => {
    expect(snap(12)).toBe(10)
    expect(snap(13)).toBe(15)
  })

  it('works with step=15', () => {
    expect(snap(22, 15)).toBe(15)
    expect(snap(23, 15)).toBe(30)
  })
})

describe('clampMin', () => {
  it('clamps below DAY_START_MIN up to DAY_START_MIN', () => {
    expect(clampMin(0)).toBe(DAY_START_MIN)
    expect(clampMin(DAY_START_MIN - 1)).toBe(DAY_START_MIN)
  })

  it('clamps above DAY_END_MIN down to DAY_END_MIN', () => {
    expect(clampMin(DAY_END_MIN + 100)).toBe(DAY_END_MIN)
    expect(clampMin(9999)).toBe(DAY_END_MIN)
  })

  it('leaves values within [DAY_START_MIN, DAY_END_MIN] unchanged', () => {
    expect(clampMin(DAY_START_MIN)).toBe(DAY_START_MIN)
    expect(clampMin(DAY_END_MIN)).toBe(DAY_END_MIN)
    const mid = Math.floor((DAY_START_MIN + DAY_END_MIN) / 2)
    expect(clampMin(mid)).toBe(mid)
  })
})

describe('durationLabel', () => {
  it('shows minutes only for < 1 hour', () => {
    expect(durationLabel(600, 630)).toBe('30m')
    expect(durationLabel(600, 610)).toBe('10m')
  })

  it('shows hours only for exact multiples', () => {
    expect(durationLabel(600, 660)).toBe('1h')
    expect(durationLabel(600, 720)).toBe('2h')
  })

  it('shows both hours and minutes for mixed durations', () => {
    expect(durationLabel(600, 690)).toBe('1h 30m')
    expect(durationLabel(600, 695)).toBe('1h 35m')
  })
})
