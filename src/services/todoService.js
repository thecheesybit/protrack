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
import { encryptObject, decryptObject, getContentKey } from '@/services/cryptoService'

const todosCol = (uid) => collection(db, 'users', uid, 'todos')
const ENCRYPTED_TODO_FIELDS = ['text', 'notes']

export function subscribeToTodos(uid, callback) {
  // Sort by the user-controlled `order` field first (set on drag-reorder),
  // falling back to createdAt for legacy todos that don't have one.
  const q = query(todosCol(uid), orderBy('createdAt', 'desc'))
  return onSnapshot(q, async (snap) => {
    const rawTodos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const key = await getContentKey(uid)
    const decrypted = await Promise.all(
      rawTodos.map((t) => decryptObject(t, ENCRYPTED_TODO_FIELDS, key))
    )
    // Sort by `order` ascending if set; otherwise by createdAt desc (already
    // applied by the query). Stable sort keeps un-ordered todos at the end.
    decrypted.sort((a, b) => {
      if (a.order != null && b.order != null) return a.order - b.order
      if (a.order != null) return -1
      if (b.order != null) return 1
      return 0
    })
    callback(decrypted)
  })
}

export async function addTodo(
  uid,
  { text, modeId, dueAt = null, subjectId = null, priority = 'medium', notes = '', ...rest },
) {
  const key = await getContentKey(uid)
  const encrypted = await encryptObject({ text: text || '', notes: notes || '' }, ENCRYPTED_TODO_FIELDS, key)

  return addDoc(todosCol(uid), {
    text: encrypted.text,
    done: false,
    modeId: modeId || null,
    dueAt: dueAt || null,
    subjectId: subjectId || null,
    priority,
    notes: encrypted.notes,
    order: Date.now(),
    createdAt: serverTimestamp(),
    ...rest,
  })
}

export async function updateTodo(uid, todoId, patch) {
  const fields = ENCRYPTED_TODO_FIELDS.filter((f) => f in patch)
  const key = fields.length > 0 ? await getContentKey(uid) : null
  const encrypted = fields.length > 0 ? await encryptObject(patch, fields, key) : patch
  return updateDoc(doc(todosCol(uid), todoId), encrypted)
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

/**
 * Add a subtask to an existing todo.
 */
export async function addSubtask(uid, todoId, currentSubtasks = [], text) {
  const cleanText = text?.trim()
  if (!cleanText) return
  const newSubtask = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    text: cleanText,
    done: false,
  }
  const nextSubtasks = [...currentSubtasks, newSubtask]
  return updateTodo(uid, todoId, { subtasks: nextSubtasks })
}

/**
 * Toggle completion of a subtask within a todo.
 */
export async function toggleSubtask(uid, todoId, currentSubtasks = [], subtaskId) {
  const nextSubtasks = currentSubtasks.map((s) =>
    s.id === subtaskId ? { ...s, done: !s.done } : s
  )
  return updateTodo(uid, todoId, { subtasks: nextSubtasks })
}

/**
 * Remove a subtask from a todo.
 */
export async function deleteSubtask(uid, todoId, currentSubtasks = [], subtaskId) {
  const nextSubtasks = currentSubtasks.filter((s) => s.id !== subtaskId)
  return updateTodo(uid, todoId, { subtasks: nextSubtasks })
}

