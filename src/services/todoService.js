import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

const todosCol = (uid) => collection(db, 'users', uid, 'todos')

export function subscribeToTodos(uid, callback) {
  // Sort by the user-controlled `order` field first (set on drag-reorder),
  // falling back to createdAt for legacy todos that don't have one.
  const q = query(todosCol(uid), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    // Sort by `order` ascending if set; otherwise by createdAt desc (already
    // applied by the query). Stable sort keeps un-ordered todos at the end.
    todos.sort((a, b) => {
      if (a.order != null && b.order != null) return a.order - b.order
      if (a.order != null) return -1
      if (b.order != null) return 1
      return 0
    })
    callback(todos)
  })
}

export async function addTodo(
  uid,
  { text, modeId, dueAt = null, subjectId = null, priority = 'medium', notes = '', ...rest },
) {
  return addDoc(todosCol(uid), {
    text,
    done: false,
    modeId: modeId || null,
    dueAt: dueAt || null,
    subjectId: subjectId || null,
    priority,
    notes,
    order: Date.now(),
    createdAt: serverTimestamp(),
    ...rest,
  })
}

export async function updateTodo(uid, todoId, patch) {
  return updateDoc(doc(todosCol(uid), todoId), patch)
}

export async function deleteTodo(uid, todoId) {
  return deleteDoc(doc(todosCol(uid), todoId))
}

/** Atomic batch update of the `order` field across a re-arranged list. */
export async function reorderTodos(uid, orderedIds) {
  if (!orderedIds?.length) return
  const batch = writeBatch(db)
  orderedIds.forEach((todoId, index) => {
    batch.update(doc(todosCol(uid), todoId), { order: (index + 1) * 1000 })
  })
  return batch.commit()
}
