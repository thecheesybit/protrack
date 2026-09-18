import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  deleteUser,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase'
import { ensureUserDocument } from '@/services/userService'
import { signInWithGooglePopup, completePendingRedirect, friendlyAuthError } from '@/lib/authPopup'
import { isDesktop, isAndroid } from '@/desktop/isDesktop'
import { clearSessionCrypto } from '@/services/cryptoService'
import { clearAllSubscriptions } from '@/services/subscriptionCache'
import { useStore } from '@/store/useStore'

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
  const isSigningInRef = useRef(false)

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

    // If this load is returning from a signIn() redirect fallback, let Firebase
    // process it. Web/mobile only: the redirect fallback never runs in the
    // desktop shell (signIn passes allowRedirectFallback:false there), and
    // getRedirectResult eagerly spins up the Google auth iframe (apis.google.com)
    // — pointless overhead and an extra failure point during the desktop QR
    // handshake, which is pure REST. onAuthStateChanged handles the session
    // either way.
    if (!isDesktop) completePendingRedirect(auth)

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
    if (isSigningInRef.current) {
      console.warn('[auth] sign-in already in progress, ignoring duplicate tap')
      return
    }
    isSigningInRef.current = true
    setError(null)
    setLoading(true)
    setLoadingStatus('Connecting to Google…')

    try {
      if (isAndroid) {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
        // Clear previous/stale client session to avoid error 12502 and force the account chooser modal
        await FirebaseAuthentication.signOut().catch(() => {})

        setLoadingStatus('Opening Google account chooser…')
        const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })

        setLoadingStatus('Verifying account credentials…')
        const idToken = result?.credential?.idToken || result?.idToken
        if (idToken) {
          const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth')
          const credential = GoogleAuthProvider.credential(idToken, result?.credential?.accessToken)
          await signInWithCredential(auth, credential)
        } else if (result?.user) {
          const tokenRes = await FirebaseAuthentication.getIdToken().catch(() => null)
          if (tokenRes?.token) {
            const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth')
            const credential = GoogleAuthProvider.credential(tokenRes.token)
            await signInWithCredential(auth, credential)
          } else {
            throw new Error('Could not retrieve authentication token from Google Sign-In.')
          }
        } else {
          throw new Error('Google Sign-In returned no account credential.')
        }
        return
      }

      // Retries once against the popup/third-party-cookie failure class
      // (auth/internal-error and friends — common on real browsers since
      // Chrome's 2024+ cookie phase-out). Redirect fallback is allowed only
      // outside the desktop shell: Electron's main window blocks in-place
      // navigation to external URLs (main.js `will-navigate`), so a redirect
      // there would silently fail to leave the app and orphan the sign-in.
      await signInWithGooglePopup(auth, googleProvider, { allowRedirectFallback: !isDesktop })
    } catch (err) {
      const msg = err?.message || ''
      const code = err?.code || ''
      if (
        code === 'auth/popup-closed-by-user' ||
        code === '12501' ||
        msg.includes('canceled') ||
        msg.includes('cancelled') ||
        msg.includes('12501')
      ) {
        setLoading(false)
        return
      }
      console.error('[auth] sign-in failed', err)
      setError(friendlyAuthError(err))
      setLoading(false)
    } finally {
      isSigningInRef.current = false
    }
  }, [])

  const signOut = useCallback(async () => {
    clearSessionCrypto()

    // Tear down EVERY shared Firestore listener up front. The cache otherwise
    // holds them open for a 3s grace period, so `firebaseSignOut` below revokes
    // the token while they're still live — a burst of `permission-denied`
    // snapshot errors then fires during the routing transition, stalling
    // framer's AnimatePresence(mode="wait") exit and leaving a blank screen.
    try {
      clearAllSubscriptions()
    } catch {
      /* best-effort */
    }

    // Clear the workspace store BEFORE flipping the user to null so the exiting
    // Workspace gate falls back to the harmless AppLoader (settings === null).
    const store = useStore.getState()
    store.setUserDoc?.(null)
    store.setModes?.([])
    store.setSyncError?.(null) // don't carry a stale permission error into re-login
    store.unlockApp?.()
    store.setSettingsOpen?.(false)
    store.setSupportOpen?.(false)
    setUser(null)
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/')
    }
    if (isAndroid) {
      try {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
        await FirebaseAuthentication.signOut()
      } catch (e) {
        console.warn('[auth] native sign-out error:', e)
      }
    }
    if (isFirebaseConfigured) {
      try {
        await firebaseSignOut(auth)
      } catch (e) {
        console.warn('[auth] sign-out error:', e)
      }
    }

    // On the Android WebView a hard reload is the most reliable way to land on
    // the login screen: it discards any stalled transition and re-evaluates auth
    // from scratch (now with no persisted user), sidestepping both the blank
    // screen and the "still signed in after relaunch" persistence race we hit
    // when the renderer was killed mid-sign-out.
    if (isAndroid && typeof window !== 'undefined') {
      window.location.reload()
    }
  }, [])

  const deleteAccount = useCallback(async () => {
    if (!auth.currentUser) return
    try {
      clearSessionCrypto()
      await deleteUser(auth.currentUser)
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        throw new Error('Please sign out and sign back in to verify your identity before deleting your account.', { cause: err })
      }
      throw err
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      loadingStatus,
      error,
      signIn,
      signOut,
      deleteAccount,
      configured: isFirebaseConfigured,
    }),
    [user, loading, loadingStatus, error, signIn, signOut, deleteAccount]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
