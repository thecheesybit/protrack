/**
 * Lightweight, zero-dependency subscription cache with reference counting.
 *
 * Prevents multiple components from spinning up duplicate Firestore `onSnapshot`
 * listeners on identical user collections (e.g. habits, todos, notes, sessions).
 * When the first subscriber mounts, the Firestore listener is created.
 * Additional subscribers share the single active listener and receive the
 * cached data immediately (0ms delay). When all subscribers unmount, the
 * underlying listener is cleanly torn down.
 */

const registry = new Map()

/**
 * Subscribes to a shared data source identified by a unique cache key.
 *
 * @param {string} key - Unique identifier for the shared subscription
 * @param {Function} subscribeFn - Factory returning an unsubscribe function: (emit) => unsubscribe
 * @param {Function} onData - Callback to receive data updates
 * @returns {Function} Unsubscribe function for this specific listener
 */
export function subscribeWithCache(key, subscribeFn, onData) {
  let entry = registry.get(key)

  if (!entry) {
    entry = {
      value: undefined,
      hasValue: false,
      listeners: new Set(),
      unsubscribe: null,
    }
    registry.set(key, entry)

    entry.unsubscribe = subscribeFn((data) => {
      entry.value = data
      entry.hasValue = true
      entry.listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (err) {
          console.error(`[subscriptionCache] Error in listener for ${key}:`, err)
        }
      })
    })
  }

  entry.listeners.add(onData)

  // Synchronously deliver the latest cached value if already available
  if (entry.hasValue) {
    onData(entry.value)
  }

  return () => {
    entry.listeners.delete(onData)
    if (entry.listeners.size === 0) {
      if (typeof entry.unsubscribe === 'function') {
        entry.unsubscribe()
      }
      registry.delete(key)
    }
  }
}

/**
 * Returns the currently cached value for a key without subscribing, or undefined.
 *
 * @param {string} key
 * @returns {any}
 */
export function getCachedValue(key) {
  const entry = registry.get(key)
  return entry?.hasValue ? entry.value : undefined
}
