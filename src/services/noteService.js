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
import { encryptObject, decryptObject, getContentKey } from '@/services/cryptoService'

const notesCol = (uid) => collection(db, 'users', uid, 'notes')
const ENCRYPTED_NOTE_FIELDS = ['content', 'transcript', 'summary']

export function subscribeToNotes(uid, callback, max = 100) {
  const q = query(notesCol(uid), orderBy('createdAt', 'desc'), limit(max))
  return onSnapshot(q, async (snap) => {
    const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const key = await getContentKey(uid)
    const decrypted = await Promise.all(
      raw.map((n) => decryptObject(n, ENCRYPTED_NOTE_FIELDS, key))
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

  const key = await getContentKey(uid)
  const encrypted = await encryptObject(
    {
      content: note.content || '',
      transcript: note.transcript || '',
      summary: note.summary || '',
    },
    ENCRYPTED_NOTE_FIELDS,
    key
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
    // Optional deadline + reminder. `dueAt` (Timestamp) surfaces the note as a
    // blinking chip on the timetable for that day; `reminderEnabled` opts it
    // into the 2-day-ahead reminder engine (see hooks/useNoteReminders).
    dueAt: note.dueAt ? new Date(note.dueAt) : null,
    reminderEnabled: Boolean(note.reminderEnabled),
    createdAt: serverTimestamp(),
  })
}

/**
 * Set or clear a note's deadline + reminder without touching its (encrypted)
 * body. Pass `dueAt: null` to remove the deadline entirely.
 */
export async function setNoteDeadline(uid, noteId, { dueAt, reminderEnabled }) {
  return updateDoc(doc(notesCol(uid), noteId), {
    dueAt: dueAt ? new Date(dueAt) : null,
    reminderEnabled: Boolean(reminderEnabled),
    updatedAt: serverTimestamp(),
  })
}

export async function updateNote(uid, noteId, patch) {
  const fields = ENCRYPTED_NOTE_FIELDS.filter((f) => f in patch)
  const key = fields.length > 0 ? await getContentKey(uid) : null
  const encrypted = fields.length > 0 ? await encryptObject(patch, fields, key) : patch

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
