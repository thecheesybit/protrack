import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DEFAULT_MODES } from '@/lib/constants'

/**
 * Create the user's root document + settings + seeded default modes on first
 * login. Idempotent: returns the existing data if the document already exists.
 */
export async function ensureUserDocument(firebaseUser) {
  const userRef = doc(db, 'users', firebaseUser.uid)
  const snapshot = await getDoc(userRef)
  if (snapshot.exists()) return snapshot.data()

  const batch = writeBatch(db)

  // Pre-allocate mode doc refs so we can point activeModeId at the first one.
  const modesCol = collection(db, 'users', firebaseUser.uid, 'modes')
  const modeDocs = DEFAULT_MODES.map((mode, order) => ({
    ref: doc(modesCol),
    mode,
    order,
  }))
  const firstModeId = modeDocs[0]?.ref.id ?? null

  batch.set(userRef, {
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
      longestStreakMin: 0,
      totalFocusMin: 0,
      activeDays: [],
      treesGrown: 0,
    },
  })

  modeDocs.forEach(({ ref, mode, order }) => {
    batch.set(ref, {
      ...mode,
      order,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    })
  })

  await batch.commit()
  const fresh = await getDoc(userRef)
  return fresh.data()
}

/** Realtime subscription to the user root doc (settings, profile, stats). */
export function subscribeToUserDoc(uid, callback) {
  return onSnapshot(doc(db, 'users', uid), (snap) =>
    callback(snap.exists() ? snap.data() : null),
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
