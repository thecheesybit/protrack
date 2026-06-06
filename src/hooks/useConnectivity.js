import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

/**
 * Watches online/offline transitions and surfaces an elegant, non-intrusive
 * toast. Writes still succeed offline (queued by Firestore persistence) and
 * replay on reconnect — no crash, no blocking spinner.
 */
export function useConnectivity() {
  const wasOffline = useRef(false)

  useEffect(() => {
    const goOffline = () => {
      wasOffline.current = true
      toast('You’re offline — changes will sync when you reconnect.', {
        id: 'connectivity',
        icon: '☁️',
        duration: Infinity,
      })
    }
    const goOnline = () => {
      if (!wasOffline.current) return
      wasOffline.current = false
      toast.success('Back online — syncing.', { id: 'connectivity', duration: 2500 })
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
