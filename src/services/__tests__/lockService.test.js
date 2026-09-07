import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isValidPin,
  generateSalt,
  hashPin,
  getLockConfig,
  setLockConfig,
  verifyPin,
  changePin,
  updateLockTriggers,
  disableLock,
  LOCK_STORAGE_KEY,
  LOCKOUT_STORAGE_KEY,
  BASE_LOCKOUT_MINUTES,
  calculateLockoutDurationMs,
  recordFailedAttempt,
  getLockoutState,
  getRemainingLockoutMs,
  clearLockoutState,
  syncRemoteLockConfig,
} from '../lockService'

const storageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value)
    },
    removeItem: (key) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
})

describe('lockService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('isValidPin', () => {
    it('accepts 4, 5, and 6 digit numeric strings', () => {
      expect(isValidPin('1234')).toBe(true)
      expect(isValidPin('0000')).toBe(true)
      expect(isValidPin('12345')).toBe(true)
      expect(isValidPin('123456')).toBe(true)
      expect(isValidPin('999999')).toBe(true)
    })

    it('rejects strings shorter than 4 digits', () => {
      expect(isValidPin('123')).toBe(false)
      expect(isValidPin('1')).toBe(false)
      expect(isValidPin('')).toBe(false)
    })

    it('rejects strings longer than 6 digits', () => {
      expect(isValidPin('1234567')).toBe(false)
      expect(isValidPin('12345678')).toBe(false)
    })

    it('rejects non-numeric characters', () => {
      expect(isValidPin('123a')).toBe(false)
      expect(isValidPin('abcd')).toBe(false)
      expect(isValidPin('12-4')).toBe(false)
      expect(isValidPin('12 4')).toBe(false)
    })

    it('rejects non-string types', () => {
      expect(isValidPin(null)).toBe(false)
      expect(isValidPin(undefined)).toBe(false)
      expect(isValidPin(1234)).toBe(false)
    })
  })

  describe('generateSalt & hashPin', () => {
    it('generates unique salts', () => {
      const s1 = generateSalt()
      const s2 = generateSalt()
      expect(s1).toBeTruthy()
      expect(s2).toBeTruthy()
      expect(s1).not.toBe(s2)
    })

    it('produces deterministic hashes for identical inputs', async () => {
      const salt = generateSalt()
      const h1 = await hashPin('1234', salt)
      const h2 = await hashPin('1234', salt)
      expect(h1).toBe(h2)
    })

    it('produces different hashes for different PINs', async () => {
      const salt = generateSalt()
      const h1 = await hashPin('1234', salt)
      const h2 = await hashPin('4321', salt)
      expect(h1).not.toBe(h2)
    })
  })

  describe('setLockConfig & getLockConfig', () => {
    it('throws if PIN is invalid', async () => {
      await expect(setLockConfig({ pin: '12', hint: 'short' })).rejects.toThrow(
        'PIN must be 4 to 6 numeric digits',
      )
    })

    it('throws if hint is empty', async () => {
      await expect(setLockConfig({ pin: '1234', hint: '   ' })).rejects.toThrow(
        'A reminder hint is required',
      )
    })

    it('successfully configures and retrieves lock config', async () => {
      const config = await setLockConfig({
        pin: '123456',
        hint: 'My six digits',
        lockOnMinimize: true,
        lockOnClose: false,
      })

      expect(config.enabled).toBe(true)
      expect(config.hint).toBe('My six digits')
      expect(config.pinLength).toBe(6)
      expect(config.lockOnMinimize).toBe(true)
      expect(config.lockOnClose).toBe(false)

      const stored = getLockConfig()
      expect(stored.enabled).toBe(true)
      expect(stored.hint).toBe('My six digits')
      expect(stored.pinLength).toBe(6)
      expect(stored.lockOnClose).toBe(false)
    })
  })

  describe('verifyPin', () => {
    it('verifies correct PIN accurately', async () => {
      await setLockConfig({ pin: '5678', hint: 'four digits' })
      expect(await verifyPin('5678')).toBe(true)
      expect(await verifyPin('1234')).toBe(false)
      expect(await verifyPin('')).toBe(false)
      expect(await verifyPin(null)).toBe(false)
    })

    it('returns true if lock is disabled or not configured', async () => {
      expect(await verifyPin('anything')).toBe(true)
    })
  })

  describe('updateLockTriggers', () => {
    it('updates trigger preferences without altering PIN or hint', async () => {
      await setLockConfig({ pin: '1234', hint: 'test' })
      const updated = await updateLockTriggers({ lockOnMinimize: false, lockOnClose: true })

      expect(updated.lockOnMinimize).toBe(false)
      expect(updated.lockOnClose).toBe(true)
      expect(await verifyPin('1234')).toBe(true)
    })
  })

  describe('changePin', () => {
    it('rejects change if current PIN is wrong', async () => {
      await setLockConfig({ pin: '1234', hint: 'initial hint' })
      await expect(changePin('9999', '5678', 'new hint')).rejects.toThrow(
        'Current PIN is incorrect',
      )
    })

    it('successfully updates PIN and hint with correct current PIN', async () => {
      await setLockConfig({ pin: '1234', hint: 'initial hint' })
      await changePin('1234', '987654', 'updated hint')

      expect(await verifyPin('1234')).toBe(false)
      expect(await verifyPin('987654')).toBe(true)

      const config = getLockConfig()
      expect(config.hint).toBe('updated hint')
      expect(config.pinLength).toBe(6)
    })
  })

  describe('disableLock', () => {
    it('rejects disabling if current PIN is incorrect', async () => {
      await setLockConfig({ pin: '1234', hint: 'hint' })
      await expect(disableLock('0000')).rejects.toThrow('Incorrect PIN')
      expect(getLockConfig()?.enabled).toBe(true)
    })

    it('successfully disables lock with correct current PIN', async () => {
      await setLockConfig({ pin: '1234', hint: 'hint' })
      const res = await disableLock('1234')
      expect(res).toBe(true)
      expect(getLockConfig()).toBeNull()
    })
  })

  describe('lockout and exponential backoff', () => {
    it('calculates 0ms duration for less than 3 attempts', () => {
      expect(calculateLockoutDurationMs(0)).toBe(0)
      expect(calculateLockoutDurationMs(1)).toBe(0)
      expect(calculateLockoutDurationMs(2)).toBe(0)
    })

    it('locks out for exactly 5 minutes on the 3rd wrong attempt', () => {
      const fiveMinutesMs = 5 * 60 * 1000
      expect(calculateLockoutDurationMs(3)).toBe(fiveMinutesMs)
    })

    it('doubles lockout duration for every subsequent wrong attempt (2x)', () => {
      const fiveMinutesMs = 5 * 60 * 1000
      expect(calculateLockoutDurationMs(4)).toBe(fiveMinutesMs * 2) // 10 minutes
      expect(calculateLockoutDurationMs(5)).toBe(fiveMinutesMs * 4) // 20 minutes
      expect(calculateLockoutDurationMs(6)).toBe(fiveMinutesMs * 8) // 40 minutes
      expect(calculateLockoutDurationMs(7)).toBe(fiveMinutesMs * 16) // 80 minutes
    })

    it('tracks failed attempts and sets lockedUntil timestamp at 3 attempts', () => {
      clearLockoutState()

      // Attempt 1
      const a1 = recordFailedAttempt()
      expect(a1.failedAttempts).toBe(1)
      expect(a1.lockedUntil).toBeNull()
      expect(getRemainingLockoutMs()).toBe(0)

      // Attempt 2
      const a2 = recordFailedAttempt()
      expect(a2.failedAttempts).toBe(2)
      expect(a2.lockedUntil).toBeNull()
      expect(getRemainingLockoutMs()).toBe(0)

      // Attempt 3: 5 minutes lockout
      const a3 = recordFailedAttempt()
      expect(a3.failedAttempts).toBe(3)
      expect(a3.lockedUntil).toBeGreaterThan(Date.now())
      expect(getRemainingLockoutMs()).toBeGreaterThan(0)
      expect(getRemainingLockoutMs()).toBeLessThanOrEqual(5 * 60 * 1000)

      // Attempt 4: 10 minutes lockout (2x)
      const a4 = recordFailedAttempt()
      expect(a4.failedAttempts).toBe(4)
      expect(getRemainingLockoutMs()).toBeGreaterThan(5 * 60 * 1000)
      expect(getRemainingLockoutMs()).toBeLessThanOrEqual(10 * 60 * 1000)

      // Attempt 5: 20 minutes lockout (2x)
      const a5 = recordFailedAttempt()
      expect(a5.failedAttempts).toBe(5)
      expect(getRemainingLockoutMs()).toBeGreaterThan(10 * 60 * 1000)
      expect(getRemainingLockoutMs()).toBeLessThanOrEqual(20 * 60 * 1000)

      // Attempt 6: 40 minutes lockout (2x)
      const a6 = recordFailedAttempt()
      expect(a6.failedAttempts).toBe(6)
      expect(getRemainingLockoutMs()).toBeGreaterThan(20 * 60 * 1000)
      expect(getRemainingLockoutMs()).toBeLessThanOrEqual(40 * 60 * 1000)

      // Clear lockout
      clearLockoutState()
      expect(getRemainingLockoutMs()).toBe(0)
      expect(getLockoutState().failedAttempts).toBe(0)
    })

    it('clears lockout state when lock is configured, disabled, or reset', async () => {
      recordFailedAttempt()
      recordFailedAttempt()
      recordFailedAttempt()
      expect(getRemainingLockoutMs()).toBeGreaterThan(0)

      // Re-configuring lock resets lockout
      await setLockConfig({ pin: '4321', hint: 'hint' })
      expect(getRemainingLockoutMs()).toBe(0)
      expect(getLockoutState().failedAttempts).toBe(0)

      // Disabling lock clears lockout
      recordFailedAttempt()
      recordFailedAttempt()
      recordFailedAttempt()
      expect(getRemainingLockoutMs()).toBeGreaterThan(0)
      await disableLock('4321')
      expect(getRemainingLockoutMs()).toBe(0)
    })

    it('verifies PINs of arbitrary lengths without leaking target length', async () => {
      await setLockConfig({ pin: '5555', hint: 'hint' })
      // Testing shorter than 4 digits does not throw, returns false smoothly
      expect(await verifyPin('5')).toBe(false)
      expect(await verifyPin('55')).toBe(false)
      expect(await verifyPin('555')).toBe(false)
      expect(await verifyPin('5555')).toBe(true)
      expect(await verifyPin('55555')).toBe(false)
    })
  })

  describe('syncRemoteLockConfig', () => {
    it('applies remote lock to local storage when local config is empty', () => {
      const onSync = vi.fn()
      const remoteConfig = {
        enabled: true,
        pinHash: 'remotehash',
        salt: 'remotesalt',
        hint: 'remote hint',
        updatedAt: Date.now(),
      }

      syncRemoteLockConfig(remoteConfig, onSync)

      const stored = getLockConfig()
      expect(stored).toEqual(remoteConfig)
      expect(onSync).toHaveBeenCalledWith(remoteConfig)
    })

    it('applies remote lock when remote is newer than local', async () => {
      await setLockConfig({ pin: '1111', hint: 'older' })
      const onSync = vi.fn()

      const newerRemote = {
        enabled: true,
        pinHash: 'newerhash',
        salt: 'newersalt',
        hint: 'newer hint',
        updatedAt: Date.now() + 5000,
      }

      syncRemoteLockConfig(newerRemote, onSync)

      const stored = getLockConfig()
      expect(stored.pinHash).toBe('newerhash')
      expect(onSync).toHaveBeenCalledWith(newerRemote)
    })

    it('clears local lock config when remote specifies null (disabled on remote)', async () => {
      await setLockConfig({ pin: '2222', hint: 'hint' })
      expect(getLockConfig()?.enabled).toBe(true)

      const onSync = vi.fn()
      syncRemoteLockConfig(null, onSync)

      expect(getLockConfig()).toBeNull()
      expect(onSync).toHaveBeenCalledWith(null)
    })
  })
})
