import {
  signInAnonymously,
  signInWithCustomToken,
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
import { signInWithGooglePopup, completePendingRedirect } from '@/lib/authPopup'

const HANDSHAKE_TTL_MS = 2 * 60 * 1000 // QR valid for 2 minutes

// Bridges a claim across a signInWithGooglePopup redirect fallback: the browser
// navigates away to Google and back, so the in-memory call stack of confirm()
// is gone — this is how resumePendingClaim() (called on the next page load)
// knows which handshake to finish.
const PENDING_CLAIM_KEY = 'protrack:link:pendingClaim'

function requireAuth() {
  if (!auth || !db) {
    throw new Error(
      'Firebase is not configured for this build. Add VITE_FIREBASE_* env vars and rebuild.',
    )
  }
}

/**
 * Short, typeable session id — 8 base32 chars (Crockford alphabet, no
 * ambiguous I/L/O/U). Looks like "K4F7-X9MQ". 32^8 ≈ 1.1e12 combinations;
 * combined with the 2-minute TTL and Firebase rate-limiting that's plenty
 * for a single-use handshake bearer secret.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
function randomSessionId() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`
}

/* ── Desktop side ───────────────────────────────────────── */

/**
 * Bootstrap a handshake from the desktop: sign in anonymously (so Firestore
 * access is authenticated), create a pending handshake doc, return its id.
 */
export async function createHandshake() {
  requireAuth()
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
export function listenForClaim(sessionId, onClaimed, onError, onClaimStart) {
  requireAuth()
  let active = true
  const unsub = onSnapshot(
    doc(db, 'desktopHandshakes', sessionId),
    async (snap) => {
      const data = snap.data()
      if (data?.status === 'claimed' && data?.token) {
        if (!active) return
        active = false
        unsub()
        onClaimStart?.()
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
  if (!db) return
  try {
    await deleteDoc(doc(db, 'desktopHandshakes', sessionId))
  } catch {
    /* already gone */
  }
}

/* ── Mobile side ────────────────────────────────────────── */

/** Write the claimed Google ID token onto the pending handshake doc. */
async function writeClaimToken(sessionId, userCredential) {
  const credential = GoogleAuthProvider.credentialFromResult(userCredential)
  const idToken = credential?.idToken
  if (!idToken) throw new Error('Could not retrieve Google ID token')

  const ref = doc(db, 'desktopHandshakes', sessionId)
  await updateDoc(ref, {
    status: 'claimed',
    token: idToken,
    tokenType: 'google',
    claimedBy: userCredential.user.uid,
    claimedAt: serverTimestamp(),
  })
}

/**
 * Called from the authenticated web app (phone/browser) to obtain the user's
 * Google ID token via a popup, and write it onto the pending handshake doc so
 * the waiting desktop can sign in directly. Bypasses the need for Cloud
 * Functions.
 *
 * `signInWithPopup` can fail with `auth/internal-error` on browsers blocking
 * third-party cookies / enforcing FedCM (a real, common Chrome+Firebase
 * interaction, unrelated to this app) — `signInWithGooglePopup` retries once,
 * then falls back to a full-page redirect. On redirect this function returns
 * `false` and the page navigates away; `resumePendingClaim()` finishes the
 * claim when the browser returns.
 *
 * @returns {Promise<boolean>} true once the handshake doc is written; false if
 *   it fell back to a redirect (caller should not update UI state further —
 *   the page is about to unload).
 */
export async function claimDesktop(sessionId) {
  requireAuth()
  try {
    sessionStorage.setItem(PENDING_CLAIM_KEY, sessionId)
  } catch {
    /* private mode — the redirect fallback just won't be resumable */
  }
  const result = await signInWithGooglePopup(auth, googleProvider, { allowRedirectFallback: true })
  if (!result) return false // redirecting away
  try {
    sessionStorage.removeItem(PENDING_CLAIM_KEY)
  } catch {
    /* private mode */
  }
  await writeClaimToken(sessionId, result)
  return true
}

/**
 * Call once when a page that can call `claimDesktop` mounts, to finish a claim
 * that fell back to `signInWithRedirect` on the previous load. Resolves to the
 * completed sessionId, or null if this load isn't such a return (the common
 * case) or there was no pending claim to resume.
 */
export async function resumePendingClaim() {
  let pendingSessionId
  try {
    pendingSessionId = sessionStorage.getItem(PENDING_CLAIM_KEY)
  } catch {
    pendingSessionId = null
  }
  if (!pendingSessionId) return null
  requireAuth()
  const result = await completePendingRedirect(auth)
  if (!result) return null // not actually returning from a redirect
  try {
    sessionStorage.removeItem(PENDING_CLAIM_KEY)
  } catch {
    /* private mode */
  }
  await writeClaimToken(pendingSessionId, result)
  return pendingSessionId
}
