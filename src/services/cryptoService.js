import { auth } from '@/lib/firebase'

export const CIPHER_PREFIX = 'ENC:v1:'
const APP_SALT_DOMAIN = 'protrack:vault:v1:inherent'

/**
 * Deterministically derives an account unique 7-digit code from user UID.
 * Matches the profile.uniqueCode format generated in userService.
 * @param {string} [uid]
 * @returns {string}
 */
export function deriveUniqueCode(uid) {
  if (!uid || typeof uid !== 'string') return '0000000'
  const hash = Array.from(uid).reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
  return String(Math.abs(hash) % 9000000 + 1000000)
}

/**
 * Helper: Convert Uint8Array to base64 string.
 */
export function uint8ToBase64(bytes) {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Helper: Convert base64 string to Uint8Array.
 */
export function base64ToUint8(base64) {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// In-memory cache for active CryptoKey and decrypted local values
let activeCryptoKey = null
let activeContext = { uid: null, uniqueCode: null, hasPin: false }
const inMemorySecureCache = new Map()

/**
 * Derives an AES-256-GCM encryption key using PBKDF2-HMAC-SHA256
 * from Account Unique Code, optional PIN, and app inherent salt.
 *
 * @param {string} uniqueCode - 7-digit account unique code
 * @param {string|null} [pin] - User PIN (if configured)
 * @param {string} [uid] - User Firebase UID
 * @returns {Promise<CryptoKey>}
 */
export async function deriveEncryptionKey(uniqueCode, pin = null, uid = '') {
  const codeStr = String(uniqueCode || '0000000').trim()
  const pinStr = pin ? String(pin).trim() : ''
  const secret = pinStr ? `${codeStr}:${pinStr}` : codeStr
  const saltString = `${APP_SALT_DOMAIN}:${uid || 'app'}`

  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  const saltHash = await crypto.subtle.digest('SHA-256', encoder.encode(saltString))

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltHash,
      iterations: 25000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Sets the active in-memory session key.
 * @param {CryptoKey} key
 * @param {{ uid?: string, uniqueCode?: string, hasPin?: boolean }} [meta]
 */
export function setActiveSessionKey(key, meta = {}) {
  activeCryptoKey = key
  activeContext = {
    uid: meta.uid || null,
    uniqueCode: meta.uniqueCode || null,
    hasPin: Boolean(meta.hasPin),
  }
}

export function hasActivePinSession() {
  return activeCryptoKey !== null && activeContext.hasPin === true
}

export function getActiveSessionContext() {
  return { ...activeContext }
}

/**
 * Returns the currently active session key, deriving a fallback if needed.
 * @returns {Promise<CryptoKey>}
 */
export async function getActiveSessionKey() {
  if (activeCryptoKey) return activeCryptoKey

  // Attempt to initialize from current authenticated user
  const currentUser = auth?.currentUser
  const uid = currentUser?.uid || ''
  const code = deriveUniqueCode(uid)

  activeCryptoKey = await deriveEncryptionKey(code, null, uid)
  activeContext = { uid, uniqueCode: code, hasPin: false }
  return activeCryptoKey
}

/**
 * Initializes or updates the active encryption session with account details and verified PIN.
 * @param {string} uid
 * @param {string} uniqueCode
 * @param {string|null} [pin]
 * @returns {Promise<CryptoKey>}
 */
export async function initSessionFromAccount(uid, uniqueCode, pin = null) {
  const code = uniqueCode || deriveUniqueCode(uid)
  const key = await deriveEncryptionKey(code, pin, uid)
  setActiveSessionKey(key, { uid, uniqueCode: code, hasPin: Boolean(pin) })

  // Eagerly decrypt known sensitive local keys into the in-memory cache
  const sensitiveKeys = [
    'protrack:gemini_key',
    'protrack:openai_key',
    'protrack:anthropic_key',
    'protrack:deepseek_key',
    'protrack:elevenlabs_key',
    'protrack:gcal_auth_core',
  ]

  if (typeof localStorage !== 'undefined') {
    for (const k of sensitiveKeys) {
      const raw = localStorage.getItem(k)
      if (raw) {
        try {
          const decrypted = await decryptValue(raw, key)
          inMemorySecureCache.set(k, decrypted)
        } catch {
          // ignore individual key decryption errors
        }
      }
    }
  }

  return key
}

/**
 * Clears the active session key and in-memory cache on logout or lock.
 */
export function clearSessionCrypto() {
  activeCryptoKey = null
  activeContext = { uid: null, uniqueCode: null, hasPin: false }
  inMemorySecureCache.clear()
}

/**
 * Encrypts a string or serializable value into an armored cipher string:
 * "ENC:v1:<base64-iv>:<base64-ciphertext>"
 *
 * @param {string|any} data
 * @param {CryptoKey} [key]
 * @returns {Promise<string>}
 */
export async function encryptValue(data, key = null) {
  if (data === null || data === undefined) return data
  const cipherKey = key || (await getActiveSessionKey())
  if (!cipherKey) return data

  const textToEncrypt = typeof data === 'string' ? data : JSON.stringify(data)
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cipherKey,
    encoder.encode(textToEncrypt),
  )

  return `${CIPHER_PREFIX}${uint8ToBase64(iv)}:${uint8ToBase64(new Uint8Array(encryptedBuf))}`
}

/**
 * Decrypts an armored cipher string back to its original value.
 * If data is unencrypted (legacy plaintext), it is returned as-is.
 *
 * @param {string} ciphertext
 * @param {CryptoKey} [key]
 * @returns {Promise<string>}
 */
export async function decryptValue(ciphertext, key = null) {
  if (typeof ciphertext !== 'string' || !ciphertext.startsWith(CIPHER_PREFIX)) {
    return ciphertext // return as-is for legacy plaintext
  }
  const cipherKey = key || (await getActiveSessionKey())
  if (!cipherKey) return ciphertext

  try {
    const payload = ciphertext.slice(CIPHER_PREFIX.length)
    const colonIdx = payload.indexOf(':')
    if (colonIdx === -1) return ciphertext

    const iv = base64ToUint8(payload.slice(0, colonIdx))
    const encryptedData = base64ToUint8(payload.slice(colonIdx + 1))

    const decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cipherKey,
      encryptedData,
    )

    return new TextDecoder().decode(decryptedBuf)
  } catch (err) {
    console.warn('[cryptoService] decryption failed with key', err)
    return ciphertext
  }
}

/**
 * Encrypts specified fields of an object.
 * @param {Object} obj
 * @param {string[]} fields
 * @param {CryptoKey} [key]
 * @returns {Promise<Object>}
 */
export async function encryptObject(obj, fields, key = null) {
  if (!obj || typeof obj !== 'object') return obj
  const result = { ...obj }
  for (const f of fields) {
    if (result[f] !== undefined && result[f] !== null) {
      result[f] = await encryptValue(result[f], key)
    }
  }
  return result
}

/**
 * Decrypts specified fields of an object.
 * @param {Object} obj
 * @param {string[]} fields
 * @param {CryptoKey} [key]
 * @returns {Promise<Object>}
 */
export async function decryptObject(obj, fields, key = null) {
  if (!obj || typeof obj !== 'object') return obj
  const result = { ...obj }
  for (const f of fields) {
    if (typeof result[f] === 'string' && result[f].startsWith(CIPHER_PREFIX)) {
      result[f] = await decryptValue(result[f], key)
    }
  }
  return result
}

/**
 * Unified encrypted storage helper for localStorage.
 */
export const secureStorage = {
  /**
   * Encrypts and writes value to localStorage. Also caches in memory.
   */
  async setItem(key, value) {
    try {
      if (typeof localStorage === 'undefined') return
      const cleanVal = value == null ? '' : String(value)
      inMemorySecureCache.set(key, cleanVal)
      const encrypted = await encryptValue(cleanVal)
      localStorage.setItem(key, encrypted)
    } catch (err) {
      console.warn('[secureStorage] setItem failed', err)
    }
  },

  /**
   * Asynchronously reads and decrypts value from localStorage.
   */
  async getItem(key) {
    try {
      if (inMemorySecureCache.has(key)) {
        return inMemorySecureCache.get(key)
      }
      if (typeof localStorage === 'undefined') return null
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const decrypted = await decryptValue(raw)
      inMemorySecureCache.set(key, decrypted)
      return decrypted
    } catch (err) {
      console.warn('[secureStorage] getItem failed', err)
      return null
    }
  },

  /**
   * Synchronous getter from in-memory cache or legacy unencrypted localStorage.
   */
  getItemSync(key) {
    if (inMemorySecureCache.has(key)) {
      return inMemorySecureCache.get(key)
    }
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    // If not encrypted, return directly
    if (!raw.startsWith(CIPHER_PREFIX)) {
      inMemorySecureCache.set(key, raw)
      return raw
    }
    // If encrypted and not yet in memory, trigger background decryption
    decryptValue(raw).then((val) => {
      inMemorySecureCache.set(key, val)
    }).catch(() => {/* ignore */})
    return null
  },

  /**
   * Removes item from localStorage and memory cache.
   */
  removeItem(key) {
    inMemorySecureCache.delete(key)
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key)
      }
    } catch {
      /* ignore */
    }
  },
}
