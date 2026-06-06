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

  await runTransaction(db, async (tx) => {
    const txSnap = await tx.get(userRef)
    if (txSnap.exists()) return

    tx.set(userRef, {
      profile: {
        displayName: firebaseUser.displayName || 'Explorer',
        email: firebaseUser.email || '',
        photoURL: firebaseUser.photoURL || '',
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
