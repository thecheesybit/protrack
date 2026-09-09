import { useEffect, useRef } from 'react'

/**
 * Global 1-Second Heartbeat (`useGlobalTick`).
 * Consolidates multiple disparate `setInterval(..., 1000)` calls across the app
 * into a single synchronized wall-clock ticker.
 *
 * Automatically pauses the singleton timer when all subscribers unmount (ref-counted).
 */

const subscribers = new Set()
let timerId = null

function tick() {
  const now = new Date()
  subscribers.forEach((fn) => {
    try {
      fn(now)
    } catch (err) {
      console.error('[useGlobalTick] subscriber error:', err)
    }
  })
}

function startGlobalTicker() {
  if (timerId !== null) return
  // Align to exact wall-clock second boundary if possible
  const msToNextSecond = 1000 - (Date.now() % 1000)
  timerId = setTimeout(() => {
    tick()
    timerId = setInterval(tick, 1000)
  }, msToNextSecond)
}

function stopGlobalTicker() {
  if (timerId !== null) {
    clearTimeout(timerId)
    clearInterval(timerId)
    timerId = null
  }
}

/**
 * Imperatively subscribe a callback to the 1-second heartbeat.
 * Returns an unsubscribe function.
 *
 * @param {(now: Date) => void} callback
 * @returns {() => void}
 */
export function subscribeGlobalTick(callback) {
  subscribers.add(callback)
  if (subscribers.size === 1) {
    startGlobalTicker()
  }

  return () => {
    subscribers.delete(callback)
    if (subscribers.size === 0) {
      stopGlobalTicker()
    }
  }
}

/**
 * React hook that invokes `callback(now)` on every 1-second wall-clock tick.
 * Automatically manages subscription lifecycle.
 *
 * @param {(now: Date) => void} callback
 */
export function useGlobalTick(callback) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    const unsub = subscribeGlobalTick((now) => {
      cbRef.current?.(now)
    })
    return unsub
  }, [])
}
