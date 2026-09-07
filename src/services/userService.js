import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  onSnapshot,
  collection,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DEFAULT_MODES } from '@/lib/constants'
import { clearCalToken } from '@/services/calendarService'
import { deriveUniqueCode } from '@/services/cryptoService'

/**
 * Create the user's root document + settings + seeded default modes on first
 * login, inside a transaction so two devices logging in simultaneously can't
 * double-seed. Idempotent — a no-op if the document already exists.
 */
export async function ensureUserDocument(firebaseUser) {
  const userRef = doc(db, 'users', firebaseUser.uid)

  // Fast-path: Check if user doc exists first to avoid transaction overhead.
  const snap = await getDoc(userRef)
  if (snap.exists()) return

  const modesCol = collection(db, 'users', firebaseUser.uid, 'modes')

  // Pre-allocate mode refs so we can point activeModeId at the first one.
  const modeDocs = DEFAULT_MODES.map((mode, order) => ({
    ref: doc(modesCol),
    mode,
    order,
  }))
  const firstModeId = modeDocs[0]?.ref.id ?? null

  const uniqueCode = deriveUniqueCode(firebaseUser.uid)

  const rawDisplayName = firebaseUser.displayName || 'Explorer'
  const nameParts = rawDisplayName.trim().split(/\s+/)
  const firstName = nameParts[0] || 'Explorer'
  const lastName = nameParts.slice(1).join(' ') || ''

  await runTransaction(db, async (tx) => {
    const txSnap = await tx.get(userRef)
    if (txSnap.exists()) return

    tx.set(userRef, {
      profile: {
        firstName,
        lastName,
        displayName: rawDisplayName,
        email: firebaseUser.email || '',
        photoURL: firebaseUser.photoURL || '',
        uniqueCode,
        createdAt: serverTimestamp(),
      },
      settings: {
        theme: 'dark',
        activeModeId: firstModeId || 'all',
        hydrationIntervalMin: 60,
        notificationsEnabled: false,
        geminiConfigured: false,
      },
      statsAggregate: {
        currentStreak: 0,
        longestSessionMin: 0,
        totalFocusMin: 0,
        activeDays: [],
        treesGrown: 0,
      },
    })

    modeDocs.forEach(({ ref, mode, order }) => {
      tx.set(ref, {
        ...mode,
        order,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      })
    })
  })
}

export function subscribeToUserDoc(uid, callback, onError) {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (err) => {
      console.error('[sync] user doc subscription failed', err)
      onError?.(err)
    }
  )
}

/** Persist the active mode so the app resumes exactly where the user left off. */
export async function updateActiveMode(uid, modeId) {
  if (!uid) return
  await setDoc(
    doc(db, 'users', uid),
    { 'settings.activeModeId': modeId },
    { merge: true },
  )
}

/** Merge a partial settings patch onto the user doc using dot notation to preserve nested fields. */
export async function updateSettings(uid, patch) {
  if (!uid || !patch) return
  const updateData = {}
  for (const [key, value] of Object.entries(patch)) {
    updateData[`settings.${key}`] = value
  }
  await setDoc(doc(db, 'users', uid), updateData, { merge: true })
}

/** Merge a partial profile patch onto the user doc using dot notation to preserve nested fields. */
export async function updateProfile(uid, patch) {
  if (!uid || !patch) return
  const updateData = {}
  for (const [key, value] of Object.entries(patch)) {
    updateData[`profile.${key}`] = value
  }
  await setDoc(doc(db, 'users', uid), updateData, { merge: true })
}

/** Helper to delete all documents in a collection in batched commits (up to 400 per batch). */
async function deleteCollectionDocs(colRef) {
  const snap = await getDocs(colRef)
  if (snap.empty) return
  const docs = snap.docs
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db)
    const chunk = docs.slice(i, i + 400)
    chunk.forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}

/**
 * Permanently delete all user workspace data (modes, subjects, tasks, timetable slots,
 * habits, todos, focus sessions, notes, checkins, ledger, devices) from Firestore,
 * clear local cache tokens and preferences, and reset the root user document to a
 * pristine first-time state with NO modes.
 *
 * @param {string} uid - Firebase Auth User UID
 * @param {import('firebase/auth').User} firebaseUser - Firebase Auth User object
 */
export async function resetAllUserData(uid, firebaseUser) {
  if (!uid) throw new Error('User ID is required to reset data')

  // 1. Delete all modes and all nested subcollections (subjects -> tasks, timetableSlots, goals)
  const modesCol = collection(db, 'users', uid, 'modes')
  const modesSnap = await getDocs(modesCol)
  for (const modeDoc of modesSnap.docs) {
    const modeId = modeDoc.id
    // Micro-Kanban tasks inside each subject
    const subjectsCol = collection(db, 'users', uid, 'modes', modeId, 'subjects')
    const subjectsSnap = await getDocs(subjectsCol)
    for (const subDoc of subjectsSnap.docs) {
      await deleteCollectionDocs(collection(db, 'users', uid, 'modes', modeId, 'subjects', subDoc.id, 'tasks'))
      await deleteDoc(subDoc.ref)
    }
    // Timetable slots
    await deleteCollectionDocs(collection(db, 'users', uid, 'modes', modeId, 'timetableSlots'))
    // Goals
    await deleteCollectionDocs(collection(db, 'users', uid, 'modes', modeId, 'goals'))
    // Mode document
    await deleteDoc(modeDoc.ref)
  }

  // 2. Delete all other workspace subcollections
  const otherCollections = ['habits', 'todos', 'checkins', 'focusSessions', 'notes', 'ledger', 'devices']
  for (const colName of otherCollections) {
    await deleteCollectionDocs(collection(db, 'users', uid, colName))
  }

  // 3. Reset root user document to pristine first-time defaults
  const rawDisplayName = firebaseUser?.displayName || 'Explorer'
  const nameParts = rawDisplayName.trim().split(/\s+/)
  const firstName = nameParts[0] || 'Explorer'
  const lastName = nameParts.slice(1).join(' ') || ''
  const uniqueCode = deriveUniqueCode(uid)

  const userRef = doc(db, 'users', uid)
  await setDoc(userRef, {
    profile: {
      firstName,
      lastName,
      displayName: rawDisplayName,
      email: firebaseUser?.email || '',
      photoURL: firebaseUser?.photoURL || '',
      uniqueCode,
      age: '',
      gender: 'male',
      createdAt: serverTimestamp(),
    },
    settings: {
      theme: 'dark',
      activeModeId: 'all',
      hydrationIntervalMin: 60,
      notificationsEnabled: false,
      geminiConfigured: false,
      // Note: onboarding is intentionally omitted so the workspace restarts like brand new
    },
    statsAggregate: {
      currentStreak: 0,
      longestSessionMin: 0,
      totalFocusMin: 0,
      activeDays: [],
      treesGrown: 0,
    },
  })

  // 4. Clear all local application settings and tokens from localStorage
  try {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('protrack:')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k))
  } catch (err) {
    console.warn('[reset] failed to clear localStorage keys', err)
  }

  // 5. Clear session storage and linked calendar credentials
  try {
    sessionStorage.clear()
  } catch {
    /* ignore session clear error */
  }

  try {
    clearCalToken()
  } catch {
    /* ignore token clear error */
  }
}
