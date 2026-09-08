/**
 * Pure Google Calendar ↔ PRO TRACK item mapping. No React, no Firebase, no I/O.
 *
 * A "GCal event" is the Calendar v3 resource shape:
 *   { id, status, summary, description, start, end, recurrence?, updated }
 *   start/end = { dateTime: RFC3339 } (timed) or { date: 'YYYY-MM-DD' } (all-day)
 *
 * A "local item" is one of:
 *   - slot   { dayOfWeek(0=Mon..6=Sun), startMin, endMin, label, recurrenceType }
 *   - event  { type:'event', eventDate:'YYYY-MM-DD', eventStartMin, eventEndMin, text }
 *   - todo   { text|title, dueAt, allDay? }
 *
 * Conflict policy is last-write-wins by the `updated` timestamp — see
 * `mergeStrategy`. calendarService.syncEverything is the only consumer.
 */
import { ymd } from '@/lib/dates'
import { nextOccurrence } from '@/lib/time'

/* ── date helpers (pure) ─────────────────────────────────── */

/** ms since epoch for a Date | ISO string | epoch | Firestore Timestamp, else null. */
export function toMs(v) {
  if (v == null) return null
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate().getTime()
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime()
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = Date.parse(v)
    return Number.isNaN(t) ? null : t
  }
  return null
}

/** 0=Mon … 6=Sun for a local Date (matches lib/time day indexing). */
function localDow(d) {
  return (d.getDay() + 6) % 7
}

/** Minutes from local midnight for a Date. */
function localMinutes(d) {
  return d.getHours() * 60 + d.getMinutes()
}

/** Local Date for 'YYYY-MM-DD' at a minute-of-day. */
function dateAtYmdMin(ymdStr, min) {
  const [y, m, d] = String(ymdStr).split('-').map(Number)
  const safeMin = Number.isFinite(min) ? min : 540 // 09:00 default
  return new Date(y, (m || 1) - 1, d || 1, Math.floor(safeMin / 60), safeMin % 60, 0, 0)
}

function isWeeklyRecurrence(recurrence) {
  return (
    Array.isArray(recurrence) &&
    recurrence.some((r) => /RRULE/i.test(r) && /FREQ=WEEKLY/i.test(r))
  )
}

/* ── GCal event → local item ─────────────────────────────── */

/**
 * Map a Calendar v3 event to a normalized local item.
 * Returns one of:
 *   { kind:'cancelled', googleEventId }
 *   { kind:'slot',  googleEventId, source, updated, label, dayOfWeek, startMin, endMin, recurrenceType:'weekly' }
 *   { kind:'todo',  googleEventId, source, updated, type:'event', text, eventDate, eventStartMin, eventEndMin }
 *   { kind:'todo',  googleEventId, source, updated, text, dueAt, allDay:true }
 * or null when the event cannot be represented.
 */
export function eventToItem(ev) {
  if (!ev || !ev.id) return null
  const googleEventId = ev.id
  const updated = ev.updated || null

  if (ev.status === 'cancelled') {
    return { kind: 'cancelled', googleEventId }
  }

  const title = (ev.summary || '').trim() || 'Google Calendar event'

  // Timed event
  if (ev.start?.dateTime && ev.end?.dateTime) {
    const start = new Date(ev.start.dateTime)
    const end = new Date(ev.end.dateTime)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

    const startMin = localMinutes(start)
    const endMin = localMinutes(end)

    if (isWeeklyRecurrence(ev.recurrence)) {
      if (endMin <= startMin) return null // skip cross-midnight / invalid for a weekly slot
      return {
        kind: 'slot',
        googleEventId,
        source: 'gcal',
        updated,
        label: title,
        dayOfWeek: localDow(start),
        startMin,
        endMin,
        recurrenceType: 'weekly',
      }
    }

    // One-off (or non-weekly recurrence instance) → an "event" todo
    return {
      kind: 'todo',
      googleEventId,
      source: 'gcal',
      updated,
      type: 'event',
      text: title,
      eventDate: ymd(start),
      eventStartMin: startMin,
      eventEndMin: endMin > startMin ? endMin : startMin + 60,
    }
  }

  // All-day event (has a plain date) → a dated todo, anchored at 09:00 local
  if (ev.start?.date) {
    const due = dateAtYmdMin(ev.start.date, 540)
    if (Number.isNaN(due.getTime())) return null
    return {
      kind: 'todo',
      googleEventId,
      source: 'gcal',
      updated,
      text: title,
      dueAt: due.toISOString(),
      allDay: true,
    }
  }

  return null
}

/* ── local item → GCal event resource ───────────────────── */

/**
 * Map a local item to a Calendar v3 event body for POST/PATCH.
 * Returns null when the item has no time and cannot be represented.
 */
export function itemToEvent(item) {
  if (!item) return null

  // Slot → recurring weekly event
  if (
    typeof item.dayOfWeek === 'number' &&
    typeof item.startMin === 'number' &&
    typeof item.endMin === 'number'
  ) {
    const { startISO, endISO } = nextOccurrence(item.dayOfWeek, item.startMin, item.endMin)
    return {
      summary: item.label || 'PRO TRACK session',
      description: 'Synced from PRO TRACK',
      start: { dateTime: startISO },
      end: { dateTime: endISO },
      recurrence: ['RRULE:FREQ=WEEKLY'],
    }
  }

  // One-time "event" todo → single dateTime event
  if (item.type === 'event' && item.eventDate) {
    const startMin = Number.isFinite(item.eventStartMin) ? item.eventStartMin : 540
    const endMin = Number.isFinite(item.eventEndMin) ? item.eventEndMin : startMin + 60
    const start = dateAtYmdMin(item.eventDate, startMin)
    const end = dateAtYmdMin(item.eventDate, endMin > startMin ? endMin : startMin + 60)
    return {
      summary: item.text || item.title || 'PRO TRACK event',
      description: 'Synced from PRO TRACK',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    }
  }

  // Todo / task with a due date
  if (item.dueAt != null) {
    const ms = toMs(item.dueAt)
    if (ms == null) return null
    const due = new Date(ms)
    const summary = item.text || item.title || 'PRO TRACK to-do'

    if (item.allDay) {
      const startYmd = ymd(due)
      const nextDay = new Date(due.getTime() + 86400000)
      return {
        summary,
        description: 'Synced from PRO TRACK',
        start: { date: startYmd },
        end: { date: ymd(nextDay) },
      }
    }

    return {
      summary,
      description: 'Synced from PRO TRACK',
      start: { dateTime: due.toISOString() },
      end: { dateTime: new Date(ms + 30 * 60000).toISOString() },
    }
  }

  return null
}

/* ── conflict resolution ─────────────────────────────────── */

/**
 * Last-write-wins by `updated` timestamp.
 * @returns {'local'|'remote'} which side should win.
 * When timestamps are missing/equal, the remote copy wins (server is the
 * shared source of truth) — except when only the local side has a timestamp.
 */
export function mergeStrategy(localUpdated, remoteUpdated) {
  const l = toMs(localUpdated)
  const r = toMs(remoteUpdated)
  if (l == null && r == null) return 'remote'
  if (l == null) return 'remote'
  if (r == null) return 'local'
  return l > r ? 'local' : 'remote'
}

/**
 * A cheap content signature for a local item — used to detect a local edit
 * since the last push without adding an `updated` field to the doc shape.
 */
export function itemSignature(item) {
  if (!item) return ''
  if (typeof item.dayOfWeek === 'number' && typeof item.startMin === 'number') {
    return `slot|${item.label || ''}|${item.dayOfWeek}|${item.startMin}|${item.endMin}`
  }
  if (item.type === 'event' && item.eventDate) {
    return `event|${item.text || ''}|${item.eventDate}|${item.eventStartMin}|${item.eventEndMin}`
  }
  return `todo|${item.text || item.title || ''}|${toMs(item.dueAt) ?? ''}|${item.allDay ? 1 : 0}`
}
