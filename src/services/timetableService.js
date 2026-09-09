import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
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

/**
 * Mark a timetable slot completed or incomplete for a specific date (YYYY-MM-DD).
 *
 * @param {string} uid
 * @param {string} modeId
 * @param {string} slotId
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {boolean} [completedState] - explicit boolean, or undefined to toggle based on currentCompletedDates
 * @param {Array<string>} [currentCompletedDates]
 */
export async function toggleSlotCompletion(uid, modeId, slotId, dateStr, completedState, currentCompletedDates) {
  if (!uid || !modeId || !slotId || !dateStr) return
  let shouldComplete = completedState
  if (typeof shouldComplete !== 'boolean') {
    shouldComplete = !(Array.isArray(currentCompletedDates) && currentCompletedDates.includes(dateStr))
  }
  return updateDoc(doc(slotsCol(uid, modeId), slotId), {
    completedDates: shouldComplete ? arrayUnion(dateStr) : arrayRemove(dateStr),
  })
}
