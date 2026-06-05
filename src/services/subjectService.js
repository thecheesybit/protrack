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

export async function addTask(uid, modeId, subjectId, { title, column }) {
  return addDoc(tasksCol(uid, modeId, subjectId), {
    title,
    column: column || 'todo',
    order: Date.now(),
    createdAt: serverTimestamp(),
  })
}

export async function updateTask(uid, modeId, subjectId, taskId, patch) {
  return updateDoc(doc(tasksCol(uid, modeId, subjectId), taskId), patch)
}

export async function deleteTask(uid, modeId, subjectId, taskId) {
  return deleteDoc(doc(tasksCol(uid, modeId, subjectId), taskId))
}
