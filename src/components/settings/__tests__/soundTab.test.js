import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  areNotificationsEnabled,
  setDesktopNotificationsEnabled,
  notify,
  ensureNotificationPermission,
  sendTestNotification,
  DESKTOP_NOTIF_STORAGE_KEY,
} from '@/lib/notify'

describe('Desktop Notification Toggle & Service Logic', () => {
  let store = {}
  let originalNotification
  let mockCtor

  beforeEach(() => {
    store = {}
    originalNotification = global.Notification

    // Mock localStorage
    global.localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = String(v) },
      removeItem: (k) => { delete store[k] },
      clear: () => { store = {} },
    }

    mockCtor = vi.fn(function MockNotification(title, options) {
      this.title = title
      this.options = options
      this.close = vi.fn()
    })
    mockCtor.permission = 'granted'
    mockCtor.requestPermission = vi.fn(() => Promise.resolve('granted'))

    global.Notification = mockCtor
    if (typeof window !== 'undefined') {
      window.Notification = mockCtor
    }
  })

  afterEach(() => {
    global.Notification = originalNotification
    if (typeof window !== 'undefined') {
      delete window.Notification
    }
    store = {}
    vi.restoreAllMocks()
  })

  it('reports enabled when permission is granted and toggle has not been set to false', () => {
    expect(areNotificationsEnabled()).toBe(true)
  })

  it('can toggle desktop notifications OFF via setDesktopNotificationsEnabled(false)', () => {
    setDesktopNotificationsEnabled(false)
    expect(localStorage.getItem(DESKTOP_NOTIF_STORAGE_KEY)).toBe('false')
    expect(areNotificationsEnabled()).toBe(false)
  })

  it('suppresses notify() when user toggled notifications OFF', () => {
    setDesktopNotificationsEnabled(false)
    const result = notify('Study Alert', 'Time to focus')
    expect(result).toBeNull()
    expect(mockCtor).not.toHaveBeenCalled()
  })

  it('fires Notification when notifications are toggled ON', () => {
    setDesktopNotificationsEnabled(true)
    const notif = notify('Study Alert', 'Time to focus')
    expect(notif).not.toBeNull()
    expect(mockCtor).toHaveBeenCalledWith('Study Alert', expect.objectContaining({
      body: 'Time to focus',
      icon: '/logo.png',
    }))
  })

  it('reports false when browser permission is denied even if toggle is true', () => {
    setDesktopNotificationsEnabled(true)
    mockCtor.permission = 'denied'
    expect(areNotificationsEnabled()).toBe(false)
  })

  it('sendTestNotification dispatches test alert when enabled', () => {
    setDesktopNotificationsEnabled(true)
    const result = sendTestNotification()
    expect(result).not.toBeNull()
    expect(mockCtor).toHaveBeenCalledWith('PRO TRACK Alert Test', expect.anything())
  })

  it('respects category preferences: hydration is muted by default', async () => {
    const { isNotificationCategoryEnabled } = await import('@/lib/notify')
    setDesktopNotificationsEnabled(true)
    expect(isNotificationCategoryEnabled('hydration')).toBe(false)
    const result = notify('Water', 'Drink water', { category: 'hydration' })
    expect(result).toBeNull()
  })

  it('allows category notification when category is enabled', async () => {
    const { setNotificationCategoryEnabled } = await import('@/lib/notify')
    setDesktopNotificationsEnabled(true)
    setNotificationCategoryEnabled('hydration', true)
    const result = notify('Water', 'Drink water', { category: 'hydration' })
    expect(result).not.toBeNull()
    expect(mockCtor).toHaveBeenCalledWith('Water', expect.objectContaining({ body: 'Drink water' }))
  })

  it('suppresses category notification when category is explicitly disabled', async () => {
    const { setNotificationCategoryEnabled } = await import('@/lib/notify')
    setDesktopNotificationsEnabled(true)
    setNotificationCategoryEnabled('focus', false)
    const result = notify('Focus done', 'Great job', { category: 'focus' })
    expect(result).toBeNull()
  })
})
