import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function subscribeToModes(uid, callback, onError) {
  const q = query(
    collection(db, 'users', uid, 'modes'),
    orderBy('order', 'asc'),
  )
  return onSnapshot(
    q,
    (snap) => {
      const modes = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      callback(modes)
    },
    (err) => {
      console.error('[sync] modes subscription failed', err)
      onError?.(err)
    }
  )
}

/** Create a new mode and return its reference. */
export async function createMode(uid, { name, icon, accentColor, order }) {
  return addDoc(collection(db, 'users', uid, 'modes'), {
    name,
    icon,
    accentColor,
    order,
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  })
}

/** Patch a mode (name, icon, accentColor, …). */
export async function updateMode(uid, modeId, patch) {
  return updateDoc(doc(db, 'users', uid, 'modes', modeId), patch)
}

/** Persist a new ordering for the modes in a single batch. */
export async function reorderModes(uid, orderedIds) {
  const batch = writeBatch(db)
  orderedIds.forEach((id, order) => {
    batch.update(doc(db, 'users', uid, 'modes', id), { order })
  })
  return batch.commit()
}

/**
 * Delete a mode and its direct context (subjects, timetable slots, goals).
 * Note: tasks nested under subjects are best-effort orphaned — a Cloud Function
 * would do a true recursive delete; this keeps the client lean.
 */
export async function deleteMode(uid, modeId) {
  const sub = ['subjects', 'timetableSlots', 'goals']
  for (const name of sub) {
    const snap = await getDocs(collection(db, 'users', uid, 'modes', modeId, name))
    if (snap.empty) continue
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  return deleteDoc(doc(db, 'users', uid, 'modes', modeId))
}
