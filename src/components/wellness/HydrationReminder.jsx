import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { notify } from '@/lib/notify'

/**
 * Fires a gentle "stay hydrated" nudge on the user's chosen interval
 * (Settings → Stay hydrated), surfaced through the Dynamic Island plus a native
 * OS notification (so it lands even when minimized). Mounted once in the
 * Dashboard. No emoji — Lucide iconography via the Island.
 */
export function HydrationReminder() {
  const interval = useStore((s) => s.settings?.hydrationIntervalMin) || 60

  useEffect(() => {
    if (!interval) return undefined
    const id = setInterval(
      () => {
        useStore.getState().pushIsland({
          kind: 'water',
          title: 'Time to hydrate',
          detail: 'Take a sip of water.',
          duration: 7000,
        })
        notify('Stay hydrated', 'Time for a glass of water.')
      },
      interval * 60 * 1000,
    )
    return () => clearInterval(id)
  }, [interval])

  return null
}
