import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { desktopBridge } from '@/desktop/isDesktop'

/**
 * Bind this physical machine to the account via its hardware fingerprint,
 * stored at users/{uid}/devices/{fingerprint}. The fingerprint is computed in
 * the Electron main process; raw hardware identifiers never reach Firestore.
 * Idempotent — boundAt is stamped once, lastSeen refreshes each launch.
 *
 * @param {string} uid
 * @returns {Promise<string|null>} the fingerprint id, or null if unavailable
 */
export async function bindDevice(uid) {
  if (!uid || !desktopBridge?.getDeviceFingerprint) return null
  const fp = await desktopBridge.getDeviceFingerprint()
  if (!fp?.id) return null

  const ref = doc(db, 'users', uid, 'devices', fp.id)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await setDoc(ref, { lastSeen: serverTimestamp() }, { merge: true })
  } else {
    await setDoc(ref, {
      label: fp.hostname || 'This device',
      platform: fp.platform || 'unknown',
      boundAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    })
  }
  return fp.id
}
