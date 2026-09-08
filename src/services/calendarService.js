import { GoogleAuthProvider } from 'firebase/auth'
import { doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { isDesktop } from '@/desktop/isDesktop'
import { nextOccurrence } from '@/lib/time'
import { addSlot, updateSlot, deleteSlot } from '@/services/timetableService'
import { addTodo, updateTodo, deleteTodo } from '@/services/todoService'
import { signInWithGooglePopup } from '@/lib/authPopup'
import { eventToItem, itemToEvent, itemSignature, mergeStrategy } from '@/lib/gcalMap'

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
const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const AUTH_CORE_KEY = 'protrack:auth_core'
const SYNC_TOKEN_KEY = 'protrack:gcal_sync_token'
const PUSH_SIGS_KEY = 'protrack:gcal_push_sigs'
const LAST_SYNC_KEY = 'protrack:gcal_last_sync' // plain epoch ms — read by Settings

import { secureStorage } from '@/services/cryptoService'

/** Thrown when the Calendar token is missing/expired. The sync hook turns this
 *  into a single reconnect prompt — callers must NOT auto-reconnect. */
export class CalendarAuthError extends Error {
  constructor(message = 'Calendar session expired — please reconnect') {
    super(message)
    this.name = 'CalendarAuthError'
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

  const provider = new GoogleAuthProvider()
  provider.addScope(CAL_SCOPE)
  provider.setCustomParameters({ prompt: 'consent' })
  // Retries once against the popup/third-party-cookie failure class
  // (auth/internal-error and friends). Runs only in a real browser tab (the
  // isDesktop branch above never reaches here), so this cannot affect Electron.
  const result = await signInWithGooglePopup(auth, provider)
  const credential = GoogleAuthProvider.credentialFromResult(result)
  const token = credential?.accessToken
  if (!token) throw new Error('No calendar access token returned')

  // Store securely under protrack:auth_core
  saveCalCredentials({
    access_token: token,
    expires_at: Date.now() + 3599 * 1000,
    refresh_token: 'mock_gcal_refresh_token'
  })
  return token
}

async function calFetch(path, options = {}) {
  const token = getCalToken()
  if (!token) throw new CalendarAuthError('Calendar not connected')
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (res.status === 401) {
    clearCalToken()
    throw new CalendarAuthError()
  }
  if (res.status === 204) return {} // DELETE returns no body
  if (!res.ok) {
    const err = new Error(`Calendar API error ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
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

async function readSyncToken() {
  return (await secureStorage.getItem(SYNC_TOKEN_KEY)) || null
}
async function writeSyncToken(token) {
  if (token) await secureStorage.setItem(SYNC_TOKEN_KEY, token)
}
async function clearSyncToken() {
  secureStorage.removeItem(SYNC_TOKEN_KEY)
}
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

/** One page of primary-calendar events. Handles the syncToken vs. timeMin split. */
async function fetchEventsPage({ syncToken, pageToken }) {
  const params = new URLSearchParams({ maxResults: '250' })
  if (pageToken) params.set('pageToken', pageToken)
  if (syncToken) {
    params.set('syncToken', syncToken)
  } else {
    // Full sync window: a week back covers recently-moved items without an
    // unbounded read. singleEvents expands recurrences to instances.
    params.set('timeMin', new Date(Date.now() - 7 * 86400000).toISOString())
    params.set('singleEvents', 'true')
    params.set('showDeleted', 'true')
  }
  return calFetch(`/calendars/primary/events?${params}`)
}

/** Collect every changed event since the stored syncToken (or a full window). */
async function pullChangedEvents() {
  let syncToken = await readSyncToken()
  let items = []
  let pageToken = null
  let nextSyncToken = null

  for (let guard = 0; guard < 20; guard++) {
    let page
    try {
      page = await fetchEventsPage({ syncToken, pageToken })
    } catch (err) {
      if (err.status === 410) {
        // Token expired server-side — drop it and restart a full sync once.
        await clearSyncToken()
        syncToken = null
        pageToken = null
        items = []
        continue
      }
      throw err
    }
    items = items.concat(page.items || [])
    if (page.nextPageToken) {
      pageToken = page.nextPageToken
      continue
    }
    nextSyncToken = page.nextSyncToken || null
    break
  }

  return { items, nextSyncToken }
}

/**
 * Full bidirectional "live while open" sync for everything with a time —
 * recurring slots, one-time events, and dated to-dos/tasks — in both directions,
 * including deletes. All client-side direct Calendar API; no server.
 *
 * @param {string} uid
 * @param {{ modes: Array, inboxModeId: string, slots: Array, todos: Array, tasks?: Array }} ctx
 *        `slots` should be the cross-mode list (each tagged `_modeId`); `todos`
 *        are the decrypted todos (events = those with `type:'event'`). `tasks`
 *        has no app-wide source (free-tier: no collectionGroup listener) — pass
 *        [] for now; see the `DAY_TASKS` note in TimetableWidget.
 * @returns {Promise<{pulled:number, pushed:number, patched:number, deleted:number, errors:string[]}>}
 */
export async function syncEverything(uid, { modes = [], inboxModeId, slots = [], todos = [], tasks = [] }) {
  if (!uid) return { pulled: 0, pushed: 0, patched: 0, deleted: 0, errors: ['no uid'] }
  if (!isCalendarConnected()) throw new CalendarAuthError('Calendar not connected')

  const inbox = inboxModeId || modes[0]?.id
  const out = { pulled: 0, pushed: 0, patched: 0, deleted: 0, errors: [] }

  const slotModeId = (s) => s._modeId || inbox
  const findByEventId = (id) => ({
    slot: slots.find((s) => s.googleEventId === id),
    todo: todos.find((t) => t.googleEventId === id),
  })

  /* 1 ── PULL: apply remote changes locally ─────────────── */
  let nextSyncToken = null
  try {
    const { items, nextSyncToken: tok } = await pullChangedEvents()
    nextSyncToken = tok

    for (const ev of items) {
      const mapped = eventToItem(ev)
      if (!mapped) continue
      const { slot, todo } = findByEventId(mapped.googleEventId)

      try {
        if (mapped.kind === 'cancelled') {
          if (slot) {
            await deleteSlot(uid, slotModeId(slot), slot.id)
            out.deleted++
          } else if (todo) {
            await deleteTodo(uid, todo.id)
            out.deleted++
          }
          continue
        }

        if (mapped.kind === 'slot') {
          const patch = {
            label: mapped.label,
            dayOfWeek: mapped.dayOfWeek,
            startMin: mapped.startMin,
            endMin: mapped.endMin,
            googleEventId: mapped.googleEventId,
            source: 'gcal',
            recurrenceType: 'weekly',
          }
          if (slot) {
            if (mergeStrategy(null, mapped.updated) === 'remote') {
              await updateSlot(uid, slotModeId(slot), slot.id, patch)
              out.pulled++
            }
          } else {
            await addSlot(uid, inbox, {
              ...patch,
              color: modes.find((m) => m.id === inbox)?.accentColor || '#6366f1',
              tag: 'Google Cal',
              tagStyle: 'dashed',
            })
            out.pulled++
          }
          continue
        }

        // mapped.kind === 'todo'
        if (todo) {
          if (mergeStrategy(null, mapped.updated) === 'remote') {
            const patch = mapped.type === 'event'
              ? { text: mapped.text, type: 'event', eventDate: mapped.eventDate, eventStartMin: mapped.eventStartMin, eventEndMin: mapped.eventEndMin }
              : { text: mapped.text, dueAt: mapped.dueAt }
            await updateTodo(uid, todo.id, patch)
            out.pulled++
          }
        } else {
          const base = { text: mapped.text, modeId: inbox, googleEventId: mapped.googleEventId, source: 'gcal' }
          if (mapped.type === 'event') {
            await addTodo(uid, { ...base, type: 'event', eventDate: mapped.eventDate, eventStartMin: mapped.eventStartMin, eventEndMin: mapped.eventEndMin })
          } else {
            await addTodo(uid, { ...base, dueAt: mapped.dueAt })
          }
          out.pulled++
        }
      } catch (err) {
        out.errors.push(`pull ${mapped.googleEventId}: ${err.message}`)
      }
    }
  } catch (err) {
    if (err instanceof CalendarAuthError) throw err
    out.errors.push(`pull: ${err.message}`)
  }

  /* 2 ── PUSH: create/patch/delete remote from local ────── */
  const sigs = await readPushSigs()
  const seenEventIds = new Set()

  const pushable = [
    ...slots.map((s) => ({ item: s, write: (id) => updateSlot(uid, slotModeId(s), s.id, { googleEventId: id }) })),
    ...todos
      .filter((t) => !t.done && (t.type === 'event' || t.dueAt))
      .map((t) => ({ item: t, write: (id) => updateTodo(uid, t.id, { googleEventId: id }) })),
    ...tasks
      .filter((t) => t.column !== 'done' && t.dueAt)
      .map((t) => ({ item: t, write: null })), // no app-wide task writer yet
  ]

  for (const { item, write } of pushable) {
    const body = itemToEvent(item)
    if (!body) continue
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
  if (nextSyncToken) await writeSyncToken(nextSyncToken)
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
