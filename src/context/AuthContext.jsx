import { createContext, useCallback, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase'
import { ensureUserDocument } from '@/services/userService'

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
            setLoadingStatus('Still verifying profile — Firestore is responding slowly…')
          }, 3500)

          await withTimeout(
            ensureUserDocument(firebaseUser),
            12000,
            'Profile verification timed out. Please check your internet connection and reload.'
          )
        }
        setUser(firebaseUser)
      } catch (err) {
        console.error('[auth] failed to initialise user document', err)
        setError(err.message)
        if (firebaseUser && !firebaseUser.isAnonymous) {
          try {
            await firebaseSignOut(auth)
          } catch (signoutErr) {
            console.error('[auth] failed to sign out after init failure', signoutErr)
          }
        }
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
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      // Ignore the benign "user closed the popup" case.
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('[auth] sign-in failed', err)
        setError(err.message)
      }
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!isFirebaseConfigured) return
    await firebaseSignOut(auth)
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
        configured: isFirebaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
