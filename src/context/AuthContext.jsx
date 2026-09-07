import { createContext, useCallback, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  deleteUser,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase'
import { ensureUserDocument } from '@/services/userService'
import { signInWithGooglePopup, completePendingRedirect, friendlyAuthError } from '@/lib/authPopup'
import { isDesktop } from '@/desktop/isDesktop'

function withTimeout(promise, ms, errorMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage))
    }, ms)

    promise
      .then((res) => {
        clearTimeout(timer)
        resolve(res)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('Checking authentication…')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    // Hard timeout: if Firebase Auth can't reach the identitytoolkit
    // endpoint (network blip, cold-start, blocked domain), `onAuthStateChanged`
    // never fires and the boot loader would spin forever. After 6s we force
    // loading=false so the QR / sign-in screen appears and the user can act.
    const fallbackTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[auth] timeout — proceeding to sign-in screen')
          setError('Network is slow — taking a moment to load.')
        }
        return false
      })
    }, 6000)

    // Slow connection warning: update loadingStatus after 3 seconds
    const slowConnectionTimer = setTimeout(() => {
      setLoadingStatus('Network is slow — verifying connection…')
    }, 3000)

    // If this load is returning from a signIn() redirect fallback (web/mobile
    // only — see signIn below), let Firebase process it. Either way,
    // onAuthStateChanged below picks up the resulting session on its own —
    // this call exists only to consume the pending redirect state.
    completePendingRedirect(auth)

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      let profileSlowTimer = null
      try {
        // Anonymous users are only the desktop QR-handshake bootstrap — never
        // seed a profile/modes for them.
        if (firebaseUser && !firebaseUser.isAnonymous) {
          setLoading(true)
          setLoadingStatus('Verifying user profile…')
          setError(null)

          profileSlowTimer = setTimeout(() => {
            setLoadingStatus('Network is slow — opening workspace from cache…')
          }, 3500)

          try {
            await withTimeout(
              ensureUserDocument(firebaseUser),
              12000,
              'Profile verification timed out — workspace loaded from cache.'
            )
          } catch (profileErr) {
            // Firestore slowness / offline: the auth token is still valid.
            // Log a non-fatal warning and open the workspace anyway — the
            // persistent Firestore cache will serve data, and any queued
            // writes replay on reconnect. Never sign the user out for this.
            console.warn('[auth] profile init non-fatal:', profileErr.message)
            setError(null) // clear any stale error; workspace opens normally
          }
        }
        setUser(firebaseUser)
      } catch (err) {
        // Only reach here on a genuine Firebase Auth failure (e.g. token
        // revoked, network entirely unreachable before onAuthStateChanged fires).
        // In this case we can't authenticate at all, so sign out cleanly.
        console.error('[auth] critical auth failure', err)
        setError(err.message)
        setUser(null)
      } finally {
        if (profileSlowTimer) clearTimeout(profileSlowTimer)
        clearTimeout(fallbackTimer)
        clearTimeout(slowConnectionTimer)
        setLoading(false)
      }
    })
    return () => {
      clearTimeout(fallbackTimer)
      clearTimeout(slowConnectionTimer)
      unsubscribe()
    }
  }, [])

  const signIn = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured for this build.')
      return
    }
    setError(null)
    try {
      // Retries once against the popup/third-party-cookie failure class
      // (auth/internal-error and friends — common on real browsers since
      // Chrome's 2024+ cookie phase-out). Redirect fallback is allowed only
      // outside the desktop shell: Electron's main window blocks in-place
      // navigation to external URLs (main.js `will-navigate`), so a redirect
      // there would silently fail to leave the app and orphan the sign-in.
      await signInWithGooglePopup(auth, googleProvider, { allowRedirectFallback: !isDesktop })
    } catch (err) {
      // Ignore the benign "user closed the popup" case.
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('[auth] sign-in failed', err)
        setError(friendlyAuthError(err))
      }
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!isFirebaseConfigured) return
    await firebaseSignOut(auth)
  }, [])

  const deleteAccount = useCallback(async () => {
    if (!auth.currentUser) return
    try {
      await deleteUser(auth.currentUser)
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        throw new Error('Please sign out and sign back in to verify your identity before deleting your account.')
      }
      throw err
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loadingStatus,
        error,
        signIn,
        signOut,
        deleteAccount,
        configured: isFirebaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
