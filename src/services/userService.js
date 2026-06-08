import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DEFAULT_MODES } from '@/lib/constants'

/**
 * Create the user's root document + settings + seeded default modes on first
 * login, inside a transaction so two devices logging in simultaneously can't
 * double-seed. Idempotent — a no-op if the document already exists.
 */
export async function ensureUserDocument(firebaseUser) {
  const userRef = doc(db, 'users', firebaseUser.uid)

  // Fast-path: Check if user doc exists first to avoid transaction overhead.
  const snap = await getDoc(userRef)
  if (snap.exists()) return

  const modesCol = collection(db, 'users', firebaseUser.uid, 'modes')

  // Pre-allocate mode refs so we can point activeModeId at the first one.
  const modeDocs = DEFAULT_MODES.map((mode, order) => ({
    ref: doc(modesCol),
    mode,
    order,
  }))
  const firstModeId = modeDocs[0]?.ref.id ?? null

  const hash = Array.from(firebaseUser.uid).reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
  const uniqueCode = String(Math.abs(hash) % 9000000 + 1000000)

  const rawDisplayName = firebaseUser.displayName || 'Explorer'
  const nameParts = rawDisplayName.trim().split(/\s+/)
  const firstName = nameParts[0] || 'Explorer'
  const lastName = nameParts.slice(1).join(' ') || ''

  await runTransaction(db, async (tx) => {
    const txSnap = await tx.get(userRef)
    if (txSnap.exists()) return

    tx.set(userRef, {
      profile: {
        firstName,
        lastName,
        displayName: rawDisplayName,
        email: firebaseUser.email || '',
        photoURL: firebaseUser.photoURL || '',
        uniqueCode,
        createdAt: serverTimestamp(),
      },
      settings: {
        theme: 'dark',
        activeModeId: firstModeId,
        hydrationIntervalMin: 60,
        notificationsEnabled: false,
        geminiConfigured: false,
      },
      statsAggregate: {
        currentStreak: 0,
        longestSessionMin: 0,
        totalFocusMin: 0,
        activeDays: [],
        treesGrown: 0,
      },
    })

    modeDocs.forEach(({ ref, mode, order }) => {
      tx.set(ref, {
        ...mode,
        order,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      })
    })
  })
}

export function subscribeToUserDoc(uid, callback, onError) {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (err) => {
      console.error('[sync] user doc subscription failed', err)
      onError?.(err)
    }
  )
}

/** Persist the active mode so the app resumes exactly where the user left off. */
export async function updateActiveMode(uid, modeId) {
  await setDoc(
    doc(db, 'users', uid),
    { settings: { activeModeId: modeId } },
    { merge: true },
  )
}

/** Merge a partial settings patch onto the user doc. */
export async function updateSettings(uid, patch) {
  await setDoc(doc(db, 'users', uid), { settings: patch }, { merge: true })
}

/** Merge a partial profile patch onto the user doc. */
export async function updateProfile(uid, patch) {
  await setDoc(doc(db, 'users', uid), { profile: patch }, { merge: true })
}
