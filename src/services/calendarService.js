import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { nextOccurrence } from '@/lib/time'

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

/** Pull — upcoming events from the primary calendar. */
export async function listUpcomingEvents(maxResults = 8) {
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  })
  const data = await calFetch(`/calendars/primary/events?${params}`)
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
      ? await calFetch(`/calendars/primary/events/${slot.googleEventId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await calFetch(`/calendars/primary/events`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
  return event.id
}
