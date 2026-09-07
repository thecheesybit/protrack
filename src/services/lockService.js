import { auth } from '@/lib/firebase'
import { updateSettings } from '@/services/userService'

export const LOCK_STORAGE_KEY = 'protrack:app_lock'
export const LOCKOUT_STORAGE_KEY = 'protrack:lock_attempts'
export const BASE_LOCKOUT_MINUTES = 5

/**
 * Calculates the lockout duration in milliseconds based on the number of failed attempts.
 * - < 3 attempts: 0 ms (no lockout)
 * - 3 attempts: 5 minutes (5 * 2^0)
 * - 4 attempts: 10 minutes (5 * 2^1)
 * - 5 attempts: 20 minutes (5 * 2^2)
 * - N attempts (>= 3): 5 * 2^(N - 3) minutes
 * @param {number} attempts
 * @returns {number}
 */
export function calculateLockoutDurationMs(attempts) {
  if (!attempts || attempts < 3) return 0
  const exponent = Math.min(attempts - 3, 10)
  const multiplier = Math.pow(2, exponent)
  const minutes = Math.min(BASE_LOCKOUT_MINUTES * multiplier, 24 * 60)
  return minutes * 60 * 1000
}

/**
 * Synchronously reads the lockout state from localStorage.
 * @returns {{ failedAttempts: number, lockedUntil: number | null }}
 */
export function getLockoutState() {
  try {
    if (typeof localStorage === 'undefined') return { failedAttempts: 0, lockedUntil: null }
    const raw = localStorage.getItem(LOCKOUT_STORAGE_KEY)
    if (!raw) return { failedAttempts: 0, lockedUntil: null }
    const parsed = JSON.parse(raw)
    const failedAttempts = Number(parsed.failedAttempts) || 0
    const lockedUntil = parsed.lockedUntil ? Number(parsed.lockedUntil) : null
    return { failedAttempts, lockedUntil }
  } catch {
    return { failedAttempts: 0, lockedUntil: null }
  }
}

/**
 * Returns the remaining lockout duration in milliseconds.
 * Returns 0 if not currently locked out.
 * @returns {number}
 */
export function getRemainingLockoutMs() {
  const { lockedUntil } = getLockoutState()
  if (!lockedUntil) return 0
  const remaining = lockedUntil - Date.now()
  return remaining > 0 ? remaining : 0
}

/**
 * Records a failed PIN attempt.
 * If total failed attempts reaches 3 or more:
 * - 3 attempts: 5 min lockout
 * - 4 attempts: 10 min lockout (2x)
 * - 5 attempts: 20 min lockout (2x), etc.
 * @returns {{ failedAttempts: number, lockedUntil: number | null, durationMs: number }}
 */
export function recordFailedAttempt() {
  const current = getLockoutState()
  const nextAttempts = current.failedAttempts + 1
  const durationMs = calculateLockoutDurationMs(nextAttempts)
  const lockedUntil = durationMs > 0 ? Date.now() + durationMs : null

  const newState = { failedAttempts: nextAttempts, lockedUntil }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(newState))
    }
  } catch (err) {
    console.warn('[lockService] failed to persist lockout state', err)
  }
  return { ...newState, durationMs }
}

/**
 * Resets failed attempts and clears any active lockout.
 */
export function clearLockoutState() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCKOUT_STORAGE_KEY)
    }
  } catch (err) {
    console.warn('[lockService] failed to clear lockout state', err)
  }
}

/**
 * Validates that a PIN is numeric and between 4 and 6 digits.
 * @param {string} pin
 * @returns {boolean}
 */
export function isValidPin(pin) {
  return typeof pin === 'string' && /^[0-9]{4,6}$/.test(pin)
}

/**
 * Generate a random cryptographically secure hex salt.
 */
export function generateSalt() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
}

/**
 * Hash a PIN with a salt using SHA-256.
 * @param {string} pin
 * @param {string} salt
 * @returns {Promise<string>}
 */
export async function hashPin(pin, salt) {
  const message = `${salt}:${pin}`
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(message)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Deterministic fallback for environments without subtle crypto
  let hash = 5381
  for (let i = 0; i < message.length; i++) {
    hash = (hash * 33) ^ message.charCodeAt(i)
  }
  return Math.abs(hash).toString(16)
}

/**
 * Synchronously read lock configuration from localStorage.
 * @returns {{ enabled: boolean, pinHash: string, salt: string, hint: string, lockOnMinimize: boolean, lockOnClose: boolean, pinLength?: number } | null}
 */
export function getLockConfig() {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(LOCK_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.error('[lockService] failed to read lock config', err)
    return null
  }
}

/**
 * Persist lock config to localStorage and sync with Firestore if authenticated.
 */
export async function persistLockConfig(config, userUid = null) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (config) {
        localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(config))
      } else {
        localStorage.removeItem(LOCK_STORAGE_KEY)
      }
    }
  } catch (err) {
    console.warn('[lockService] localStorage write failed', err)
  }

  // Sync to Firestore if user is logged in
  try {
    const uid = userUid || auth?.currentUser?.uid
    if (uid && (!auth?.currentUser || !auth.currentUser.isAnonymous)) {
      await updateSettings(uid, {
        appLock: config
          ? {
              enabled: Boolean(config.enabled),
              pinHash: config.pinHash,
              salt: config.salt,
              hint: config.hint || '',
              pinLength: config.pinLength || 4,
              lockOnMinimize: config.lockOnMinimize ?? true,
              lockOnClose: config.lockOnClose ?? true,
              updatedAt: config.updatedAt || Date.now(),
            }
          : null,
      })
    }
  } catch (err) {
    console.warn('[lockService] firestore sync failed (ignorable offline)', err)
  }
}

/**
 * Synchronize remote Firestore lock configuration into localStorage and Zustand store.
 * @param {Object|null} remoteLock
 * @param {Function} [onSync] - Callback to apply config to store and lock if active
 */
export function syncRemoteLockConfig(remoteLock, onSync) {
  try {
    const localConfig = getLockConfig()

    if (remoteLock && remoteLock.enabled && remoteLock.pinHash && remoteLock.salt) {
      // Remote has an active lock. Check if remote is newer or local is missing/disabled
      const shouldApply =
        !localConfig ||
        !localConfig.enabled ||
        !localConfig.updatedAt ||
        (remoteLock.updatedAt && remoteLock.updatedAt >= localConfig.updatedAt)

      if (shouldApply) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(remoteLock))
        }
        onSync?.(remoteLock)
      }
    } else if (remoteLock === null) {
      // Remote lock was explicitly disabled or removed
      if (localConfig?.enabled) {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(LOCK_STORAGE_KEY)
        }
        onSync?.(null)
      }
    }
  } catch (err) {
    console.warn('[lockService] syncRemoteLockConfig failed', err)
  }
}

/**
 * Verify an entered PIN against the stored config.
 * @param {string} enteredPin
 * @returns {Promise<boolean>}
 */
export async function verifyPin(enteredPin) {
  const config = getLockConfig()
  if (!config || !config.enabled) return true
  if (!enteredPin || typeof enteredPin !== 'string') return false
  const computedHash = await hashPin(enteredPin, config.salt)
  return computedHash === config.pinHash
}

/**
 * Configure and activate app lock with a new PIN and hint.
 * @param {Object} params
 * @param {string} params.pin - 4 to 6 digit PIN
 * @param {string} params.hint - reminder hint
 * @param {boolean} [params.lockOnMinimize=true]
 * @param {boolean} [params.lockOnClose=true]
 * @param {string} [params.uid=null]
 */
export async function setLockConfig({
  pin,
  hint,
  lockOnMinimize = true,
  lockOnClose = true,
  uid = null,
}) {
  if (!isValidPin(pin)) {
    throw new Error('PIN must be 4 to 6 numeric digits')
  }
  const cleanHint = (hint || '').trim()
  if (!cleanHint) {
    throw new Error('A reminder hint is required')
  }

  const salt = generateSalt()
  const pinHash = await hashPin(pin, salt)

  const config = {
    enabled: true,
    pinHash,
    salt,
    hint: cleanHint,
    pinLength: pin.length,
    lockOnMinimize,
    lockOnClose,
    updatedAt: Date.now(),
  }

  await persistLockConfig(config, uid)
  clearLockoutState()
  return config
}

/**
 * Update lock trigger preferences (e.g. lock on minimize, lock on close).
 */
export async function updateLockTriggers({ lockOnMinimize, lockOnClose, uid = null }) {
  const config = getLockConfig()
  if (!config) return null
  const updated = {
    ...config,
    lockOnMinimize: lockOnMinimize !== undefined ? lockOnMinimize : config.lockOnMinimize,
    lockOnClose: lockOnClose !== undefined ? lockOnClose : config.lockOnClose,
    updatedAt: Date.now(),
  }
  await persistLockConfig(updated, uid)
  return updated
}

/**
 * Change the existing PIN and Hint. Requires current PIN verification.
 */
export async function changePin(currentPin, newPin, newHint, uid = null) {
  const config = getLockConfig()
  if (config?.enabled) {
    const isCurrentValid = await verifyPin(currentPin)
    if (!isCurrentValid) {
      throw new Error('Current PIN is incorrect')
    }
  }

  return setLockConfig({
    pin: newPin,
    hint: newHint || config?.hint,
    lockOnMinimize: config?.lockOnMinimize ?? true,
    lockOnClose: config?.lockOnClose ?? true,
    uid,
  })
}

/**
 * Disable app lock. Requires verification of the current PIN.
 */
export async function disableLock(currentPin, uid = null) {
  const config = getLockConfig()
  if (config?.enabled && currentPin !== undefined) {
    const isCurrentValid = await verifyPin(currentPin)
    if (!isCurrentValid) {
      throw new Error('Incorrect PIN. Cannot disable App Lock.')
    }
  }

  await persistLockConfig(null, uid)
  clearLockoutState()
  return true
}

/**
 * Unconditionally clears the lock configuration in localStorage and Firestore.
 */
export async function resetLock(uid = null) {
  await persistLockConfig(null, uid)
  clearLockoutState()
  return true
}
