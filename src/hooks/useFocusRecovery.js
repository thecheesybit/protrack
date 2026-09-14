import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { readFocusSnapshot, clearFocusSnapshot } from '@/lib/focusPersistence'

/**
 * Mounted once (in Dashboard), alongside useFocusEngine. On boot, checks for
 * a Deep Focus snapshot left behind by a crash, force-close, or auto-update —
 * see lib/focusPersistence.js for how it's written.
 *
 * Deliberately does NOT restore live `status`/`session` state itself (that
 * would silently resume a countdown across however long the app was actually
 * closed, which isn't real focus time). Instead it stores the raw snapshot as
 * `resumableSession` and raises a prompt so the user decides — Resume picks
 * up exactly where it left off (paused, ready to press play), Discard logs it
 * as an abandoned session. The same `resumableSession` is what lets clicking
 * the matching calendar slot/todo resume it too (see FocusPanel,
 * TimeContextPanel, TodosWidget).
 */
export function useFocusRecovery() {
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const snapshot = readFocusSnapshot()
    if (!snapshot || snapshot.status === 'idle' || !snapshot.session) {
      if (snapshot) clearFocusSnapshot() // stale/empty — nothing worth recovering
      return
    }

    useStore.getState().setResumableSession(snapshot)
    useStore.getState().pushPrompt({
      type: 'focus-resume',
      payload: snapshot,
    })
  }, [])
}
