/** Thin wrapper over the Web Notifications API with graceful fallback. */
import { formatTime12h } from '@/services/alarmService'

export async function ensureNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

export function notify(title, body, options = {}) {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      return new Notification(title, {
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
    const NotifCtor = (typeof window !== 'undefined' && window.Notification) || (typeof Notification !== 'undefined' && Notification)
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
          window.focus()
          if (typeof window !== 'undefined' && window.protrack?.window?.restore) {
            window.protrack.window.restore()
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
