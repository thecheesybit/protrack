import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { nextOccurrence, todayDow, DAYS } from '@/lib/time'
import { addSlot, updateSlot } from '@/services/timetableService'

/**
 * Google Calendar integration.
 *
 * Firebase's Google sign-in returns a short-lived OAuth access token (~1h) that
 * is NOT auto-refreshed, so we keep it in sessionStorage and ask the user to
 * reconnect when it expires (401). The `calendar.events` scope is requested
 * on demand (separate consent) rather than at base login, to keep first-login
 * frictionless and avoid the sensitive-scope warning for non-calendar users.
 */
const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const TOKEN_KEY = 'protrack:gcal_token'

export function getCalToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}
export function isCalendarConnected() {
  return Boolean(getCalToken())
}
export function clearCalToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export async function connectCalendar() {
  if (!auth) throw new Error('Firebase is not configured for this build.')
  const provider = new GoogleAuthProvider()
  provider.addScope(CAL_SCOPE)
  provider.setCustomParameters({ prompt: 'consent' })
  const result = await signInWithPopup(auth, provider)
  const credential = GoogleAuthProvider.credentialFromResult(result)
  const token = credential?.accessToken
  if (!token) throw new Error('No calendar access token returned')
  sessionStorage.setItem(TOKEN_KEY, token)
  return token
}

async function calFetch(path, options = {}) {
  const token = getCalToken()
  if (!token) throw new Error('Calendar not connected')
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
    throw new Error('Calendar session expired — please reconnect')
  }
  if (!res.ok) throw new Error(`Calendar API error ${res.status}`)
  return res.json()
}

/**
 * Auto-retry on 401: re-authenticate and retry the request once.
 */
async function calFetchWithRetry(path, options = {}) {
  try {
    return await calFetch(path, options)
  } catch (err) {
    if (err.message.includes('expired')) {
      // Try to re-authenticate silently
      try {
        await connectCalendar()
        return await calFetch(path, options)
      } catch {
        throw err // re-throw original error if re-auth fails
      }
    }
    throw err
  }
}

/** Pull — upcoming events from the primary calendar. */
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
 * Bi-directional sync orchestrator.
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
