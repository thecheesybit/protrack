/**
 * Google Identity Services (GIS) OAuth token client — silent-refresh wrapper.
 *
 * Firebase's Google sign-in hands back a ~1 h access token that never refreshes,
 * which is why the calendar connection used to lapse hourly. GIS's token client
 * can mint a fresh access token WITHOUT a popup (`prompt: ''`) as long as the
 * user still has a live Google session and granted consent once — so the
 * connection behaves like a persistent login, with no server.
 *
 * Requires `VITE_GOOGLE_OAUTH_CLIENT_ID` (the project's OAuth *Web* client id)
 * and the GIS script (added in index.html). When the id is absent, or on the
 * Electron `file://` origin where GIS can't validate, `isGisAvailable()` is
 * false and callers fall back to the Firebase-popup / desktop-handshake path.
 *
 * Pure-ish: only touches `window.google`, an in-memory token cache, and
 * `secureStorage` (mirrored under the legacy key so existing readers keep
 * working). No React, no timers of its own.
 */
import { secureStorage } from '@/services/cryptoService'
import { isDesktop } from '@/desktop/isDesktop'

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '').trim()
const SCOPE = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events'
const AUTH_CORE_KEY = 'protrack:auth_core' // shared with calendarService for compatibility
const SKEW_MS = 2 * 60 * 1000 // treat a token as stale this long before its real expiry

let _tokenClient = null
let _cache = null // { access_token, expires_at }
let _pending = null // { resolve, reject } for the one in-flight requestAccessToken

/** True when GIS silent refresh can be used on this surface. */
export function isGisAvailable() {
  return Boolean(CLIENT_ID) && !isDesktop
}

/** Whether a client id is configured at all (desktop reads this for messaging). */
export function isGisConfigured() {
  return Boolean(CLIENT_ID)
}

function readCache() {
  if (_cache) return _cache
  try {
    const raw = secureStorage.getItemSync(AUTH_CORE_KEY)
    const obj = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null
    if (obj?.access_token) _cache = { access_token: obj.access_token, expires_at: obj.expires_at || 0 }
  } catch {
    _cache = null
  }
  return _cache
}

function writeCache(access_token, expires_in) {
  _cache = { access_token, expires_at: Date.now() + (Number(expires_in) || 3600) * 1000 }
  try {
    // Keep the legacy shape calendarService.getCalCredentials() expects.
    secureStorage.setItem(
      AUTH_CORE_KEY,
      JSON.stringify({ ...(_cache), refresh_token: 'gis_silent' }),
    )
  } catch {
    /* private mode — token still lives in memory for this session */
  }
}

export function clearGauthCache() {
  _cache = null
}

/** Resolve once `window.google.accounts.oauth2` exists (script is `async`). */
function gisReady(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const started = Date.now()
    const t = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(t)
        resolve()
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(t)
        reject(new Error('Google Identity Services failed to load'))
      }
    }, 120)
  })
}

async function ensureTokenClient() {
  if (_tokenClient) return _tokenClient
  await gisReady()
  _tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (resp) => {
      const p = _pending
      _pending = null
      if (!p) return
      if (resp?.error) {
        p.reject(new Error(resp.error_description || resp.error))
        return
      }
      writeCache(resp.access_token, resp.expires_in)
      p.resolve(_cache.access_token)
    },
    error_callback: (err) => {
      const p = _pending
      _pending = null
      if (p) p.reject(new Error(err?.type || 'popup_failed_to_open'))
    },
  })
  return _tokenClient
}

/**
 * Get an access token.
 * @param {{ interactive?: boolean }} opts
 *   interactive:true  → shows the Google consent popup (first connect / re-grant)
 *   interactive:false → silent (`prompt: ''`); rejects if consent/session is gone
 * @returns {Promise<string>} the access token
 */
export async function acquireToken({ interactive = false } = {}) {
  if (!isGisAvailable()) throw new Error('GIS token client is not available on this surface')
  const client = await ensureTokenClient()
  if (_pending) {
    // Coalesce: a request is already in flight.
    return new Promise((resolve, reject) => {
      const prev = _pending
      _pending = {
        resolve: (v) => { prev.resolve(v); resolve(v) },
        reject: (e) => { prev.reject(e); reject(e) },
      }
    })
  }
  return new Promise((resolve, reject) => {
    _pending = { resolve, reject }
    try {
      client.requestAccessToken({ prompt: interactive ? 'consent' : '' })
    } catch (e) {
      _pending = null
      reject(e)
    }
  })
}

/** Cached token if still fresh, else a silent refresh. Throws if silent fails. */
export async function ensureFreshToken() {
  const c = readCache()
  if (c?.access_token && c.expires_at - Date.now() > SKEW_MS) return c.access_token
  return acquireToken({ interactive: false })
}

/** Milliseconds until the cached token should be proactively refreshed (or 0). */
export function msUntilRefresh() {
  const c = readCache()
  if (!c?.expires_at) return 0
  return Math.max(0, c.expires_at - Date.now() - SKEW_MS - 30 * 1000)
}

/** Revoke the granted token (used by "Disconnect"). Best-effort. */
export function revokeToken() {
  const c = readCache()
  clearGauthCache()
  try {
    if (c?.access_token && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(c.access_token, () => {})
    }
  } catch {
    /* ignore */
  }
}
