import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateCompanionSessionId,
  buildCompanionQrUrl,
  extractSessionId,
  createCompanionSession,
  claimCompanionSession,
  clearCompanionSession,
} from '../companionLinkService'

vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: { uid: 'test-user-123' },
  },
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, coll, id) => ({ coll, id })),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  Timestamp: {
    fromMillis: (ms) => ({ toMillis: () => ms }),
  },
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: {
    credential: vi.fn((token) => ({ providerId: 'google.com', token })),
  },
  signInWithCredential: vi.fn().mockResolvedValue({
    user: { uid: 'test-user-123', email: 'user@example.com' },
  }),
}))

describe('companionLinkService', () => {
  describe('generateCompanionSessionId', () => {
    it('generates an 8-character grouped Crockford base32 ID (XXXX-XXXX)', () => {
      const id = generateCompanionSessionId()
      expect(id).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/)
      expect(id.length).toBe(9)
    })

    it('produces unique IDs across sequential calls', () => {
      const ids = new Set(Array.from({ length: 10 }, () => generateCompanionSessionId()))
      expect(ids.size).toBe(10)
    })
  })

  describe('buildCompanionQrUrl', () => {
    it('constructs a valid web pairing URL with query and hash params', () => {
      const url = buildCompanionQrUrl('K4F7-X9MQ')
      expect(url).toContain('/pair?s=K4F7-X9MQ#pair=K4F7-X9MQ')
    })
  })

  describe('extractSessionId', () => {
    it('extracts sessionId from custom scheme protrack://pair?s=XXXX-XXXX', () => {
      expect(extractSessionId('protrack://pair?s=AB12-CD34')).toBe('AB12-CD34')
    })

    it('extracts sessionId from https pair web URL', () => {
      expect(extractSessionId('https://pro-track-app.netlify.app/pair?s=AB12-CD34')).toBe('AB12-CD34')
    })

    it('extracts sessionId from URL with hash pair=', () => {
      expect(extractSessionId('https://github.com/thecheesybit/protrack/releases/latest#pair=AB12-CD34')).toBe('AB12-CD34')
    })

    it('normalizes unhyphenated 8-character string', () => {
      expect(extractSessionId('ab12cd34')).toBe('AB12-CD34')
    })

    it('returns formatted raw code if already valid', () => {
      expect(extractSessionId('  ab12-cd34  ')).toBe('AB12-CD34')
    })
  })

  describe('createCompanionSession', () => {
    it('writes handshake document to Firestore with 2-minute TTL', async () => {
      const { setDoc } = await import('firebase/firestore')
      const res = await createCompanionSession('dummy-google-id-token')

      expect(res.sessionId).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/)
      expect(res.expiresAtMs).toBeGreaterThan(Date.now())
      expect(setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ coll: 'companionHandshakes', id: res.sessionId }),
        expect.objectContaining({
          creatorUid: 'test-user-123',
          token: 'dummy-google-id-token',
          status: 'available',
        })
      )
    })
  })

  describe('claimCompanionSession', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('claims available session, calls signInWithCredential, and deletes doc', async () => {
      const { getDoc, deleteDoc } = await import('firebase/firestore')
      const { signInWithCredential } = await import('firebase/auth')

      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'available',
          token: 'valid-token',
          expiresAt: { toMillis: () => Date.now() + 60000 },
        }),
      })

      const user = await claimCompanionSession('AB12-CD34')
      expect(user.uid).toBe('test-user-123')
      expect(signInWithCredential).toHaveBeenCalled()
      expect(deleteDoc).toHaveBeenCalled()
    })

    it('throws error if doc does not exist', async () => {
      const { getDoc } = await import('firebase/firestore')
      getDoc.mockResolvedValueOnce({
        exists: () => false,
      })

      await expect(claimCompanionSession('AB12-CD34')).rejects.toThrow('Pairing session not found')
    })

    it('throws error if code is expired', async () => {
      const { getDoc } = await import('firebase/firestore')
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'available',
          token: 'valid-token',
          expiresAt: { toMillis: () => Date.now() - 1000 },
        }),
      })

      await expect(claimCompanionSession('AB12-CD34')).rejects.toThrow('Pairing code has expired')
    })
  })

  describe('clearCompanionSession', () => {
    it('deletes the doc', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      await clearCompanionSession('AB12-CD34')
      expect(deleteDoc).toHaveBeenCalledWith(
        expect.objectContaining({ coll: 'companionHandshakes', id: 'AB12-CD34' })
      )
    })
  })
})
