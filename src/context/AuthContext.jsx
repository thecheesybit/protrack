import { createContext, useCallback, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase'
import { ensureUserDocument } from '@/services/userService'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        // Anonymous users are only the desktop QR-handshake bootstrap — never
        // seed a profile/modes for them.
        if (firebaseUser && !firebaseUser.isAnonymous) {
          await ensureUserDocument(firebaseUser)
        }
        setUser(firebaseUser)
      } catch (err) {
        console.error('[auth] failed to initialise user document', err)
        setError(err.message)
        setUser(firebaseUser)
      } finally {
        setLoading(false)
      }
    })
    return unsubscribe
  }, [])

  const signIn = useCallback(async () => {
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
    await firebaseSignOut(auth)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
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
