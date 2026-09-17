import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  compareSemver,
  isQuietUpdateError,
  checkForAndroidUpdate,
} from '../androidUpdateService'

describe('androidUpdateService', () => {
  describe('compareSemver', () => {
    it('detects newer minor and patch versions', () => {
      expect(compareSemver('2.14.0', '2.13.1')).toBe(1)
      expect(compareSemver('2.13.2', '2.13.1')).toBe(1)
      expect(compareSemver('v3.0.0', '2.13.1')).toBe(1)
    })

    it('detects older or equal versions', () => {
      expect(compareSemver('2.13.1', '2.13.1')).toBe(0)
      expect(compareSemver('v2.13.1', '2.13.1')).toBe(0)
      expect(compareSemver('2.13.0', '2.13.1')).toBe(-1)
      expect(compareSemver('2.12.9', '2.13.1')).toBe(-1)
    })
  })

  describe('isQuietUpdateError', () => {
    it('returns true for 404, rate limit, and network failures', () => {
      expect(isQuietUpdateError(new Error('HTTP 404 Not Found'))).toBe(true)
      expect(isQuietUpdateError(new Error('API rate limit exceeded'))).toBe(true)
      expect(isQuietUpdateError(new Error('Failed to fetch'))).toBe(true)
      expect(isQuietUpdateError(new Error('Network offline'))).toBe(true)
    })

    it('returns false for unexpected system errors', () => {
      expect(isQuietUpdateError(new Error('JSON parse syntax error at token <'))).toBe(false)
    })
  })

  describe('checkForAndroidUpdate', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
      globalThis.fetch = vi.fn()
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('returns available: true when a newer version with .apk exists', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tag_name: 'v2.99.0',
          assets: [
            {
              name: 'PRO-TRACK-Setup-2.99.0.exe',
              browser_download_url: 'https://example.com/desktop.exe',
            },
            {
              name: 'app-release.apk',
              browser_download_url: 'https://example.com/app-release.apk',
              size: 15000000,
            },
          ],
          body: 'New release notes',
        }),
      })

      const res = await checkForAndroidUpdate()
      expect(res.available).toBe(true)
      expect(res.latestVersion).toBe('2.99.0')
      expect(res.downloadUrl).toBe('https://example.com/app-release.apk')
    })

    it('returns available: false when version is older or same', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tag_name: 'v2.1.0',
          assets: [{ name: 'app-release.apk' }],
        }),
      })

      const res = await checkForAndroidUpdate()
      expect(res.available).toBe(false)
    })

    it('handles 404 quietly without throwing', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const res = await checkForAndroidUpdate()
      expect(res.available).toBe(false)
      expect(res.error).toBeNull()
    })
  })
})
