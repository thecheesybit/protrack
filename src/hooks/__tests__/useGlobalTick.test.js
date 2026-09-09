import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { subscribeGlobalTick } from '../useGlobalTick'

describe('useGlobalTick & subscribeGlobalTick', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllTimers()
  })

  it('subscribes and fires on second boundary', () => {
    const fn = vi.fn()
    const unsub = subscribeGlobalTick(fn)

    // Fast-forward 1000ms
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalled()
    const initialCallCount = fn.mock.calls.length

    vi.advanceTimersByTime(2000)
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(initialCallCount + 2)

    unsub()
  })

  it('stops timer when all subscribers unsubscribe', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const unsub1 = subscribeGlobalTick(fn1)
    const unsub2 = subscribeGlobalTick(fn2)

    vi.advanceTimersByTime(1000)
    expect(fn1).toHaveBeenCalled()
    expect(fn2).toHaveBeenCalled()

    unsub1()
    unsub2()

    const count1 = fn1.mock.calls.length
    const count2 = fn2.mock.calls.length

    vi.advanceTimersByTime(3000)
    expect(fn1.mock.calls.length).toBe(count1)
    expect(fn2.mock.calls.length).toBe(count2)
  })

  it('passes a Date instance to each subscriber on tick', () => {
    let received = null
    const unsub = subscribeGlobalTick((now) => {
      received = now
    })

    vi.advanceTimersByTime(1000)
    expect(received).toBeInstanceOf(Date)
    unsub()
  })
})

