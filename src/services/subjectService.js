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
import { getTodosOnce, updateTodo, bulkCompleteTodos } from '@/services/todoService'

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

/**
 * One-shot tasks fetch (mirrors {@link getSubjectsOnce}) — for the Deep Focus
 * session->topic mapping suggestion, computed once at session completion
 * rather than via a standing listener.
 */
export async function getTasksOnce(uid, modeId, subjectId) {
  const snap = await getDocs(tasksCol(uid, modeId, subjectId))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/**
 * Overall completion for a subject's unified board: its own Kanban tasks PLUS
 * any general todo merged into it via `todo.subjectId` (see MicroKanban /
 * lib/kanbanMerge.js) — so finishing a merged todo moves the same progress
 * bar finishing a task would, and vice versa.
 */
export async function computeSubjectProgressPct(uid, modeId, subjectId) {
  const [tasks, todos] = await Promise.all([
    getTasksOnce(uid, modeId, subjectId),
    getTodosOnce(uid),
  ])
  const subjectTodos = todos.filter((t) => t.subjectId === subjectId)
  const total = tasks.length + subjectTodos.length
  if (total === 0) return 0
  const done =
    tasks.filter((t) => t.column === 'done').length +
    subjectTodos.filter((t) => t.done).length
  return Math.round((done / total) * 100)
}

/**
 * Marks one task done and recomputes the subject's progress in the same pass
 * — used when a Deep Focus session's topic mapping is confirmed at
 * session-end, where the caller has no local `tasks` array to recompute
 * progress from the way MicroKanban's drag-drop handler does.
 */
export async function completeTaskAndRecomputeProgress(uid, modeId, subjectId, taskId) {
  await updateTask(uid, modeId, subjectId, taskId, { column: 'done' })
  const pct = await computeSubjectProgressPct(uid, modeId, subjectId)
  await setSubjectProgress(uid, modeId, subjectId, pct)
}

/**
 * Same as {@link completeTaskAndRecomputeProgress} but for a general todo
 * merged into a subject's board — used by SessionCompleteModal when the
 * confirmed mapping target is a todo rather than a Kanban task.
 */
export async function completeTodoAndRecomputeProgress(uid, modeId, subjectId, todoId) {
  // Also pin `subjectColumn: 'done'` so the card visibly moves to the subject
  // board's Done lane. The merged Kanban (lib/kanbanMerge) derives a todo's lane
  // from `subjectColumn` first, so setting only `done` would mark it complete
  // for progress/deadlines but leave the card sitting in its old lane.
  await updateTodo(uid, todoId, { done: true, subjectColumn: 'done' })
  if (!modeId || !subjectId) return
  const pct = await computeSubjectProgressPct(uid, modeId, subjectId)
  await setSubjectProgress(uid, modeId, subjectId, pct)
}

/**
 * Flags a subject's topic queue as needing the AI batch pass (see
 * useTopicMappingBatch) — set when a live session-end mapping is edited away
 * from the deterministic FIFO suggestion, the signal that plain order isn't
 * tracking this subject's actual class flow.
 */
export async function setMappingNeedsReview(uid, modeId, subjectId, needsReview = true) {
  return updateSubject(uid, modeId, subjectId, { mappingNeedsReview: needsReview })
}

export async function addTask(uid, modeId, subjectId, { title, column, priority, notes, dueAt, topicId }) {
  return addDoc(tasksCol(uid, modeId, subjectId), {
    title,
    column: column || 'todo',
    priority: priority || 'medium', // 'low' | 'medium' | 'high' | 'urgent'
    notes: notes || '',
    dueAt: dueAt || null,
    topicId: topicId || null, // optional grouping (see lib/topics.js, topicService.js)
    order: Date.now(),
    createdAt: serverTimestamp(),
  })
}

/**
 * Marks a whole topic's cards done in one pass, then recomputes the subject's
 * progress once. Handles both native Kanban tasks and merged general to-dos
 * (each batched into its own collection). Powers the grouped board's "Complete
 * topic". `taskIds` / `todoIds` are the topic's not-yet-done ids of each kind.
 */
export async function completeTopicCards(uid, modeId, subjectId, { taskIds = [], todoIds = [] } = {}) {
  if (!uid || !modeId || !subjectId) return
  if (!taskIds.length && !todoIds.length) return

  if (taskIds.length) {
    const batch = writeBatch(db)
    const baseOrder = Date.now()
    taskIds.forEach((id, i) => {
      batch.update(doc(tasksCol(uid, modeId, subjectId), id), { column: 'done', order: baseOrder + i })
    })
    await batch.commit()
  }
  if (todoIds.length) {
    await bulkCompleteTodos(uid, todoIds)
  }

  const pct = await computeSubjectProgressPct(uid, modeId, subjectId)
  await setSubjectProgress(uid, modeId, subjectId, pct)
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
        topicId: opts.topicId || null,
        order: baseOrder + (i + idx) * 10,
        createdAt: serverTimestamp(),
      })
    })

    await batch.commit()
  }

  // Recompute progress once (tasks + any merged subject-linked todos)
  try {
    const pct = await computeSubjectProgressPct(uid, modeId, subjectId)
    await setSubjectProgress(uid, modeId, subjectId, pct)
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
