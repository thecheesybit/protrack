import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

const ledgerCol = (uid) => collection(db, 'users', uid, 'ledger')

// Bounded read so the history pane stays predictable as the log grows.
// Generous for a small (<50) user base; well within the raised free-tier caps.
const LEDGER_LIMIT = 200

/**
 * Append an achievement / milestone entry.
 * @param {string} uid
 * @param {{ kind: 'focus'|'task'|'milestone'|'habit', title: string, detail?: string, modeId?: string }} entry
 */
export async function addLedgerEntry(uid, entry) {
  if (!uid) return null
  return addDoc(ledgerCol(uid), {
    kind: entry.kind || 'milestone',
    title: entry.title || '',
    detail: entry.detail || null,
    modeId: entry.modeId || null,
    at: serverTimestamp(),
  })
}

/** Realtime subscription to the most recent entries (bounded). */
export function subscribeToLedger(uid, callback) {
  const q = query(ledgerCol(uid), orderBy('at', 'desc'), limit(LEDGER_LIMIT))
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  )
}
