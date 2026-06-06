const { onCall, HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

admin.initializeApp()

/**
 * mintDesktopToken — called by the authenticated phone after scanning the
 * desktop QR. Verifies the caller, mints a single-use Firebase custom token for
 * THAT user, and writes it onto the pending handshake doc so the waiting
 * desktop can sign in as the real user. The token never touches the client that
 * isn't authorized; the Admin SDK write bypasses Firestore rules by design.
 */
exports.mintDesktopToken = onCall(async (request) => {
  const uid = request.auth && request.auth.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first')

  const sessionId = request.data && request.data.sessionId
  if (!sessionId || typeof sessionId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing sessionId')
  }

  const ref = admin.firestore().collection('desktopHandshakes').doc(sessionId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Handshake not found or expired')
  }

  const data = snap.data()
  if (data.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'This code was already used')
  }
  if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError('deadline-exceeded', 'QR code expired — refresh and re-scan')
  }

  const token = await admin.auth().createCustomToken(uid)
  await ref.update({
    status: 'claimed',
    token,
    claimedBy: uid,
    claimedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return { ok: true }
})
