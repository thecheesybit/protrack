import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { subscribeWithCache, getCachedValue } from '@/services/subscriptionCache'

describe('subscribeWithCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates exactly one underlying subscription for multiple concurrent subscribers', () => {
    const subscribeFn = vi.fn((emit) => {
      emit(['a'])
      return vi.fn()
    })
    const onDataA = vi.fn()
    const onDataB = vi.fn()

    subscribeWithCache('key1', subscribeFn, onDataA)
    subscribeWithCache('key1', subscribeFn, onDataB)

    expect(subscribeFn).toHaveBeenCalledTimes(1)
    expect(onDataA).toHaveBeenCalledWith(['a'])
    expect(onDataB).toHaveBeenCalledWith(['a'])
  })

  it('delivers the cached value synchronously to a late subscriber', () => {
    const subscribeFn = vi.fn((emit) => {
      emit(['x', 'y'])
      return vi.fn()
    })
    subscribeWithCache('key2', subscribeFn, vi.fn())

    const late = vi.fn()
    subscribeWithCache('key2', subscribeFn, late)
    expect(late).toHaveBeenCalledWith(['x', 'y'])
    expect(subscribeFn).toHaveBeenCalledTimes(1)
  })

  it('does not tear down the underlying listener immediately when the last subscriber leaves', () => {
    const unsubscribe = vi.fn()
    const subscribeFn = vi.fn(() => unsubscribe)
    const unsub = subscribeWithCache('key3', subscribeFn, vi.fn())

    unsub()
    expect(unsubscribe).not.toHaveBeenCalled()
  })

  it('reuses the live listener if a new subscriber joins within the grace period (the fix for the Firestore rapid-resubscribe crash)', () => {
    const unsubscribe = vi.fn()
    const subscribeFn = vi.fn(() => unsubscribe)

    const unsubA = subscribeWithCache('key4', subscribeFn, vi.fn())
    unsubA()

    vi.advanceTimersByTime(1000) // still within the grace window
    subscribeWithCache('key4', subscribeFn, vi.fn())

    vi.advanceTimersByTime(10000) // long past the original grace window
    expect(subscribeFn).toHaveBeenCalledTimes(1)
    expect(unsubscribe).not.toHaveBeenCalled()
  })

  it('tears down and clears the cache once the grace period fully elapses with no subscribers', () => {
    const unsubscribe = vi.fn()
    const subscribeFn = vi.fn(() => unsubscribe)

    const unsub = subscribeWithCache('key5', subscribeFn, vi.fn())
    unsub()

    vi.advanceTimersByTime(3000)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(getCachedValue('key5')).toBeUndefined()

    // A subsequent subscribe creates a brand new underlying listener.
    subscribeWithCache('key5', subscribeFn, vi.fn())
    expect(subscribeFn).toHaveBeenCalledTimes(2)
  })

  it('keeps notifying other listeners when one listener callback throws', () => {
    const subscribeFn = (emit) => {
      emit(['v1'])
      return vi.fn()
    }
    const throwing = vi.fn(() => {
      throw new Error('boom')
    })
    const fine = vi.fn()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    subscribeWithCache('key6', subscribeFn, throwing)
    subscribeWithCache('key6', subscribeFn, fine)

    expect(fine).toHaveBeenCalledWith(['v1'])
    errSpy.mockRestore()
  })

  it('getCachedValue returns undefined for an unknown key', () => {
    expect(getCachedValue('never-subscribed')).toBeUndefined()
  })
})
