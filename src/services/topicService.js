import {
  collection,
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

/**
 * Topics — a per-subject grouping layer over the Kanban tasks ("lessons").
 * Path: users/{uid}/modes/{modeId}/subjects/{subjectId}/topics/{topicId}
 *   { title, color?, order, createdAt }
 * A task joins a topic via its own `topicId` field. Owner-only access is
 * already covered by the users/{uid}/** Firestore rule — no rules change.
 */

const topicsCol = (uid, modeId, subjectId) =>
  collection(db, 'users', uid, 'modes', modeId, 'subjects', subjectId, 'topics')
const tasksCol = (uid, modeId, subjectId) =>
  collection(db, 'users', uid, 'modes', modeId, 'subjects', subjectId, 'tasks')

/** One bounded, per-active-subject listener (mirrors subscribeToTasks). */
export function subscribeToTopics(uid, modeId, subjectId, callback) {
  return onSnapshot(topicsCol(uid, modeId, subjectId), (snap) => {
    const topics = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    callback(topics)
  })
}

export async function addTopic(uid, modeId, subjectId, { title, color } = {}) {
  return addDoc(topicsCol(uid, modeId, subjectId), {
    title: (title || '').trim() || 'New topic',
    color: color || null,
    order: Date.now(),
    createdAt: serverTimestamp(),
  })
}

export async function updateTopic(uid, modeId, subjectId, topicId, patch) {
  return updateDoc(doc(topicsCol(uid, modeId, subjectId), topicId), patch)
}

/** Batch re-number `order` from a caller-supplied ordering (drag-to-reorder). */
export async function reorderTopics(uid, modeId, subjectId, orderedIds) {
  if (!orderedIds?.length) return
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(doc(topicsCol(uid, modeId, subjectId), id), { order: (index + 1) * 1000 })
  })
  return batch.commit()
}

/**
 * Delete a topic and detach it from every task that referenced it, so those
 * tasks survive as "ungrouped" instead of hiding behind a dangling `topicId`.
 * Reads the tasks once and filters client-side (no composite index needed).
 */
export async function deleteTopic(uid, modeId, subjectId, topicId) {
  const snap = await getDocs(tasksCol(uid, modeId, subjectId))
  const affected = snap.docs.filter((d) => d.data()?.topicId === topicId)
  if (affected.length) {
    const batch = writeBatch(db)
    affected.forEach((d) => batch.update(d.ref, { topicId: null }))
    await batch.commit()
  }
  return deleteDoc(doc(topicsCol(uid, modeId, subjectId), topicId))
}
