import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Generous bounds — with well under 50 users these never approach the (now
// raised) free-tier ceilings, yet keep reads bounded and predictable.
const WALL_LIMIT = 200
const QUEUE_LIMIT = 200

const pendingCol = () => collection(db, 'pending_contributions')
const verifiedCol = () => collection(db, 'verified_patreons')

/* ── Contributor side ───────────────────────────────────── */

/**
 * Create the contributor's own pending packet. Owner-stamped; the contributor
 * can never read the queue back (see firestore.rules). One write, zero reads.
 */
export async function createPendingContribution(user, { amount, currency, love, featureRequest }) {
  return addDoc(pendingCol(), {
    uid: user.uid,
    name: user.displayName || 'Anonymous',
    email: user.email || null, // admin-only readable; never surfaced publicly
    amount: Number(amount) || 0,
    currency: currency || 'INR',
    love: (love || '').slice(0, 600),
    featureRequest: (featureRequest || '').slice(0, 400),
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

/* ── Public wall ────────────────────────────────────────── */

/**
 * Realtime, bounded, cache-first subscription to the global wall of honor.
 * Wired once in FirestoreSyncProvider so the whole app shares a single listener
 * (and persistent cache means reloads cost ~0 reads).
 */
export function subscribeVerifiedPatreons(cb) {
  const q = query(verifiedCol(), orderBy('verifiedAt', 'desc'), limit(WALL_LIMIT))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

/* ── Admin side ─────────────────────────────────────────── */

/** Realtime queue of pending contributions (admin only — rules enforce it). */
export function subscribePendingContributions(cb) {
  const q = query(pendingCol(), orderBy('createdAt', 'desc'), limit(QUEUE_LIMIT))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

/**
 * Approve a contribution atomically: promote a display-safe record to the
 * public wall (keyed by uid, no PII), then clear it from the queue. The wall
 * listener pushes the change to every active client in real time.
 */
export async function approveContribution(pending) {
  const verifiedRef = doc(verifiedCol(), pending.uid)
  const pendingRef = doc(pendingCol(), pending.id)
  await runTransaction(db, async (tx) => {
    tx.set(verifiedRef, {
      name: pending.name || 'Anonymous',
      region: pending.region || (pending.currency === 'USD' ? 'US' : 'IN'),
      amount: pending.amount || 0,
      currency: pending.currency || 'INR',
      testimony: pending.love || '',
      featureRequest: pending.featureRequest || '',
      verifiedAt: serverTimestamp(),
    })
    tx.delete(pendingRef)
  })
}

/** Decline (remove) a pending contribution. */
export async function declineContribution(pendingId) {
  return deleteDoc(doc(pendingCol(), pendingId))
}
