import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { subscribeToModes } from '@/services/modeService'
import { subscribeToUserDoc, updateActiveMode } from '@/services/userService'
import { subscribeVerifiedPatreons } from '@/services/patreonService'

/**
 * Wires realtime Firestore listeners for the signed-in user into the Zustand
 * store. This is the single bridge between Firebase and app state — components
 * never touch onSnapshot directly.
 *
 * Resume logic: the saved settings.activeModeId always wins; if absent we fall
 * back to the first mode so the board is never empty.
 */
export function FirestoreSyncProvider({ children }) {
  const { user } = useAuth()
  const setModes = useStore((s) => s.setModes)
  const setActiveModeId = useStore((s) => s.setActiveModeId)
  const setUserDoc = useStore((s) => s.setUserDoc)
  const setVerifiedPatreons = useStore((s) => s.setVerifiedPatreons)
  const setSyncError = useStore((s) => s.setSyncError)

  useEffect(() => {
    if (!user) return undefined

    // Clear any previous sync error when starting new listeners
    setSyncError(null)

    const unsubModes = subscribeToModes(
      user.uid,
      (modes) => {
        setModes(modes)
        const currentActive = useStore.getState().activeModeId
        if (modes.length > 0) {
          // 'all' is the special merged-scope pseudo-mode — always valid.
          const exists = currentActive === 'all' || modes.some((m) => m.id === currentActive)
          if (!currentActive || !exists) {
            const fallbackId = modes[0].id
            setActiveModeId(fallbackId)
            updateActiveMode(user.uid, fallbackId).catch((err) =>
              console.error('[sync] failed to set active mode fallback', err),
            )
          }
        }
      },
      (err) => setSyncError(err.message)
    )

    const unsubUser = subscribeToUserDoc(
      user.uid,
      (data) => {
        setUserDoc(data)
        const saved = data?.settings?.activeModeId
        if (saved) {
          const currentModes = useStore.getState().modes
          // 'all' is the merged-scope pseudo-mode — accept it verbatim.
          if (saved === 'all') {
            setActiveModeId('all')
          } else if (currentModes.length > 0) {
            if (currentModes.some((m) => m.id === saved)) {
              setActiveModeId(saved)
            } else {
              const fallbackId = currentModes[0].id
              setActiveModeId(fallbackId)
              updateActiveMode(user.uid, fallbackId).catch((err) =>
                console.error('[sync] failed to fallback active mode', err),
              )
            }
          } else {
            setActiveModeId(saved)
          }
        }
      },
      (err) => setSyncError(err.message)
    )

    // Single app-wide, cache-first listener for the public wall of honor.
    const unsubPatreons = subscribeVerifiedPatreons(setVerifiedPatreons)

    return () => {
      unsubModes()
      unsubUser()
      unsubPatreons()
    }
  }, [user, setModes, setActiveModeId, setUserDoc, setVerifiedPatreons, setSyncError])

  return children
}
