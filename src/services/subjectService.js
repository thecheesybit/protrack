import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { addLedgerEntry } from '@/services/ledgerService'

const subjectsCol = (uid, modeId) =>
  collection(db, 'users', uid, 'modes', modeId, 'subjects')
const tasksCol = (uid, modeId, subjectId) =>
  collection(db, 'users', uid, 'modes', modeId, 'subjects', subjectId, 'tasks')

/* ── Subjects ───────────────────────────────────────────── */

export function subscribeToSubjects(uid, modeId, callback) {
  return onSnapshot(subjectsCol(uid, modeId), (snap) => {
    const subjects = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    callback(subjects)
  })
}

/** One-shot subjects fetch (cache-first via persistence) — for pickers. */
export async function getSubjectsOnce(uid, modeId) {
  const snap = await getDocs(subjectsCol(uid, modeId))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export async function addSubject(uid, modeId, subject) {
  return addDoc(subjectsCol(uid, modeId), {
    name: subject.name,
    color: subject.color,
    progressPct: 0,
    targetHours: subject.targetHours ?? 0,
    loggedMinutes: 0,
    links: [],
    flags: [],
    order: subject.order ?? 0,
    createdAt: serverTimestamp(),
  })
}

export async function updateSubject(uid, modeId, subjectId, patch) {
  return updateDoc(doc(subjectsCol(uid, modeId), subjectId), patch)
}

/* Atomic field-level merges — safe under concurrent edits across devices. */
export async function addSubjectLink(uid, modeId, subjectId, link) {
  return updateSubject(uid, modeId, subjectId, { links: arrayUnion(link) })
}
export async function removeSubjectLink(uid, modeId, subjectId, link) {
  return updateSubject(uid, modeId, subjectId, { links: arrayRemove(link) })
}
export async function addSubjectFlag(uid, modeId, subjectId, flag) {
  return updateSubject(uid, modeId, subjectId, { flags: arrayUnion(flag) })
}
export async function removeSubjectFlag(uid, modeId, subjectId, flag) {
  return updateSubject(uid, modeId, subjectId, { flags: arrayRemove(flag) })
}
export async function adjustProgress(uid, modeId, subjectId, delta) {
  return updateSubject(uid, modeId, subjectId, { progressPct: increment(delta) })
}

/** Set an absolute progress percentage — used by the auto Kanban→Subject sync. */
export async function setSubjectProgress(uid, modeId, subjectId, pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)))
  return updateSubject(uid, modeId, subjectId, { progressPct: clamped })
}

export async function deleteSubject(uid, modeId, subjectId) {
  // Best-effort: clear tasks subcollection, then the subject doc.
  const snap = await getDocs(tasksCol(uid, modeId, subjectId))
  if (!snap.empty) {
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  return deleteDoc(doc(subjectsCol(uid, modeId), subjectId))
}

/* ── Micro-Kanban tasks ─────────────────────────────────── */

export function subscribeToTasks(uid, modeId, subjectId, callback) {
  return onSnapshot(tasksCol(uid, modeId, subjectId), (snap) => {
    const tasks = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    callback(tasks)
  })
}

export async function addTask(uid, modeId, subjectId, { title, column, priority, notes, dueAt }) {
  return addDoc(tasksCol(uid, modeId, subjectId), {
    title,
    column: column || 'todo',
    priority: priority || 'medium', // 'low' | 'medium' | 'high' | 'urgent'
    notes: notes || '',
    dueAt: dueAt || null,
    order: Date.now(),
    createdAt: serverTimestamp(),
  })
}

/**
 * Re-numbers `order` across a list of tasks within a single column. Caller
 * provides the new ordering. Uses a batch so all updates land atomically.
 */
export async function reorderTasks(uid, modeId, subjectId, orderedIds) {
  if (!orderedIds?.length) return
  const batch = writeBatch(db)
  orderedIds.forEach((taskId, index) => {
    batch.update(doc(tasksCol(uid, modeId, subjectId), taskId), {
      order: (index + 1) * 1000,
    })
  })
  return batch.commit()
}

export async function updateTask(uid, modeId, subjectId, taskId, patch) {
  return updateDoc(doc(tasksCol(uid, modeId, subjectId), taskId), patch)
}

export async function deleteTask(uid, modeId, subjectId, taskId) {
  return deleteDoc(doc(tasksCol(uid, modeId, subjectId), taskId))
}

/**
 * Bulk create tasks for a subject using chunked writeBatch (chunk size <= 400).
 * Recomputes subject progress once, logs one ledger entry, and returns { count, ids }.
 */
export async function addTasksBulk(uid, modeId, subjectId, titles, opts = {}) {
  if (!uid || !modeId || !subjectId || !titles?.length) {
    return { count: 0, ids: [] }
  }

  const column = opts.column || 'todo'
  const priority = opts.priority || 'medium'
  const baseOrder = Date.now()
  const CHUNK_SIZE = 400
  const createdIds = []

  for (let i = 0; i < titles.length; i += CHUNK_SIZE) {
    const chunk = titles.slice(i, i + CHUNK_SIZE)
    const batch = writeBatch(db)

    chunk.forEach((title, idx) => {
      const taskDocRef = doc(tasksCol(uid, modeId, subjectId))
      createdIds.push(taskDocRef.id)
      batch.set(taskDocRef, {
        title: typeof title === 'string' ? title.trim() : String(title),
        column,
        priority,
        notes: opts.notes || '',
        dueAt: opts.dueAt || null,
        order: baseOrder + (i + idx) * 10,
        createdAt: serverTimestamp(),
      })
    })

    await batch.commit()
  }

  // Recompute progress once
  try {
    const snap = await getDocs(tasksCol(uid, modeId, subjectId))
    if (!snap.empty) {
      const total = snap.docs.length
      const done = snap.docs.filter((d) => d.data().column === 'done').length
      const pct = Math.round((done / total) * 100)
      await setSubjectProgress(uid, modeId, subjectId, pct)
    }
  } catch (err) {
    console.warn('[subjectService] bulk task progress recompute error:', err)
  }

  // Single ledger entry
  try {
    await addLedgerEntry(uid, {
      kind: 'task',
      title: `Added ${createdIds.length} tasks`,
      detail: opts.subjectName ? `Bulk created in ${opts.subjectName}` : 'Bulk tasks created',
      modeId,
    })
  } catch (err) {
    console.warn('[subjectService] bulk task ledger entry error:', err)
  }

  return { count: createdIds.length, ids: createdIds }
}
