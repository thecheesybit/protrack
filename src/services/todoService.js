import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

const todosCol = (uid) => collection(db, 'users', uid, 'todos')

export function subscribeToTodos(uid, callback) {
  const q = query(todosCol(uid), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  )
}

export async function addTodo(uid, { text, modeId, dueAt = null, subjectId = null }) {
  return addDoc(todosCol(uid), {
    text,
    done: false,
    modeId: modeId || null,
    dueAt: dueAt || null,
    subjectId: subjectId || null,
    createdAt: serverTimestamp(),
  })
}

export async function updateTodo(uid, todoId, patch) {
  return updateDoc(doc(todosCol(uid), todoId), patch)
}

export async function deleteTodo(uid, todoId) {
  return deleteDoc(doc(todosCol(uid), todoId))
}
