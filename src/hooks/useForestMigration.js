import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { simplifyForestOnce } from '@/services/focusService'

/**
 * One-time client-side migration hook for Goal B ("Forest Simplifier").
 *
 * Checks if the user's legacy focus sessions (>25 min) need to be normalized
 * to the 25-minute tree standard (one tree per 25-min block + capped remainder).
 *
 * Guarded by `settings.forestSimplifiedV1 === true`.
 * Mounted once in Dashboard.jsx alongside other startup hooks.
 * Never runs during an active or locked focus session.
 */
export function useForestMigration() {
  const { user } = useAuth()
  const settings = useStore((s) => s.settings)
  const status = useStore((s) => s.status)
  const focusLocked = useStore((s) => s.focusLocked)
  const hasRunRef = useRef(false)

  useEffect(() => {
    const uid = user?.uid
    if (!uid) return
    if (!settings) return // wait until settings have loaded from Firestore
    if (settings.forestSimplifiedV1 === true) return // already migrated
    if (status === 'running' || focusLocked) return // never run during active focus
    if (hasRunRef.current) return

    hasRunRef.current = true

    ;(async () => {
      try {
        const result = await simplifyForestOnce(uid)
        if (result?.convertedCount > 0) {
          console.info(
            `[forestMigration] Simplified ${result.convertedCount} legacy focus sessions into ${result.createdCount} standard plantings.`,
          )
        }
      } catch (err) {
        console.warn('[forestMigration] Forest simplification encountered an error (will retry next launch):', err)
        hasRunRef.current = false
      }
    })()
  }, [user?.uid, settings, status, focusLocked])
}
