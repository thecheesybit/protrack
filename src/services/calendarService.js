import { GoogleAuthProvider } from 'firebase/auth'
import { doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { isDesktop } from '@/desktop/isDesktop'
import { nextOccurrence } from '@/lib/time'
import { addSlot, updateSlot, deleteSlot } from '@/services/timetableService'
import { updateTodo, deleteTodo } from '@/services/todoService'
import { signInWithGooglePopup } from '@/lib/authPopup'
import { itemToEvent, itemSignature, toMs } from '@/lib/gcalMap'
import { ymd } from '@/lib/dates'
import {
  isGisAvailable,
  isGisConfigured,
  acquireToken,
  ensureFreshToken,
  revokeToken as gisRevoke,
} from '@/lib/gauth'

/**
 * Google Calendar integration.
 *
 * Firebase's Google sign-in returns a short-lived OAuth access token (~1h) that
 * is NOT auto-refreshed, so we keep it in secureStorage and ask the user to
 * reconnect when it expires (401). The `calendar.events` scope is requested
 * on demand (separate consent) rather than at base login, to keep first-login
 * frictionless and avoid the sensitive-scope warning for non-calendar users.
 *
 * Because the token cannot refresh in the background on the Firebase Spark
 * (free) plan, sync is "live while the app is open": `useCalendarSync` runs
 * `syncEverything` on launch, on an interval, and on window focus, and surfaces
 * a single user-initiated "Reconnect Google Calendar" prompt (never an
 * automatic browser re-open) when the token lapses.
 */
const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events'
const AUTH_CORE_KEY = 'protrack:auth_core'
const SYNC_TOKEN_KEY = 'protrack:gcal_sync_tokens' // { [calendarId]: syncToken }
const PUSH_SIGS_KEY = 'protrack:gcal_push_sigs'
const LAST_SYNC_KEY = 'protrack:gcal_last_sync' // plain epoch ms — read by Settings
const CAL_LIST_KEY = 'protrack:gcal_calendars' // cached calendarList metadata

import { secureStorage } from '@/services/cryptoService'

/** Thrown when the Calendar token is missing/expired. The sync hook turns this
 *  into a single reconnect prompt — callers must NOT auto-reconnect. */
export class CalendarAuthError extends Error {
  constructor(message = 'Calendar session expired — please reconnect') {
    super(message)
    this.name = 'CalendarAuthError'
  }
}

/** Thrown when the Google Calendar API itself is misconfigured for the project
 *  (disabled, quota, billing) — needs a Cloud Console fix, not a reconnect. */
export class CalendarSetupError extends Error {
  constructor(message, consoleUrl) {
    super(message)
    this.name = 'CalendarSetupError'
    this.consoleUrl = consoleUrl || null
  }
}

/** Non-destructive: the token works, but this particular call needs a broader
 *  OAuth scope (e.g. reading the full calendar list). The connection stays up;
 *  callers degrade gracefully (e.g. fall back to the primary calendar). */
export class CalendarScopeError extends Error {
  constructor(message = 'Reconnect Google Calendar for full access') {
    super(message)
    this.name = 'CalendarScopeError'
  }
}

export function getCalCredentials() {
  const data = secureStorage.getItemSync(AUTH_CORE_KEY)
  if (!data) return null
  try {
    return typeof data === 'string' ? JSON.parse(data) : data
  } catch {
    // Graceful fallback for legacy btoa strings
    try {
      return JSON.parse(atob(data))
    } catch {
      return null
    }
  }
}

export function saveCalCredentials(creds) {
  secureStorage.setItem(AUTH_CORE_KEY, JSON.stringify(creds))
}

export function clearCalCredentials() {
  secureStorage.removeItem(AUTH_CORE_KEY)
}

export function getCalToken() {
  const creds = getCalCredentials()
  return creds?.access_token || null
}

export function isCalendarConnected() {
  return Boolean(getCalToken())
}

/**
 * Token for an API call: on the web with GIS configured, transparently mint a
 * fresh one (silent — no popup) when the cached token is stale; otherwise fall
 * back to whatever the connect flow stored.
 */
async function getFreshToken() {
  if (isGisAvailable()) {
    try {
      return await ensureFreshToken()
    } catch {
      // Silent refresh failed (consent revoked / no Google session) — surface
      // as an auth error so the hook shows one reconnect prompt.
      throw new CalendarAuthError()
    }
  }
  const token = getCalToken()
  if (!token) throw new CalendarAuthError('Calendar not connected')
  return token
}

export function clearCalToken() {
  clearCalCredentials()
}

/** Last successful sync, as epoch ms (or 0 if never). Cheap synchronous read. */
export function getLastSyncAt() {
  try {
    return Number(localStorage.getItem(LAST_SYNC_KEY)) || 0
  } catch {
    return 0
  }
}

function stampLastSync() {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
  } catch {
    /* private mode — Settings just won't show a last-sync time */
  }
}

export async function connectCalendar() {
  if (!auth) throw new Error('Firebase is not configured for this build.')

  if (isDesktop) {
    const uid = auth.currentUser?.uid
    if (!uid) {
      throw new Error('You must be signed in to connect Google Calendar.')
    }

    const handshakeRef = doc(db, 'users', uid, 'gcal', 'handshake')
    await setDoc(handshakeRef, {
      status: 'pending',
      createdAt: Date.now()
    })

    return new Promise((resolve, reject) => {
      let unsubscribe = () => {}

      const timeoutId = setTimeout(async () => {
        unsubscribe()
        await deleteDoc(handshakeRef).catch(() => {})
        reject(new Error('Google Calendar connection timed out. Please try again.'))
      }, 5 * 60 * 1000)

      unsubscribe = onSnapshot(
        handshakeRef,
        async (snapshot) => {
          if (!snapshot.exists()) return
          const data = snapshot.data()
          if (data && data.status === 'success' && data.accessToken) {
            clearTimeout(timeoutId)
            unsubscribe()
            // Clean up from Firestore immediately
            await deleteDoc(handshakeRef).catch((e) => console.error('Error deleting handshake:', e))

            const creds = {
              access_token: data.accessToken,
              expires_at: data.expiresAt || (Date.now() + 3599 * 1000),
              refresh_token: 'mock_gcal_refresh_token'
            }
            saveCalCredentials(creds)
            resolve(data.accessToken)
          } else if (data && data.status === 'error') {
            clearTimeout(timeoutId)
            unsubscribe()
            await deleteDoc(handshakeRef).catch(() => {})
            reject(new Error(data.error || 'Failed to authenticate Google Calendar in browser'))
          }
        },
        (err) => {
          clearTimeout(timeoutId)
          unsubscribe()
          reject(err)
        }
      )

      // Open in default browser
      const webUrl = import.meta.env.VITE_WEB_URL || 'https://pro-track-app.netlify.app'
      window.open(`${webUrl}/link-gcal?uid=${uid}`, '_blank')
    })
  }

  // ── Web: prefer GIS (persistent silent refresh) when a client id is set ──
  if (isGisAvailable()) {
    // One consent popup; from here on ensureFreshToken() renews silently.
    return acquireToken({ interactive: true })
  }

  // Fallback: the Firebase Google popup token (lapses ~hourly, no refresh).
  const provider = new GoogleAuthProvider()
  provider.addScope(CAL_SCOPE)
  provider.setCustomParameters({ prompt: 'consent' })
  const result = await signInWithGooglePopup(auth, provider)
  const credential = GoogleAuthProvider.credentialFromResult(result)
  const token = credential?.accessToken
  if (!token) throw new Error('No calendar access token returned')

  saveCalCredentials({
    access_token: token,
    expires_at: Date.now() + 3599 * 1000,
    refresh_token: 'mock_gcal_refresh_token',
  })
  return token
}

/** Disconnect: revoke the GIS grant (if any) and drop all local sync state. */
export function disconnectCalendar() {
  try {
    if (isGisConfigured()) gisRevoke()
  } catch {
    /* ignore */
  }
  clearCalCredentials()
  try {
    secureStorage.removeItem(SYNC_TOKEN_KEY)
    secureStorage.removeItem(PUSH_SIGS_KEY)
    secureStorage.removeItem(CAL_LIST_KEY)
    localStorage.removeItem(LAST_SYNC_KEY)
  } catch {
    /* ignore */
  }
}

const GCAL_BASE = 'https://www.googleapis.com/calendar/v3'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Pull the machine-readable reason out of a Google API error body. */
function parseGoogleError(body, status) {
  const e = body?.error || {}
  const reason = e.errors?.[0]?.reason || e.status || ''
  const message = e.message || `Calendar API error ${status}`
  return { reason, message }
}

/**
 * One Calendar API call with: transparent silent token refresh, a single
 * refresh-and-retry on 401/insufficient-scope, exponential backoff on
 * rate-limit / 5xx, and typed errors for the "fix it in Cloud Console" class.
 */
async function calFetch(path, options = {}, _attempt = 0) {
  let token
  try {
    token = await getFreshToken()
  } catch (err) {
    throw err instanceof CalendarAuthError ? err : new CalendarAuthError(err.message)
  }

  const res = await fetch(`${GCAL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (res.status === 204) return {} // DELETE returns no body
  if (res.ok) return res.json()

  let body = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON error body */
  }
  const { reason, message } = parseGoogleError(body, res.status)

  // ── Missing scope (token is otherwise fine) → non-destructive, degrade
  if (
    res.status === 403 &&
    (reason === 'insufficientPermissions' ||
      reason === 'insufficientScopes' ||
      /insufficient (authentication scopes|permission)/i.test(message))
  ) {
    // On the web with GIS we can silently re-grant the wider scope once.
    if (_attempt === 0 && isGisAvailable()) {
      try {
        await acquireToken({ interactive: false })
        return calFetch(path, options, _attempt + 1)
      } catch {
        /* fall through — caller degrades (e.g. primary-only) */
      }
    }
    throw new CalendarScopeError()
  }

  // ── Auth: token expired / revoked → one silent refresh, then reconnect prompt
  if (res.status === 401 || reason === 'authError') {
    if (_attempt === 0 && isGisAvailable()) {
      try {
        await acquireToken({ interactive: false })
        return calFetch(path, options, _attempt + 1)
      } catch {
        /* fall through to the reconnect prompt */
      }
    }
    clearCalToken()
    throw new CalendarAuthError()
  }

  // ── Project misconfig: API disabled / billing / quota project-wide
  if (
    res.status === 403 &&
    (reason === 'accessNotConfigured' ||
      reason === 'accessNotConfiguredHelp' ||
      /has not been used in project|is disabled|enable it by visiting/i.test(message))
  ) {
    const project = firebaseProjectId()
    throw new CalendarSetupError(
      'The Google Calendar API is not enabled for this project. Enable it in the Cloud Console, then reconnect.',
      project
        ? `https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=${project}`
        : 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com',
    )
  }

  // ── Transient: rate limit / backend error → backoff and retry (max 3)
  if (
    res.status === 429 ||
    res.status === 500 ||
    res.status === 503 ||
    reason === 'rateLimitExceeded' ||
    reason === 'userRateLimitExceeded' ||
    reason === 'backendError'
  ) {
    if (_attempt < 3) {
      await sleep([600, 1800, 4000][_attempt])
      return calFetch(path, options, _attempt + 1)
    }
  }

  const err = new Error(message)
  err.status = res.status
  err.reason = reason
  throw err
}

function firebaseProjectId() {
  try {
    return import.meta.env.VITE_FIREBASE_PROJECT_ID || auth?.app?.options?.projectId || null
  } catch {
    return null
  }
}

/**
 * Previously retried a 401 by silently calling connectCalendar() — on desktop
 * that re-opened the browser in a loop. Now a 401 propagates as CalendarAuthError
 * and the sync hook shows one reconnect prompt. Kept as a named wrapper so the
 * existing call sites don't churn.
 */
async function calFetchWithRetry(path, options = {}) {
  return calFetch(path, options)
}

/** Pull — upcoming events from the primary calendar (direct API). */
export async function listUpcomingEvents(maxResults = 8) {
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  })
  const data = await calFetchWithRetry(`/calendars/primary/events?${params}`)
  return data.items || []
}

/** Push — create/update a recurring weekly event for a slot. Returns eventId. */
export async function pushSlotToCalendar(slot) {
  const { startISO, endISO } = nextOccurrence(slot.dayOfWeek, slot.startMin, slot.endMin)
  const body = {
    summary: slot.label || 'PRO TRACK session',
    description: 'Synced from PRO TRACK',
    start: { dateTime: startISO },
    end: { dateTime: endISO },
    recurrence: ['RRULE:FREQ=WEEKLY'],
  }
  const event =
    slot.googleEventId
      ? await calFetchWithRetry(`/calendars/primary/events/${slot.googleEventId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await calFetchWithRetry(`/calendars/primary/events`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
  return event.id
}

/**
 * Pull Google Calendar events into local timetable slots.
 * De-duplicates by googleEventId — updates existing synced slots,
 * creates new ones for unseen events.
 */
export async function pullEventsToSlots(uid, modeId, existingSlots = [], defaultColor = '#6366f1') {
  const events = await listUpcomingEvents(50)
  const synced = []

  for (const event of events) {
    if (!event.start?.dateTime || !event.end?.dateTime) continue

    const startDate = new Date(event.start.dateTime)
    const endDate = new Date(event.end.dateTime)

    // Convert JS date day (0=Sun) to our internal system (0=Mon)
    const jsDay = startDate.getDay()
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1

    const startMin = startDate.getHours() * 60 + startDate.getMinutes()
    const endMin = endDate.getHours() * 60 + endDate.getMinutes()

    if (startMin >= endMin) continue // skip invalid slots (e.g. all-day events)

    // Check if this event already exists as a synced slot
    const existing = existingSlots.find((s) => s.googleEventId === event.id)

    const slotData = {
      label: event.summary || 'Google Calendar event',
      dayOfWeek,
      startMin,
      endMin,
      color: defaultColor,
      googleEventId: event.id,
      source: 'gcal',
      recurrenceType: 'weekly',
      tag: 'Google Cal',
      tagStyle: 'dashed',
    }

    try {
      if (existing) {
        await updateSlot(uid, modeId, existing.id, slotData)
        synced.push({ ...slotData, id: existing.id, action: 'updated' })
      } else {
        const ref = await addSlot(uid, modeId, slotData)
        synced.push({ ...slotData, id: ref.id, action: 'created' })
      }
    } catch (err) {
      console.error('[calendar] failed to sync event', event.id, err)
    }
  }

  return synced
}

/**
 * Bi-directional sync orchestrator (slots only — legacy entry point kept for
 * the "Sync now" button in the widget). `syncEverything` is the full path.
 * 1. Pull Google Calendar events → create/update local slots
 * 2. Push local slots (without googleEventId) → Google Calendar
 */
export async function syncCalendar(uid, modeId, existingSlots = [], defaultColor) {
  const results = { pulled: [], pushed: [] }

  // 1. Pull from Google
  try {
    results.pulled = await pullEventsToSlots(uid, modeId, existingSlots, defaultColor)
  } catch (err) {
    console.error('[calendar] pull failed', err)
    throw err
  }

  // 2. Push local-only slots to Google
  const localOnly = existingSlots.filter((s) => !s.googleEventId && s.source !== 'gcal')
  for (const slot of localOnly) {
    try {
      const eventId = await pushSlotToCalendar(slot)
      await updateSlot(uid, modeId, slot.id, { googleEventId: eventId })
      results.pushed.push({ ...slot, googleEventId: eventId })
    } catch (err) {
      console.error('[calendar] push failed for slot', slot.id, err)
    }
  }

  return results
}

/* ── Full two-way live sync (everything with a time) ─────── */

async function readPushSigs() {
  try {
    return JSON.parse((await secureStorage.getItem(PUSH_SIGS_KEY)) || '{}') || {}
  } catch {
    return {}
  }
}
async function writePushSigs(sigs) {
  await secureStorage.setItem(PUSH_SIGS_KEY, JSON.stringify(sigs))
}

/** Read/write the { [calendarId]: syncToken } map used for delta pulls. */
async function readSyncTokens() {
  try {
    return JSON.parse((await secureStorage.getItem(SYNC_TOKEN_KEY)) || '{}') || {}
  } catch {
    return {}
  }
}
async function writeSyncTokens(map) {
  await secureStorage.setItem(SYNC_TOKEN_KEY, JSON.stringify(map || {}))
}

/**
 * Every calendar the user can see — primary, secondary, subscribed, holidays,
 * shared. `accessRole` in {owner, writer} means we may push to it; {reader,
 * freeBusyReader} is display-only. Cached so a transient failure still renders.
 */
const PRIMARY_FALLBACK = [
  { id: 'primary', name: 'Primary', color: '#4285f4', accessRole: 'owner', primary: true, writable: true },
]

export async function listCalendars() {
  try {
    const data = await calFetch('/users/me/calendarList?minAccessRole=freeBusyReader&maxResults=250')
    const cals = (data.items || [])
      .filter((c) => c.selected !== false && c.deleted !== true)
      .map((c) => ({
        id: c.id,
        name: c.summaryOverride || c.summary || c.id,
        color: c.backgroundColor || '#6366f1',
        accessRole: c.accessRole || 'reader',
        primary: Boolean(c.primary),
        writable: c.accessRole === 'owner' || c.accessRole === 'writer',
      }))
    if (cals.length) {
      try {
        await secureStorage.setItem(CAL_LIST_KEY, JSON.stringify(cals))
      } catch {
        /* ignore */
      }
    }
    return cals.length ? cals : PRIMARY_FALLBACK
  } catch (err) {
    // A genuinely expired token / disabled API must still bubble up.
    if (err instanceof CalendarAuthError || err instanceof CalendarSetupError) throw err
    // Missing the broad scope, or any transient list failure → keep syncing the
    // primary calendar (readable with just `calendar.events`). The caller
    // surfaces "reconnect for holidays & all calendars" as a gentle nudge.
    try {
      const cached = JSON.parse((await secureStorage.getItem(CAL_LIST_KEY)) || '[]')
      if (cached.length) return cached
    } catch {
      /* ignore */
    }
    return PRIMARY_FALLBACK
  }
}

export async function getCachedCalendars() {
  try {
    return JSON.parse((await secureStorage.getItem(CAL_LIST_KEY)) || '[]') || []
  } catch {
    return []
  }
}

const HOLIDAY_RE = /#holiday@|holiday\.calendar\.google/i

/** Normalize a raw Google event into the local display shape (no Firestore). */
function normalizeGcalEvent(ev, cal) {
  if (!ev || ev.status === 'cancelled' || (!ev.start)) return null
  const allDay = Boolean(ev.start.date && !ev.start.dateTime)
  const startMs = toMs(ev.start.dateTime || ev.start.date)
  let endMs = toMs(ev.end?.dateTime || ev.end?.date)
  if (allDay && endMs) endMs -= 1 // Google's all-day end is exclusive
  const start = startMs ? new Date(startMs) : null
  const end = endMs ? new Date(endMs) : null
  return {
    id: `${cal.id}::${ev.id}`,
    eventId: ev.id,
    calendarId: cal.id,
    calendarName: cal.name,
    color: cal.color,
    title: ev.summary || (HOLIDAY_RE.test(cal.id) ? 'Holiday' : '(busy)'),
    description: (ev.description || '').slice(0, 500),
    location: ev.location || '',
    htmlLink: ev.htmlLink || '',
    allDay,
    isHoliday: HOLIDAY_RE.test(cal.id),
    readonly: !cal.writable,
    startMs,
    endMs,
    dateStr: start ? ymd(start) : null,
    startMin: allDay || !start ? null : start.getHours() * 60 + start.getMinutes(),
    endMin: allDay || !end ? null : end.getHours() * 60 + end.getMinutes(),
    updated: ev.updated ? toMs(ev.updated) : null,
    recurringEventId: ev.recurringEventId || null,
  }
}

/**
 * Pull changed events from EVERY visible calendar. Returns normalized display
 * events (local only — never written to Firestore) plus the fresh syncToken map
 * and the set of eventIds that were cancelled since the last pull.
 */
async function pullAllCalendars() {
  const cals = await listCalendars()
  const scopeLimited = cals === PRIMARY_FALLBACK // degraded — token lacks the wide read scope
  const tokens = await readSyncTokens()
  const nextTokens = {}
  const events = []
  const cancelled = new Set()

  for (const cal of cals) {
    let syncToken = tokens[cal.id] || null
    let pageToken = null
    for (let guard = 0; guard < 20; guard++) {
      const params = new URLSearchParams({ maxResults: '250', singleEvents: 'true' })
      if (pageToken) params.set('pageToken', pageToken)
      if (syncToken) {
        params.set('syncToken', syncToken)
      } else {
        // First sync (or a reset token): a wide window so the month views have
        // holidays + upcoming events straight away without an unbounded read.
        params.set('timeMin', new Date(Date.now() - 45 * 86400000).toISOString())
        params.set('timeMax', new Date(Date.now() + 400 * 86400000).toISOString())
        params.set('showDeleted', 'true')
      }
      let page
      try {
        page = await calFetch(`/calendars/${encodeURIComponent(cal.id)}/events?${params}`)
      } catch (err) {
        if (err.status === 410) {
          // Server dropped the token — restart this calendar's full window once.
          syncToken = null
          pageToken = null
          continue
        }
        // A genuinely expired token / disabled API must still surface.
        if (err instanceof CalendarAuthError || err instanceof CalendarSetupError) throw err
        // Otherwise one bad calendar (scope, 404, transient) must not abort the sync.
        break
      }
      for (const ev of page.items || []) {
        if (ev.status === 'cancelled') {
          cancelled.add(ev.id)
          continue
        }
        const norm = normalizeGcalEvent(ev, cal)
        if (norm) events.push(norm)
      }
      if (page.nextPageToken) {
        pageToken = page.nextPageToken
        continue
      }
      if (page.nextSyncToken) nextTokens[cal.id] = page.nextSyncToken
      break
    }
  }

  return { events, nextTokens, cancelled, calendars: cals, scopeLimited }
}

/**
 * Full bidirectional "live while open" sync for everything with a time —
 * recurring slots, one-time events, and dated to-dos/tasks — in both directions,
 * including deletes. All client-side direct Calendar API; no server.
 *
 * PULL is display-only: events from every visible calendar (primary, secondary,
 * subscribed, holidays, shared, Gmail-generated flights/tickets/reservations)
 * are returned in `out.events` for a local cache — NOT written to Firestore, so
 * hundreds of holiday entries cost zero write quota. PUSH is two-way: local
 * slots / dated to-dos / dated notes are created & patched on the user's primary
 * calendar and deleted there when removed locally. Read-only calendars are never
 * pushed to.
 *
 * @param {string} uid
 * @param {{ modes: Array, inboxModeId: string, slots: Array, todos: Array, notes?: Array, tasks?: Array }} ctx
 * @returns {Promise<{pulled:number, pushed:number, patched:number, deleted:number,
 *   errors:string[], events:Array, calendars:Array}>}
 */
export async function syncEverything(uid, { modes = [], inboxModeId, slots = [], todos = [], notes = [], tasks = [] }) {
  if (!uid) return { pulled: 0, pushed: 0, patched: 0, deleted: 0, errors: ['no uid'], events: [], calendars: [] }
  if (!isCalendarConnected()) throw new CalendarAuthError('Calendar not connected')

  const inbox = inboxModeId || modes[0]?.id
  const out = { pulled: 0, pushed: 0, patched: 0, deleted: 0, errors: [], events: [], calendars: [] }

  const slotModeId = (s) => s._modeId || inbox
  let nextTokens = null

  /* 0 ── one-time cleanup of the pre-v2.2.2 sync that wrote gcal → to-dos ── */
  try {
    if (!(await secureStorage.getItem('protrack:gcal_migrated_v2'))) {
      for (const t of todos) {
        if (t.source === 'gcal' && t.googleEventId) {
          await deleteTodo(uid, t.id).catch(() => {})
        }
      }
      for (const s of slots) {
        if (s.source === 'gcal' && s.googleEventId) {
          await deleteSlot(uid, slotModeId(s), s.id).catch(() => {})
        }
      }
      await secureStorage.setItem('protrack:gcal_migrated_v2', '1')
    }
  } catch {
    /* non-fatal */
  }

  /* 1 ── PULL: all calendars → local display cache (no Firestore) ─────────── */
  try {
    const { events, nextTokens: tok, calendars, scopeLimited } = await pullAllCalendars()
    nextTokens = tok
    out.events = events
    out.calendars = calendars
    out.pulled = events.length
    out.scopeLimited = Boolean(scopeLimited)
  } catch (err) {
    if (err instanceof CalendarAuthError || err instanceof CalendarSetupError) throw err
    out.errors.push(`pull: ${err.message}`)
  }

  /* 2 ── PUSH: create/patch/delete remote from local ────── */
  const sigs = await readPushSigs()
  const seenEventIds = new Set()

  const pushable = [
    ...slots
      .filter((s) => s.source !== 'gcal')
      .map((s) => ({ item: s, write: (id) => updateSlot(uid, slotModeId(s), s.id, { googleEventId: id }) })),
    ...todos
      .filter((t) => t.source !== 'gcal' && !t.done && (t.type === 'event' || t.dueAt))
      .map((t) => ({ item: t, write: (id) => updateTodo(uid, t.id, { googleEventId: id }) })),
    ...notes
      .filter((n) => n.source !== 'gcal' && n.dueAt)
      .map((n) => ({ item: { text: n.title || n.text || 'Note', dueAt: n.dueAt, allDay: n.allDay, googleEventId: n.googleEventId, id: n.id }, write: null })),
    ...tasks
      .filter((t) => t.column !== 'done' && t.dueAt)
      .map((t) => ({ item: t, write: null })), // no app-wide task writer yet
  ]

  for (const { item, write } of pushable) {
    const body = itemToEvent(item)
    if (!body) continue
    // Notify in Google Calendar too — a 30-min popup on everything we push.
    body.reminders = { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] }
    try {
      if (!item.googleEventId) {
        if (!write) continue // can't persist the id back — skip silently
        const created = await calFetch('/calendars/primary/events', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        if (created?.id) {
          await write(created.id)
          sigs[created.id] = itemSignature(item)
          seenEventIds.add(created.id)
          out.pushed++
        }
      } else {
        seenEventIds.add(item.googleEventId)
        const sig = itemSignature(item)
        if (sigs[item.googleEventId] !== sig) {
          // Skip re-pushing a copy that GCal itself just gave us this run.
          if (item.source !== 'gcal' || sigs[item.googleEventId] !== undefined) {
            await calFetch(`/calendars/primary/events/${item.googleEventId}`, {
              method: 'PATCH',
              body: JSON.stringify(body),
            })
            out.patched++
          }
          sigs[item.googleEventId] = sig
        }
      }
    } catch (err) {
      if (err instanceof CalendarAuthError) throw err
      out.errors.push(`push ${item.id}: ${err.message}`)
    }
  }

  /* 3 ── DELETE reconciliation: local gone → remove remote ─ */
  for (const eventId of Object.keys(sigs)) {
    if (seenEventIds.has(eventId)) continue
    try {
      await calFetch(`/calendars/primary/events/${eventId}`, { method: 'DELETE' })
      out.deleted++
    } catch (err) {
      // 404/410 just means it's already gone — still drop the local signature.
      if (err instanceof CalendarAuthError) throw err
      if (err.status !== 404 && err.status !== 410) {
        out.errors.push(`delete ${eventId}: ${err.message}`)
      }
    }
    delete sigs[eventId]
  }

  await writePushSigs(sigs)
  if (nextTokens) await writeSyncTokens(nextTokens)
  stampLastSync()
  return out
}

/** Wipe all sync bookkeeping — call on disconnect so a reconnect starts clean. */
export function resetCalendarSyncState() {
  clearCalToken()
  secureStorage.removeItem(SYNC_TOKEN_KEY)
  secureStorage.removeItem(PUSH_SIGS_KEY)
  try {
    localStorage.removeItem(LAST_SYNC_KEY)
  } catch {
    /* ignore */
  }
}
