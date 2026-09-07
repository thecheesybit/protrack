import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { encryptObject, decryptObject } from '@/services/cryptoService'

const notesCol = (uid) => collection(db, 'users', uid, 'notes')
const ENCRYPTED_NOTE_FIELDS = ['content', 'transcript', 'summary']

export function subscribeToNotes(uid, callback, max = 100) {
  const q = query(notesCol(uid), orderBy('createdAt', 'desc'), limit(max))
  return onSnapshot(q, async (snap) => {
    const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const decrypted = await Promise.all(
      raw.map((n) => decryptObject(n, ENCRYPTED_NOTE_FIELDS))
    )
    callback(decrypted)
  })
}

export async function addNote(uid, note) {
  const type = note.type || 'note'
  const fallbackTitle =
    type === 'voice'
      ? 'Voice memo'
      : type === 'link'
        ? 'Saved link'
        : type === 'memory'
          ? 'Memory & recollection'
          : 'Quick note'

  const encrypted = await encryptObject(
    {
      content: note.content || '',
      transcript: note.transcript || '',
      summary: note.summary || '',
    },
    ENCRYPTED_NOTE_FIELDS
  )

  return addDoc(notesCol(uid), {
    title: note.title?.trim() || fallbackTitle,
    content: encrypted.content,
    type,
    url: note.url || '',
    audioData: note.audioData || null,
    audioDuration: note.audioDuration || 0,
    transcript: encrypted.transcript,
    summary: encrypted.summary,
    tags: Array.isArray(note.tags) ? note.tags : [],
    pinned: Boolean(note.pinned),
    actionItems: note.actionItems || [],
    flashcards: note.flashcards || [],
    modeId: note.modeId || null,
    createdAt: serverTimestamp(),
  })
}

export async function updateNote(uid, noteId, patch) {
  const fields = ENCRYPTED_NOTE_FIELDS.filter((f) => f in patch)
  const encrypted = fields.length > 0 ? await encryptObject(patch, fields) : patch

  return updateDoc(doc(notesCol(uid), noteId), {
    ...encrypted,
    updatedAt: serverTimestamp(),
  })
}

export async function togglePinNote(uid, noteId, currentPinned) {
  return updateDoc(doc(notesCol(uid), noteId), {
    pinned: !currentPinned,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteNote(uid, noteId) {
  return deleteDoc(doc(notesCol(uid), noteId))
}
