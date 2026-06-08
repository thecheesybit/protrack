/** Thin wrapper over the Web Notifications API with graceful fallback. */
export async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function notify(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/logo.png', silent: false })
    }
  } catch (err) {
    console.warn('[notify] failed', err)
  }
}
