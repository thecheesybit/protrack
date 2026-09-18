import {
  signInWithCredential,
  GoogleAuthProvider,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { auth, db, googleProvider } from '@/lib/firebase'
import { signInWithGooglePopup } from '@/lib/authPopup'

export const COMPANION_TTL_MS = 2 * 60 * 1000 // 2 minutes

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function requireAuth() {
  if (!auth || !db) {
    throw new Error(
      'Firebase is not configured for this build. Add VITE_FIREBASE_* env vars and rebuild.',
    )
  }
}

/**
 * Generate an unguessable Crockford base32 8-char session ID,
 * grouped as "XXXX-XXXX".
 */
export function generateCompanionSessionId() {
  const bytes = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`
}

/**
 * Build the pairing URL encoded into the companion QR code.
 * Scanned by a phone/camera with no app: opens the Netlify gateway download/fallback page.
 * Scanned by the installed app: intercepted by custom scheme or deep link.
 */
export function buildCompanionQrUrl(sessionId) {
  const webUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_WEB_URL
      ? import.meta.env.VITE_WEB_URL
      : 'https://pro-track-app.netlify.app'
  return `${webUrl}/pair?s=${encodeURIComponent(sessionId)}#pair=${encodeURIComponent(sessionId)}`
}

/**
 * Normalizes user input or scanner output to an 8-character Crockford base32 string.
 * Extracts `s=` query param, `#pair=` hash param, custom scheme `protrack://pair?s=`,
 * or a raw typed code like "k4f7-x9mq".
 */
export function extractSessionId(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return ''
  const trimmed = rawInput.trim()

  // 1. Try URL parsing if it looks like a URL
  if (trimmed.includes('://') || trimmed.startsWith('/') || trimmed.includes('?')) {
    try {
      const url = new URL(trimmed, 'https://dummy.local')
      const sParam = url.searchParams.get('s') || url.searchParams.get('code')
      if (sParam) return normalizeCode(sParam)

      if (url.hash && url.hash.includes('pair=')) {
        const hashMatch = url.hash.match(/pair=([A-Za-z0-9-]+)/)
        if (hashMatch?.[1]) return normalizeCode(hashMatch[1])
      }
    } catch {
      /* fallback to regex extraction */
    }
  }

  // 2. Regex fallback: search for XXXX-XXXX or 8-char base32 sequence
  const matchWithHyphen = trimmed.match(/([0-9A-HJ-NP-Za-hj-np-z]{4})-([0-9A-HJ-NP-Za-hj-np-z]{4})/)
  if (matchWithHyphen) {
    return `${matchWithHyphen[1].toUpperCase()}-${matchWithHyphen[2].toUpperCase()}`
  }

  const cleanChars = trimmed.toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (cleanChars.length === 8) {
    return `${cleanChars.slice(0, 4)}-${cleanChars.slice(4, 8)}`
  }

  return normalizeCode(trimmed)
}

function normalizeCode(code) {
  const upper = code.toUpperCase().trim()
  if (upper.length === 8 && !upper.includes('-')) {
    return `${upper.slice(0, 4)}-${upper.slice(4, 8)}`
  }
  return upper
}

/**
 * Desktop side: creates a short-lived companion handshake document in Firestore
 * carrying the signed-in user's single-use Google ID token. A companion device
 * then claims it with that Google credential.
 *
 * This is a Google-only handshake by design: the tablet build signs in directly
 * with Google (no anonymous bootstrap), so a Google ID token is always required.
 */
export async function createCompanionSession(idToken) {
  requireAuth()
  if (!auth.currentUser) {
    throw new Error('Must be signed in to link a companion tablet.')
  }
  if (!idToken) {
    throw new Error('A Google ID token is required to create a companion session.')
  }

  const sessionId = generateCompanionSessionId()
  const expiresAtMs = Date.now() + COMPANION_TTL_MS

  await setDoc(doc(db, 'companionHandshakes', sessionId), {
    creatorUid: auth.currentUser.uid,
    token: idToken,
    tokenType: 'google',
    status: 'available',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(expiresAtMs),
  })

  return {
    sessionId,
    expiresAtMs,
  }
}

/**
 * Tablet side: listens for the browser/desktop to claim this session.
 * When claimed with Google ID token, signs in with credential and cleans up.
 */
export function listenForCompanionClaim(sessionId, onClaimed, onError, onClaimStart) {
  requireAuth()
  let active = true
  const unsub = onSnapshot(
    doc(db, 'companionHandshakes', sessionId),
    async (snap) => {
      const data = snap.data()
      if (data?.status === 'claimed' && data?.token) {
        if (!active) return
        active = false
        unsub()
        onClaimStart?.()
        try {
          const credential = GoogleAuthProvider.credential(data.token)
          const userCred = await signInWithCredential(auth, credential)
          await deleteDoc(doc(db, 'companionHandshakes', sessionId)).catch(() => {})
          onClaimed?.(userCred.user)
        } catch (err) {
          console.error('[companion] claim sign-in failed', err)
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

/**
 * Browser side: write the claimed Google ID token onto the pending companion handshake doc.
 */
export async function writeCompanionClaimToken(sessionId, userCredential) {
  requireAuth()
  const credential = GoogleAuthProvider.credentialFromResult(userCredential)
  const idToken = credential?.idToken
  if (!idToken) throw new Error('Could not retrieve Google ID token')

  const ref = doc(db, 'companionHandshakes', sessionId)
  await updateDoc(ref, {
    status: 'claimed',
    token: idToken,
    tokenType: 'google',
    claimedBy: userCredential.user.uid,
    claimedAt: serverTimestamp(),
  })
}

/**
 * Browser / Web gateway helper: signs in with Google in a real browser,
 * then writes the claim token to the pending companion handshake doc.
 */
export async function claimCompanionInBrowser(sessionId) {
  requireAuth()
  const result = await signInWithGooglePopup(auth, googleProvider, { allowRedirectFallback: true })
  if (!result) return false // redirecting away
  await writeCompanionClaimToken(sessionId, result)
  return true
}

/**
 * Cleanup a companion session doc on component unmount or expiration.
 */
export async function clearCompanionSession(sessionId) {
  if (!db || !sessionId) return
  try {
    await deleteDoc(doc(db, 'companionHandshakes', sessionId))
  } catch {
    /* already gone */
  }
}

/**
 * Direct claim for pre-minted session docs (backward-compatibility).
 */
export async function claimCompanionSession(rawSessionId) {
  requireAuth()
  const sessionId = extractSessionId(rawSessionId)
  if (!sessionId) {
    throw new Error('Invalid pairing code.')
  }

  const docRef = doc(db, 'companionHandshakes', sessionId)
  const snapshot = await getDoc(docRef)

  if (!snapshot.exists()) {
    throw new Error('Pairing session not found or already used. Please generate a new code on your desktop.')
  }

  const data = snapshot.data()
  if (data?.status !== 'available' || !data?.token) {
    throw new Error('Pairing code is invalid or has already been claimed.')
  }

  // Check TTL
  const expiresAtMillis = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : 0
  if (expiresAtMillis && Date.now() > expiresAtMillis) {
    await deleteDoc(docRef).catch(() => {})
    throw new Error('Pairing code has expired. Please refresh the QR code on your desktop.')
  }

  // Authenticate using the relayed Google ID token
  const credential = GoogleAuthProvider.credential(data.token)
  const userCredential = await signInWithCredential(auth, credential)

  // Single-use: delete immediately upon successful claim
  await deleteDoc(docRef).catch(() => {})

  return userCredential.user
}

