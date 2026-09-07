import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth'

/**
 * Google Sign-In via `signInWithPopup` has been increasingly fragile across
 * real browsers since Chrome's third-party-cookie phase-out and Google's
 * FedCM rollout (2024+) — it can throw `auth/internal-error` (and friends)
 * intermittently even when the account/network/config are all fine, often
 * succeeding a moment later or via a full-page redirect instead. This module
 * centralizes the resilience so every call site doesn't reinvent it.
 */
const POPUP_FAILURE_CODES = new Set([
  'auth/internal-error',
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/web-storage-unsupported',
])

/**
 * Google popup sign-in with one automatic retry against the popup/third-party-
 * cookie failure class (real user cancellation is never retried or redirected).
 *
 * @param {import('firebase/auth').Auth} auth
 * @param {import('firebase/auth').AuthProvider} provider
 * @param {{ allowRedirectFallback?: boolean }} [opts]
 *   Set true only where a full-page redirect is safe to initiate — i.e. a real
 *   browser tab the user can be returned to. NEVER set this for the Electron
 *   desktop shell: its main window blocks in-place navigation to external URLs
 *   (electron/main.js `will-navigate`), so a redirect would just silently fail
 *   to leave the app, orphaning the sign-in attempt.
 * @returns {Promise<import('firebase/auth').UserCredential|null>}
 *   The credential, or null if it fell back to a redirect (page is navigating
 *   away — the caller must resume with `completePendingRedirect` on next load).
 */
export async function signInWithGooglePopup(auth, provider, { allowRedirectFallback = false } = {}) {
  try {
    return await signInWithPopup(auth, provider)
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') throw err
    if (!POPUP_FAILURE_CODES.has(err.code)) throw err
    console.warn('[auth] popup sign-in failed once, retrying:', err.code)
    try {
      return await signInWithPopup(auth, provider)
    } catch (err2) {
      if (err2.code === 'auth/popup-closed-by-user') throw err2
      if (!allowRedirectFallback || !POPUP_FAILURE_CODES.has(err2.code)) throw err2
      console.warn('[auth] popup sign-in failed twice, falling back to redirect:', err2.code)
      await signInWithRedirect(auth, provider)
      return null
    }
  }
}

/**
 * Call on mount of any page that may be the return leg of a
 * `signInWithRedirect`. Resolves to the credential result, or null if this
 * load isn't a redirect return (the common case) or the redirect itself
 * failed (e.g. the user denied consent).
 */
export async function completePendingRedirect(auth) {
  try {
    return await getRedirectResult(auth)
  } catch (err) {
    console.warn('[auth] redirect result failed', err)
    return null
  }
}

/** User-facing copy for the popup/cookie failure class; falls back to the raw message. */
export function friendlyAuthError(err) {
  if (POPUP_FAILURE_CODES.has(err?.code)) {
    return 'Sign-in was blocked by your browser (often third-party cookies or pop-ups). Allow pop-ups for this site and try again.'
  }
  return err?.message || 'Sign-in failed.'
}
