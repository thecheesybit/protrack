import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { notify } from '@/lib/notify'

/**
 * Fires a gentle "stay hydrated" nudge on the user's chosen interval
 * (Settings → Stay hydrated). Mounted once in the Dashboard.
 */
export function HydrationReminder() {
  const interval = useStore((s) => s.settings?.hydrationIntervalMin) || 60

  useEffect(() => {
    if (!interval) return undefined
    const id = setInterval(
      () => {
        toast('Time to hydrate — take a sip of water', { icon: '💧', duration: 8000 })
        notify('Stay hydrated 💧', 'Time for a glass of water.')
      },
      interval * 60 * 1000,
    )
    return () => clearInterval(id)
  }, [interval])

  return null
}
