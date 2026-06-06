import {
  signInAnonymously,
  signInWithCustomToken,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { auth, db, googleProvider } from '@/lib/firebase'

const HANDSHAKE_TTL_MS = 2 * 60 * 1000 // QR valid for 2 minutes

/** Cryptographically-random, unguessable session id (acts as a bearer secret). */
function randomSessionId() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/* ── Desktop side ───────────────────────────────────────── */

/**
 * Bootstrap a handshake from the desktop: sign in anonymously (so Firestore
 * access is authenticated), create a pending handshake doc, return its id.
 */
export async function createHandshake() {
  if (!auth.currentUser) await signInAnonymously(auth)
  const desktopUid = auth.currentUser.uid
  const sessionId = randomSessionId()
  await setDoc(doc(db, 'desktopHandshakes', sessionId), {
    desktopUid,
    status: 'pending',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + HANDSHAKE_TTL_MS),
  })
  return { sessionId, desktopUid }
}

/**
 * Listen for the mobile to claim the handshake. When a custom token or Google ID token appears,
 * sign in as the real user and clean up the handshake doc.
 */
export function listenForClaim(sessionId, onClaimed, onError) {
  let active = true
  const unsub = onSnapshot(
    doc(db, 'desktopHandshakes', sessionId),
    async (snap) => {
      const data = snap.data()
      if (data?.status === 'claimed' && data?.token) {
        if (!active) return
        active = false
        unsub()
        try {
          if (data.tokenType === 'google') {
            const credential = GoogleAuthProvider.credential(data.token)
            await signInWithCredential(auth, credential)
          } else {
            await signInWithCustomToken(auth, data.token)
          }
          await deleteDoc(doc(db, 'desktopHandshakes', sessionId)).catch(() => {})
          onClaimed?.()
        } catch (err) {
          console.error('[link] sign-in failed', err)
          onError?.(err)
        }
      }
    },
    (err) => {
      if (active) onError?.(err)
    },
  )
  return () => {
    active = false
    unsub()
  }
}

export async function clearHandshake(sessionId) {
  try {
    await deleteDoc(doc(db, 'desktopHandshakes', sessionId))
  } catch {
    /* already gone */
  }
}

/* ── Mobile side ────────────────────────────────────────── */

/**
 * Called from the authenticated web app (phone) to obtain the user's Google ID token
 * via a popup, and write it onto the pending handshake doc so the waiting desktop
 * can sign in directly. Bypasses the need for Cloud Functions.
 */
export async function claimDesktop(sessionId) {
  const res = await signInWithPopup(auth, googleProvider)
  const credential = GoogleAuthProvider.credentialFromResult(res)
  const idToken = credential?.idToken
  if (!idToken) throw new Error('Could not retrieve Google ID token')

  const ref = doc(db, 'desktopHandshakes', sessionId)
  await updateDoc(ref, {
    status: 'claimed',
    token: idToken,
    tokenType: 'google',
    claimedBy: auth.currentUser.uid,
    claimedAt: serverTimestamp(),
  })
}
