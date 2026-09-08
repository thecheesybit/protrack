import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { subscribeToModes } from '@/services/modeService'
import { subscribeToUserDoc } from '@/services/userService'
import { subscribeVerifiedPatreons } from '@/services/patreonService'
import { syncRemoteLockConfig } from '@/services/lockService'
import {
  deriveUniqueCode,
  initSessionFromAccount,
  hasActivePinSession,
} from '@/services/cryptoService'

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
  const setLockConfigState = useStore((s) => s.setLockConfigState)
  const lockApp = useStore((s) => s.lockApp)

  // Last-seen REMOTE appLock enabled state. Auto-lock only on a genuine off→on
  // edge in this value (fresh device, or a lock enabled on another device) —
  // never on snapshot echoes and never right after a local disable. Seeded per
  // user from the current (localStorage-derived) state inside the effect.
  const prevRemoteLockEnabledRef = useRef(false)
  const hasInitializedLaunchScopeRef = useRef(false)

  useEffect(() => {
    if (!user) return undefined

    // Clear any previous sync error when starting new listeners
    setSyncError(null)

    // Launch default: always start in 'all' scope on application launch
    if (!hasInitializedLaunchScopeRef.current) {
      hasInitializedLaunchScopeRef.current = true
      setActiveModeId('all')
    }

    prevRemoteLockEnabledRef.current = Boolean(useStore.getState().lockConfig?.enabled)

    const unsubModes = subscribeToModes(
      user.uid,
      (modes) => {
        setModes(modes)
        const currentActive = useStore.getState().activeModeId
        if (modes.length > 0) {
          // 'all' is the special merged-scope pseudo-mode — always valid.
          const exists = currentActive === 'all' || modes.some((m) => m.id === currentActive)
          if (!currentActive || !exists) {
            setActiveModeId('all')
          }
        } else {
          if (currentActive !== 'all') {
            setActiveModeId('all')
          }
        }
      },
      (err) => setSyncError(err.message)
    )

    const unsubUser = subscribeToUserDoc(
      user.uid,
      (data) => {
        setUserDoc(data)
        // Note: launch scope defaults to 'all'; user can switch during active session.

        // Account-bound App Lock synchronization from Firestore.
        const hasAppLockField = Boolean(data?.settings && 'appLock' in data.settings)
        const remoteLock = hasAppLockField ? (data.settings.appLock ?? null) : null
        const remoteEnabled = Boolean(remoteLock?.enabled)
        // Rising-edge detection: only lock when the REMOTE lock transitions from
        // disabled→enabled. This is echo-proof and, crucially, disable-proof —
        // right after a local disable the remote is (or becomes) disabled, so no
        // edge fires and the workspace stays open.
        const wasRemoteEnabled = prevRemoteLockEnabledRef.current
        prevRemoteLockEnabledRef.current = remoteEnabled

        if (hasAppLockField) {
          syncRemoteLockConfig(remoteLock, (appliedConfig) => {
            if (appliedConfig?.enabled) {
              setLockConfigState(appliedConfig)
              if (!wasRemoteEnabled) lockApp()
            } else {
              setLockConfigState(null)
              if (!hasActivePinSession()) {
                const uniqueCode = data?.profile?.uniqueCode || deriveUniqueCode(user.uid)
                initSessionFromAccount(user.uid, uniqueCode, null)
              }
            }
          })
        } else if (!remoteEnabled && !hasActivePinSession()) {
          const uniqueCode = data?.profile?.uniqueCode || deriveUniqueCode(user.uid)
          initSessionFromAccount(user.uid, uniqueCode, null)
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
  }, [user, setModes, setActiveModeId, setUserDoc, setVerifiedPatreons, setSyncError, setLockConfigState, lockApp])

  return children
}
