import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { subscribeToModes } from '@/services/modeService'
import { subscribeToUserDoc } from '@/services/userService'

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

  useEffect(() => {
    if (!user) return undefined

    const unsubModes = subscribeToModes(user.uid, (modes) => {
      setModes(modes)
      if (!useStore.getState().activeModeId && modes.length) {
        setActiveModeId(modes[0].id)
      }
    })

    const unsubUser = subscribeToUserDoc(user.uid, (data) => {
      setUserDoc(data)
      const saved = data?.settings?.activeModeId
      if (saved) setActiveModeId(saved)
    })

    return () => {
      unsubModes()
      unsubUser()
    }
  }, [user, setModes, setActiveModeId, setUserDoc])

  return children
}
