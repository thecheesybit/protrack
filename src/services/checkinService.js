import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Daily check-ins. One doc per day keyed by local YYYY-MM-DD, with per-slot
 * answers merged in — a full day costs at most three tiny writes and the
 * listener is bounded, so the feature stays comfortably inside the Spark plan.
 *
 *   users/{uid}/checkins/{ymd}
 *     { date, answers: { morning|midday|evening: { qid, type, value, note?, at } } }
 */

const checkinsCol = (uid) => collection(db, 'users', uid, 'checkins')

/** Realtime recent check-ins, newest first. Bounded (default 14 days). */
export function subscribeToRecentCheckins(uid, callback, max = 14) {
  const q = query(checkinsCol(uid), orderBy('date', 'desc'), limit(max))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error('[sync] checkins subscription failed', err),
  )
}

/**
 * Save one slot's answer. setDoc+merge writes blind — no read-modify-write —
 * and re-answering a slot simply overwrites it.
 * @param {string} uid
 * @param {string} date  Local YYYY-MM-DD (doc id).
 * @param {'morning'|'midday'|'evening'} slot
 * @param {{ qid: string, type: 'intent'|'scale', value: string|number, note?: string }} answer
 */
export async function saveCheckinAnswer(uid, date, slot, answer) {
  await setDoc(
    doc(checkinsCol(uid), date),
    {
      date,
      answers: { [slot]: { ...answer, at: serverTimestamp() } },
    },
    { merge: true },
  )
}
