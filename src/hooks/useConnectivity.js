import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'

/**
 * Watches online/offline transitions and surfaces sync state through the
 * Dynamic Island (one canonical notifier — no duplicate toasts, no emoji).
 * Writes still succeed offline (queued by Firestore persistence) and replay on
 * reconnect, so the offline banner is informational, never blocking.
 */
export function useConnectivity() {
  const wasOffline = useRef(false)
  const offlineEventId = useRef(null)

  useEffect(() => {
    const goOffline = () => {
      if (wasOffline.current) return
      wasOffline.current = true
      offlineEventId.current = useStore.getState().pushIsland({
        kind: 'sync-offline',
        title: 'You are offline',
        detail: 'Changes will sync when you reconnect.',
        sticky: true,
      })
    }
    const goOnline = () => {
      if (!wasOffline.current) return
      wasOffline.current = false
      const { dismissIsland, pushIsland } = useStore.getState()
      if (offlineEventId.current != null) dismissIsland(offlineEventId.current)
      offlineEventId.current = null
      pushIsland({
        kind: 'sync-online',
        title: 'Back online',
        detail: 'Syncing your changes.',
        duration: 2500,
      })
    }

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) goOffline()

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])
}
