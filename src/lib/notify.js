/** Thin wrapper over the Web Notifications API with graceful fallback and user toggle support. */
import { formatTime12h } from '@/services/alarmService'

export const DESKTOP_NOTIF_STORAGE_KEY = 'protrack:desktop_notifications'

function getNotificationCtor() {
  if (typeof window !== 'undefined' && window.Notification) return window.Notification
  if (typeof Notification !== 'undefined') return Notification
  return null
}

/** Check if Notification API exists in current environment. */
export function isNotificationSupported() {
  return getNotificationCtor() !== null
}

/** Check if browser notification permission has been granted. */
export function isNotificationPermissionGranted() {
  const Notif = getNotificationCtor()
  return Boolean(Notif && Notif.permission === 'granted')
}

/** Check if browser notification permission has been explicitly denied. */
export function isNotificationPermissionDenied() {
  const Notif = getNotificationCtor()
  return Boolean(Notif && Notif.permission === 'denied')
}

/**
 * Check if desktop notifications are actively enabled:
 * Requires both browser permission to be granted AND the user preference toggle to be ON.
 */
export function areNotificationsEnabled() {
  const Notif = getNotificationCtor()
  if (!Notif || Notif.permission !== 'granted') return false
  try {
    if (typeof localStorage !== 'undefined') {
      const pref = localStorage.getItem(DESKTOP_NOTIF_STORAGE_KEY)
      if (pref !== null) return pref === 'true'
    }
  } catch {}
  return true
}

/** Store the user's desktop notification toggle state. */
export function setDesktopNotificationsEnabled(enabled) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DESKTOP_NOTIF_STORAGE_KEY, enabled ? 'true' : 'false')
    }
  } catch {}
}

export async function ensureNotificationPermission() {
  const Notif = getNotificationCtor()
  if (!Notif) return false
  if (Notif.permission === 'granted') return true
  if (Notif.permission === 'denied') return false
  try {
    const result = await Notif.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

export function notify(title, body, options = {}) {
  try {
    if (!areNotificationsEnabled()) return null
    const NotifCtor = getNotificationCtor()
    if (NotifCtor && NotifCtor.permission === 'granted') {
      return new NotifCtor(title, {
        body,
        icon: '/logo.png',
        silent: false,
        ...options,
      })
    }
  } catch (err) {
    console.warn('[notify] failed', err)
  }
  return null
}

let activeAlarmNotification = null

export function closeActiveAlarmNotification() {
  if (activeAlarmNotification) {
    try {
      activeAlarmNotification.close()
    } catch {}
    activeAlarmNotification = null
  }
}

/**
 * Dispatches an interactive phone alarm OS notification.
 * Pinned with `requireInteraction: true` so it remains until the user interacts with it.
 * Clicking restores and focuses the app window so user can tap Turn Off.
 */
export function notifyAlarm(alarm, { onClick } = {}) {
  closeActiveAlarmNotification()

  try {
    if (!areNotificationsEnabled()) return null
    const NotifCtor = getNotificationCtor()
    if (NotifCtor && NotifCtor.permission === 'granted') {
      const { formatted } = formatTime12h(alarm?.time || '09:00')
      const label = alarm?.label ? `⏰ ${alarm.label}` : '⏰ Alarm Ringing!'
      const body = `Click to turn off alarm • ${formatted}`

      const notif = new NotifCtor(label, {
        body,
        icon: '/logo.png',
        tag: `protrack-alarm-${alarm?.id || Date.now()}`,
        renotify: true,
        requireInteraction: true,
        silent: false,
      })

      notif.onclick = () => {
        try {
          if (typeof window !== 'undefined') {
            window.focus?.()
            if (window.protrack?.window?.restore) {
              window.protrack.window.restore()
            }
          }
        } catch {}
        if (onClick) onClick()
        notif.close()
      }

      activeAlarmNotification = notif
      return notif
    }
  } catch (err) {
    console.warn('[notifyAlarm] failed', err)
  }
  return null
}

/** Sends a verified test alert to confirm desktop notifications are working. */
export function sendTestNotification() {
  return notify(
    'PRO TRACK Alert Test',
    'Desktop notifications are enabled and functioning perfectly!',
    { tag: 'protrack-test-notification' }
  )
}
