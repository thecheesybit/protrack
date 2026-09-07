import { describe, it, expect, beforeEach } from 'vitest'
import {
  deriveUniqueCode,
  deriveEncryptionKey,
  encryptValue,
  decryptValue,
  encryptObject,
  decryptObject,
  initSessionFromAccount,
  clearSessionCrypto,
  hasActivePinSession,
  secureStorage,
  CIPHER_PREFIX,
} from '../cryptoService'

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

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storageMock,
    writable: true,
  })
}

describe('cryptoService', () => {
  beforeEach(() => {
    clearSessionCrypto()
    globalThis.localStorage.clear()
  })

  describe('deriveUniqueCode', () => {
    it('generates a 7-digit deterministic code from uid', () => {
      const c1 = deriveUniqueCode('user-12345')
      const c2 = deriveUniqueCode('user-12345')
      const c3 = deriveUniqueCode('user-99999')

      expect(c1).toBe(c2)
      expect(c1).toMatch(/^[0-9]{7}$/)
      expect(c1).not.toBe(c3)
    })

    it('returns default 0000000 for empty uid', () => {
      expect(deriveUniqueCode('')).toBe('0000000')
      expect(deriveUniqueCode(null)).toBe('0000000')
    })
  })

  describe('encryption and decryption', () => {
    it('encrypts and decrypts a string accurately using derived key without PIN', async () => {
      const key = await deriveEncryptionKey('1234567', null, 'test-uid')
      const message = 'ProTrack confidential study plan'

      const cipher = await encryptValue(message, key)
      expect(cipher).toMatch(/^ENC:v1:/)
      expect(cipher).not.toBe(message)

      const decrypted = await decryptValue(cipher, key)
      expect(decrypted).toBe(message)
    })

    it('encrypts and decrypts using derived key with PIN', async () => {
      const keyWithPin = await deriveEncryptionKey('1234567', '4321', 'test-uid')
      const message = 'Secret task details'

      const cipher = await encryptValue(message, keyWithPin)
      expect(cipher).toMatch(/^ENC:v1:/)

      const decrypted = await decryptValue(cipher, keyWithPin)
      expect(decrypted).toBe(message)

      // Decrypting with wrong key / without PIN should fail and return original ciphertext
      const keyWithoutPin = await deriveEncryptionKey('1234567', null, 'test-uid')
      const failed = await decryptValue(cipher, keyWithoutPin)
      expect(failed).toBe(cipher)
    })

    it('returns legacy plaintext unchanged if not encrypted', async () => {
      const plain = 'Legacy plain text note'
      const res = await decryptValue(plain)
      expect(res).toBe(plain)
    })

    it('encrypts and decrypts specific fields of an object', async () => {
      const key = await deriveEncryptionKey('7654321', '9876', 'uid-1')
      const note = {
        title: 'Meeting Notes',
        content: 'Top secret strategy',
        tags: ['strategy', 'confidential'],
        summary: 'Executive summary',
      }

      const encrypted = await encryptObject(note, ['content', 'summary'], key)
      expect(encrypted.title).toBe('Meeting Notes') // Unchanged
      expect(encrypted.content).toMatch(/^ENC:v1:/) // Encrypted
      expect(encrypted.summary).toMatch(/^ENC:v1:/) // Encrypted
      expect(encrypted.tags).toEqual(['strategy', 'confidential']) // Unchanged

      const decrypted = await decryptObject(encrypted, ['content', 'summary'], key)
      expect(decrypted.content).toBe('Top secret strategy')
      expect(decrypted.summary).toBe('Executive summary')
    })

    it('initializes active session key and decrypts transparently', async () => {
      await initSessionFromAccount('user-session-1', '3333333', '1234')
      const secret = 'Automatic session encryption'

      const cipher = await encryptValue(secret)
      expect(cipher).toMatch(/^ENC:v1:/)

      const decrypted = await decryptValue(cipher)
      expect(decrypted).toBe(secret)
    })

    it('tracks active pin session correctly with hasActivePinSession', async () => {
      expect(hasActivePinSession()).toBe(false)

      await initSessionFromAccount('user-no-pin', '1111111', null)
      expect(hasActivePinSession()).toBe(false)

      await initSessionFromAccount('user-pin', '2222222', '5555')
      expect(hasActivePinSession()).toBe(true)

      clearSessionCrypto()
      expect(hasActivePinSession()).toBe(false)
    })

    it('secureStorage encrypts, decrypts and caches synchronously', async () => {
      await initSessionFromAccount('storage-user', '7777777', '9999')
      await secureStorage.setItem('test_secret_key', 'my-api-token-xyz')

      // Directly check localStorage has cipher prefix
      const rawInStorage = localStorage.getItem('test_secret_key')
      expect(rawInStorage).toMatch(/^ENC:v1:/)

      // Synchronous retrieval from in-memory cache
      const cached = secureStorage.getItemSync('test_secret_key')
      expect(cached).toBe('my-api-token-xyz')

      // Async retrieval
      const asyncGot = await secureStorage.getItem('test_secret_key')
      expect(asyncGot).toBe('my-api-token-xyz')

      // Removal
      secureStorage.removeItem('test_secret_key')
      expect(secureStorage.getItemSync('test_secret_key')).toBeNull()
      expect(localStorage.getItem('test_secret_key')).toBeNull()
    })
  })
})
