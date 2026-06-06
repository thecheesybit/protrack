import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

const notesCol = (uid) => collection(db, 'users', uid, 'notes')

export function subscribeToNotes(uid, callback, max = 50) {
  const q = query(notesCol(uid), orderBy('createdAt', 'desc'), limit(max))
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  )
}

export async function addNote(uid, note) {
  return addDoc(notesCol(uid), {
    title: note.title || 'Voice note',
    transcript: note.transcript || '',
    summary: note.summary || '',
    actionItems: note.actionItems || [],
    flashcards: note.flashcards || [],
    modeId: note.modeId || null,
    createdAt: serverTimestamp(),
  })
}

export async function deleteNote(uid, noteId) {
  return deleteDoc(doc(notesCol(uid), noteId))
}
