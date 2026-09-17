import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Public leaderboard data access.
 *
 * `leaderboard/{uid}` is world-readable but owner-writable (see firestore.rules,
 * mirroring the Wall of Honor). Each client publishes only its own display-safe
 * aggregate (built by {@link module:lib/leaderboard.buildLeaderboardEntry}); no
 * Cloud Functions are involved, so this stays Spark-plan compatible.
 */

/** Publish (create/replace) the signed-in user's own leaderboard entry. */
export async function publishLeaderboardEntry(uid, entry) {
  await setDoc(doc(db, 'leaderboard', uid), {
    ...entry,
    uid,
    updatedAt: serverTimestamp(),
  })
}

/** Remove the user's entry (called when they opt out). Best-effort. */
export async function removeLeaderboardEntry(uid) {
  try {
    await deleteDoc(doc(db, 'leaderboard', uid))
  } catch (err) {
    console.warn('[leaderboard] remove failed', err)
  }
}

/**
 * Subscribe to the top of the leaderboard, ordered by monthly focus minutes
 * (single-field index → no composite required). Callers re-sort client-side for
 * the weekly tab. Only mount this while the leaderboard UI is visible.
 */
export function subscribeToLeaderboard(callback, onError, max = 100) {
  const q = query(collection(db, 'leaderboard'), orderBy('monthlyMin', 'desc'), limit(max))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.warn('[leaderboard] subscribe failed', err)
      onError?.(err)
    },
  )
}
