import { describe, it, expect } from 'vitest'
import { formatFocusClock } from '@/lib/focusClock'

describe('formatFocusClock', () => {
  it('shows MM:SS below one hour', () => {
    expect(formatFocusClock(0)).toBe('00:00')
    expect(formatFocusClock(59)).toBe('00:59')
    expect(formatFocusClock(25 * 60)).toBe('25:00')
    expect(formatFocusClock(59 * 60 + 59)).toBe('59:59')
  })

  it('shows H:MM:SS at one hour or more, keeping seconds', () => {
    expect(formatFocusClock(3600)).toBe('1:00:00')
    expect(formatFocusClock(90 * 60)).toBe('1:30:00')
    expect(formatFocusClock(2 * 3600 + 5 * 60 + 9)).toBe('2:05:09')
  })

  it('clamps negatives and floors fractional seconds', () => {
    expect(formatFocusClock(-30)).toBe('00:00')
    expect(formatFocusClock(90.9)).toBe('01:30')
  })

  it('is resilient to non-numeric input', () => {
    expect(formatFocusClock(undefined)).toBe('00:00')
    expect(formatFocusClock(NaN)).toBe('00:00')
  })
})
