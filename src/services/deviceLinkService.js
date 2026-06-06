import { signInAnonymously, signInWithCustomToken } from 'firebase/auth'
import {
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from '@/lib/firebase'

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
 * Listen for the mobile to claim the handshake. When a custom token appears,
 * sign in as the real user and clean up the handshake doc.
 */
export function listenForClaim(sessionId, onClaimed, onError) {
  return onSnapshot(
    doc(db, 'desktopHandshakes', sessionId),
    async (snap) => {
      const data = snap.data()
      if (data?.status === 'claimed' && data?.token) {
        try {
          await signInWithCustomToken(auth, data.token)
          await deleteDoc(doc(db, 'desktopHandshakes', sessionId)).catch(() => {})
          onClaimed?.()
        } catch (err) {
          console.error('[link] custom-token sign-in failed', err)
          onError?.(err)
        }
      }
    },
    (err) => onError?.(err),
  )
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
 * Called from the authenticated web app (phone) to mint a single-use custom
 * token for THIS user and hand it to the waiting desktop via the Cloud Function.
 */
export async function claimDesktop(sessionId) {
  const mint = httpsCallable(functions, 'mintDesktopToken')
  const res = await mint({ sessionId })
  return res.data
}
