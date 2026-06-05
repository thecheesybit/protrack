import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

const slotsCol = (uid, modeId) =>
  collection(db, 'users', uid, 'modes', modeId, 'timetableSlots')

/**
 * Realtime slots for a mode. We sort client-side (no composite index needed).
 */
export function subscribeToSlots(uid, modeId, callback) {
  return onSnapshot(slotsCol(uid, modeId), (snap) => {
    const slots = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin)
    callback(slots)
  })
}

export async function addSlot(uid, modeId, slot) {
  return addDoc(slotsCol(uid, modeId), {
    ...slot,
    createdAt: serverTimestamp(),
  })
}

export async function updateSlot(uid, modeId, slotId, patch) {
  return updateDoc(doc(slotsCol(uid, modeId), slotId), patch)
}

export async function deleteSlot(uid, modeId, slotId) {
  return deleteDoc(doc(slotsCol(uid, modeId), slotId))
}
