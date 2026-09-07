import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export const EXAM_RETENTION_DAYS = 15

export function getExamDaysRemaining(deletedAt, windowDays = EXAM_RETENTION_DAYS) {
  if (!deletedAt) return windowDays
  const elapsedMs = Date.now() - new Date(deletedAt).getTime()
  const remainingMs = windowDays * 24 * 60 * 60 * 1000 - elapsedMs
  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
  return Math.max(0, days)
}

const examsCol = (uid, modeId) =>
  collection(db, 'users', uid, 'modes', modeId, 'exams')

const scorecardsCol = (uid, modeId) =>
  collection(db, 'users', uid, 'modes', modeId, 'scorecards')

/**
 * Subscribe to exams within a mode.
 * Automatically handles 15-day soft-delete separation and background auto-pruning.
 */
export function subscribeToExams(uid, modeId, callback) {
  return onSnapshot(
    examsCol(uid, modeId),
    (snap) => {
      const now = Date.now()
      const maxRetentionMs = EXAM_RETENTION_DAYS * 24 * 60 * 60 * 1000
      const active = []
      const deleted = []
      const expiredIds = []

      snap.docs.forEach((d) => {
        const data = d.data()
        const item = { id: d.id, ...data }

        if (data.isDeleted) {
          const deletedTime = data.deletedAt ? new Date(data.deletedAt).getTime() : now
          if (now - deletedTime > maxRetentionMs) {
            expiredIds.push(d.id)
          } else {
            deleted.push(item)
          }
        } else {
          active.push(item)
        }
      })

      // Auto-prune expired exams (> 15 days deleted) in the background
      if (expiredIds.length > 0) {
        expiredIds.forEach((eid) => {
          permanentDeleteExam(uid, modeId, eid, true).catch(() => {})
        })
      }

      const sortedActive = active.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      const sortedDeleted = deleted.sort(
        (a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0)
      )

      // Attach deleted array for backwards compatibility
      sortedActive.deleted = sortedDeleted

      callback(sortedActive, sortedDeleted)
    },
    (err) => {
      console.warn('[examService] subscribe error:', err)
      const empty = []
      empty.deleted = []
      callback(empty, [])
    }
  )
}

/**
 * Fetch exams once.
 */
export async function getExamsOnce(uid, modeId) {
  const snap = await getDocs(examsCol(uid, modeId))
  const active = []
  snap.docs.forEach((d) => {
    const data = d.data()
    if (!data.isDeleted) {
      active.push({ id: d.id, ...data })
    }
  })
  return active.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/**
 * Add an exam object.
 */
export async function addExam(uid, modeId, exam) {
  return addDoc(examsCol(uid, modeId), {
    name: exam.name.trim(),
    category: exam.category?.trim() || 'General',
    color: exam.color || '#818cf8',
    targetScore: Number(exam.targetScore) || 0,
    totalMarks: Number(exam.totalMarks) || 0,
    targetAccuracy: Number(exam.targetAccuracy) || 85,
    targetPercentile: Number(exam.targetPercentile) || 90,
    order: exam.order ?? 0,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Update an existing exam object.
 */
export async function updateExam(uid, modeId, examId, patch) {
  const ref = doc(examsCol(uid, modeId), examId)
  return updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Soft delete an exam object (restorable within 15 days).
 */
export async function softDeleteExam(uid, modeId, examId) {
  const ref = doc(examsCol(uid, modeId), examId)
  return updateDoc(ref, {
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    restoreUntil: new Date(Date.now() + EXAM_RETENTION_DAYS * 86400000).toISOString(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Alias deleteExam to softDeleteExam for safety.
 */
export async function deleteExam(uid, modeId, examId, permanent = false) {
  if (permanent) {
    return permanentDeleteExam(uid, modeId, examId, true)
  }
  return softDeleteExam(uid, modeId, examId)
}

/**
 * Restore a soft-deleted exam.
 */
export async function restoreExam(uid, modeId, examId) {
  const ref = doc(examsCol(uid, modeId), examId)
  return updateDoc(ref, {
    isDeleted: false,
    deletedAt: null,
    restoreUntil: null,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Permanently delete an exam object and all its attempts.
 */
export async function permanentDeleteExam(uid, modeId, examId, deleteAttempts = true) {
  if (deleteAttempts) {
    const q = query(scorecardsCol(uid, modeId), where('examId', '==', examId))
    const snap = await getDocs(q)
    if (!snap.empty) {
      const batch = writeBatch(db)
      snap.docs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
  }
  const ref = doc(examsCol(uid, modeId), examId)
  return deleteDoc(ref)
}

/**
 * Move an exam and all its scorecards to another Mode / Scope.
 */
export async function moveExamToMode(uid, currentModeId, targetModeId, examId, patch) {
  if (!targetModeId || currentModeId === targetModeId) {
    return updateExam(uid, currentModeId, examId, patch)
  }

  // 1. Create exam in target mode
  const newExamRef = await addDoc(examsCol(uid, targetModeId), {
    ...patch,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // 2. Move associated scorecards
  const q = query(scorecardsCol(uid, currentModeId), where('examId', '==', examId))
  const snap = await getDocs(q)
  if (!snap.empty) {
    const batch = writeBatch(db)
    snap.docs.forEach((d) => {
      const newScorecardRef = doc(scorecardsCol(uid, targetModeId))
      batch.set(newScorecardRef, {
        ...d.data(),
        examId: newExamRef.id,
      })
      batch.delete(d.ref)
    })
    await batch.commit()
  }

  // 3. Remove old exam from current mode
  const oldRef = doc(examsCol(uid, currentModeId), examId)
  await deleteDoc(oldRef)

  return newExamRef
}
