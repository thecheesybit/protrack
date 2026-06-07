import { describe, it, expect } from 'vitest'
import { getPriority, nextPriority, PRIORITIES, PRIORITY_ORDER } from '../priority.js'

describe('getPriority', () => {
  it('returns the matching priority object for each key', () => {
    for (const p of PRIORITIES) {
      const result = getPriority(p.key)
      expect(result.key).toBe(p.key)
      expect(result.label).toBeTruthy()
      expect(result.color).toBeTruthy()
    }
  })

  it('defaults to medium for an unknown key', () => {
    expect(getPriority('nonexistent').key).toBe('medium')
  })

  it('defaults to medium for undefined', () => {
    expect(getPriority(undefined).key).toBe('medium')
  })

  it('defaults to medium for null', () => {
    expect(getPriority(null).key).toBe('medium')
  })

  it('returns high for "high"', () => {
    expect(getPriority('high').label).toBe('High')
  })

  it('returns the correct urgency color for urgent', () => {
    const urgent = getPriority('urgent')
    expect(urgent.color).toBe('#ef4444')
  })
})

describe('nextPriority', () => {
  it('cycles low → medium', () => expect(nextPriority('low')).toBe('medium'))
  it('cycles medium → high', () => expect(nextPriority('medium')).toBe('high'))
  it('cycles high → urgent', () => expect(nextPriority('high')).toBe('urgent'))
  it('cycles urgent → low (wraps around)', () => expect(nextPriority('urgent')).toBe('low'))

  it('wraps from the last priority back to the first', () => {
    const last = PRIORITIES[PRIORITIES.length - 1].key
    const first = PRIORITIES[0].key
    expect(nextPriority(last)).toBe(first)
  })

  it('covers all PRIORITIES in a full cycle', () => {
    let key = PRIORITIES[0].key
    const visited = new Set()
    for (let i = 0; i < PRIORITIES.length; i++) {
      visited.add(key)
      key = nextPriority(key)
    }
    // After a full cycle we should be back at the start
    expect(key).toBe(PRIORITIES[0].key)
    expect(visited.size).toBe(PRIORITIES.length)
  })
})

describe('PRIORITY_ORDER', () => {
  it('has urgent as the highest-priority (lowest number)', () => {
    expect(PRIORITY_ORDER.urgent).toBeLessThan(PRIORITY_ORDER.high)
    expect(PRIORITY_ORDER.high).toBeLessThan(PRIORITY_ORDER.medium)
    expect(PRIORITY_ORDER.medium).toBeLessThan(PRIORITY_ORDER.low)
  })
})
