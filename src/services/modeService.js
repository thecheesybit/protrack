import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

/** Realtime subscription to the user's modes, ordered for the switcher. */
export function subscribeToModes(uid, callback) {
  const q = query(
    collection(db, 'users', uid, 'modes'),
    orderBy('order', 'asc'),
  )
  return onSnapshot(q, (snap) => {
    const modes = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(modes)
  })
}

/** Create a new mode and return its reference. */
export async function createMode(uid, { name, icon, accentColor, order }) {
  return addDoc(collection(db, 'users', uid, 'modes'), {
    name,
    icon,
    accentColor,
    order,
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  })
}
