/**
 * dayAgenda.js — PURE day-at-a-glance aggregator.
 *
 * Merges every dated thing for a single calendar day into one chronological,
 * normalized list, plus a summary for the "end of day" footer. Consumed by
 * `src/components/timetable/TodayAgenda.jsx`.
 *
 * HARD RULE: this module is pure. No Firestore reads/writes, no timers, no
 * `Date.now()` side-effects beyond the caller-supplied `date` / `nowMin`, no
 * React. It only reshapes data that the widgets have already subscribed to, so
 * it adds zero backend cost.
 *
 * Normalized item shape:
 *   {
 *     id:        string,                      // `${kind}:${sourceId}` — stable & unique
 *     kind:      'slot'|'event'|'todo'|'task'|'session'|'note',
 *     startMin:  number | null,               // minutes-from-midnight; null = "anytime" bucket
 *     endMin:    number | null,
 *     title:     string,
 *     color:     string,                      // hex
 *     subjectId: string | null,
 *     modeId:    string | null,               // set in the global "All Scopes" view
 *     modeName:  string | null,
 *     modeColor: string | null,               // drives the small cross-mode dot
 *     source:    string | undefined,          // 'local' | 'gcal' | 'focus' | 'note' …
 *     done:      boolean,                      // completed → struck through, still shown
 *     past:      boolean,                      // ended before `nowMin` (false when nowMin omitted)
 *     ref:       object,                       // the original doc, for edit / navigation
 *   }
 */
import { isSlotOnDay, DAY_START_MIN, DAY_END_MIN } from '@/lib/time'
import { dueAtToMinutes, classifyDeadline } from '@/lib/deadlines'
import { ymd } from '@/lib/dates'

const FALLBACK_COLOR = '#6366f1'
const EVENT_COLOR = '#8b5cf6'
const TODO_COLOR = '#f59e0b'
const TASK_COLOR = '#38bdf8'
const SESSION_COLOR = '#10b981'
const NOTE_COLOR = '#fbbf24'
const GCAL_COLOR = '#4285f4'
const ALARM_COLOR = '#f43f5e'

// Deterministic tie-break when two timed items share a start minute.
const KIND_ORDER = { alarm: 0, session: 1, slot: 2, event: 3, gcal: 4, task: 5, todo: 6, note: 7 }

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number' || typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** True when `value` lands on the same local calendar day as `day`. */
function sameLocalDay(value, day) {
  const d = toDate(value)
  const target = toDate(day)
  if (!d || !target) return false
  return ymd(d) === ymd(target)
}

/**
 * Minutes-from-midnight for a due date, or `null` when the item belongs in the
 * "anytime" bucket. Mirrors the established TimetableGrid convention: an
 * `allDay` flag, midnight, or anything before the 06:00 day start counts as
 * untimed.
 */
function anchoredMinutes(dueAt, allDay) {
  if (allDay === true) return null
  const mins = dueAtToMinutes(dueAt)
  if (mins == null || mins === 0 || mins < DAY_START_MIN) return null
  return mins
}

function modeMeta(raw) {
  return {
    modeId: raw._modeId ?? raw.modeId ?? null,
    modeName: raw._modeName ?? null,
    modeColor: raw._modeColor ?? null,
  }
}

function stampPast(item, nowMin) {
  if (typeof nowMin !== 'number') return { ...item, past: false }
  if (item.startMin == null) return { ...item, past: false }
  const edge = item.endMin ?? item.startMin
  return { ...item, past: edge <= nowMin }
}

// ── per-source normalizers ────────────────────────────────────────────────────

function normalizeSlot(slot, dateStr = null, sessions = []) {
  const { modeId, modeName, modeColor } = modeMeta(slot)
  const isCompleted =
    (Array.isArray(slot.completedDates) && dateStr && slot.completedDates.includes(dateStr)) ||
    (Array.isArray(sessions) &&
      sessions.some((s) => {
        if (!s || s.completed === false) return false
        if (s.slotId && s.slotId === slot.id) {
          if (s.targetDate) return s.targetDate === dateStr
          return dateStr ? sameLocalDay(s.startedAt, dateStr) : true
        }
        return false
      }))

  return {
    id: `slot:${slot.id}`,
    kind: 'slot',
    startMin: typeof slot.startMin === 'number' ? slot.startMin : null,
    endMin: typeof slot.endMin === 'number' ? slot.endMin : null,
    title: slot.label || 'Study session',
    color: slot.color || modeColor || FALLBACK_COLOR,
    subjectId: slot.subjectId ?? null,
    modeId,
    modeName,
    modeColor,
    source: slot.googleEventId ? 'gcal' : 'local',
    done: Boolean(isCompleted),
    ref: slot,
  }
}

function normalizeEvent(evt) {
  const { modeId, modeName, modeColor } = modeMeta(evt)
  const startMin =
    typeof evt.eventStartMin === 'number'
      ? evt.eventStartMin
      : anchoredMinutes(evt.dueAt, evt.allDay)
  const endMin =
    typeof evt.eventEndMin === 'number'
      ? evt.eventEndMin
      : startMin != null
        ? Math.min(startMin + 60, DAY_END_MIN)
        : null
  return {
    id: `event:${evt.id}`,
    kind: 'event',
    startMin: startMin ?? null,
    endMin,
    title: evt.text || evt.title || 'Event',
    color: evt.color || modeColor || EVENT_COLOR,
    subjectId: evt.subjectId ?? null,
    modeId,
    modeName,
    modeColor,
    source: evt.googleEventId ? 'gcal' : 'local',
    done: Boolean(evt.done),
    ref: evt,
  }
}

function normalizeDue(item, kind) {
  const { modeId, modeName, modeColor } = modeMeta(item)
  const done =
    kind === 'task' ? item.column === 'done' || Boolean(item.done) : Boolean(item.done)
  return {
    id: `${kind}:${item.id}`,
    kind,
    startMin: anchoredMinutes(item.dueAt, item.allDay),
    endMin: null,
    title: item.text || item.title || (kind === 'task' ? 'Task' : 'To-do'),
    color: item.color || modeColor || (kind === 'task' ? TASK_COLOR : TODO_COLOR),
    subjectId: item.subjectId ?? null,
    modeId,
    modeName,
    modeColor,
    source: item.googleEventId ? 'gcal' : 'local',
    done,
    ref: item,
  }
}

function normalizeSession(s) {
  const { modeId, modeName, modeColor } = modeMeta(s)
  const d = toDate(s.startedAt)
  const startMin = d ? d.getHours() * 60 + d.getMinutes() : null
  const dur = Number(s.durationMin) || 0
  return {
    id: `session:${s.id ?? (d ? d.getTime() : Math.random())}`,
    kind: 'session',
    startMin,
    endMin: startMin != null ? Math.min(startMin + dur, DAY_END_MIN) : null,
    title: s.label || s.title || 'Focus session',
    color: s.color || modeColor || SESSION_COLOR,
    subjectId: s.subjectId ?? null,
    modeId,
    modeName,
    modeColor,
    source: 'focus',
    done: true,
    ref: s,
  }
}

function normalizeGcal(g) {
  return {
    id: `gcal:${g.id}`,
    kind: 'gcal',
    startMin: typeof g.startMin === 'number' ? g.startMin : null,
    endMin: typeof g.endMin === 'number' ? g.endMin : null,
    title: g.title || 'Google event',
    color: g.color || GCAL_COLOR,
    subjectId: null,
    modeId: null,
    modeName: null,
    modeColor: null,
    source: 'gcal',
    readonly: true,
    allDay: Boolean(g.allDay),
    location: g.location || '',
    htmlLink: g.htmlLink || '',
    calendarName: g.calendarName || '',
    isHoliday: Boolean(g.isHoliday),
    done: false,
    ref: g,
  }
}

function normalizeNote(n) {
  const { modeId, modeName, modeColor } = modeMeta(n)
  return {
    id: `note:${n.id}`,
    kind: 'note',
    startMin: anchoredMinutes(n.dueAt, n.allDay),
    endMin: null,
    title: n.title || n.text || 'Note deadline',
    color: n.color || modeColor || NOTE_COLOR,
    subjectId: n.subjectId ?? null,
    modeId,
    modeName,
    modeColor,
    source: 'note',
    done: false,
    ref: n,
  }
}

function normalizeAlarm(a) {
  const [hStr, mStr] = (a.time || '00:00').split(':')
  const startMin = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0)
  return {
    id: `alarm:${a.id}`,
    kind: 'alarm',
    startMin,
    endMin: null,
    title: a.label ? `Alarm: ${a.label}` : 'Alarm',
    color: ALARM_COLOR,
    subjectId: null,
    modeId: null,
    modeName: null,
    modeColor: null,
    source: 'alarm',
    done: !a.enabled,
    ref: a,
  }
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Build the merged, chronologically-sorted timeline for one day.
 *
 * @param {object}  input
 * @param {Array}   [input.slots]     recurring timetable slots (may carry `_modeId` in "All Scopes")
 * @param {Array}   [input.events]    one-time todos with `type:'event'`
 * @param {Array}   [input.todos]     plain todos (non-event); included when due on `date`
 * @param {Array}   [input.tasks]     kanban tasks; included when due on `date`
 * @param {Array}   [input.sessions]  completed focus sessions
 * @param {Array}   [input.notes]     notes carrying a `dueAt`
 * @param {Array}   [input.alarms]    alarms with visibleOnCalendar: true
 * @param {Date}    [input.date]      the day to build (defaults to now)
 * @param {number}  [input.nowMin]    live minutes-from-midnight, for `past` stamping (today only)
 * @returns {Array} normalized items — "anytime" bucket first, then ascending by start time
 */
export function buildDayTimeline({
  slots = [],
  events = [],
  todos = [],
  tasks = [],
  sessions = [],
  notes = [],
  gcalEvents = [],
  alarms = [],
  date = new Date(),
  nowMin = null,
  carryForward = true,
  includeSessions = true,
} = {}) {
  const dow = (date.getDay() + 6) % 7 // 0 = Monday … 6 = Sunday
  const dayStr = ymd(date)
  const isCurrentToday = dayStr === ymd(new Date())
  const out = []

  for (const g of gcalEvents) {
    if (!g || !g.dateStr) continue
    // All-day/multi-day: include when the view date falls in [start, end].
    if (g.allDay && g.endMs) {
      const s = ymd(new Date(g.startMs))
      const e = ymd(new Date(g.endMs))
      if (dayStr < s || dayStr > e) continue
    } else if (g.dateStr !== dayStr) {
      continue
    }
    out.push(normalizeGcal(g))
  }

  for (const slot of slots) {
    if (slot && slot.id != null && isSlotOnDay(slot, dow, date)) {
      out.push(normalizeSlot(slot, dayStr, sessions))
    }
  }

  for (const evt of events) {
    if (!evt || evt.id == null) continue
    const onDay = evt.eventDate
      ? evt.eventDate === dayStr
      : sameLocalDay(evt.dueAt, date)
    if (onDay) out.push(normalizeEvent(evt))
  }

  for (const todo of todos) {
    if (!todo || todo.id == null || todo.type === 'event') continue
    if (sameLocalDay(todo.dueAt, date)) {
      out.push(normalizeDue(todo, 'todo'))
    } else if (carryForward && isCurrentToday && !todo.done && todo.dueAt) {
      if (classifyDeadline(todo.dueAt) === 'overdue') {
        const item = normalizeDue(todo, 'todo')
        item.startMin = null
        item.carriedFrom = ymd(todo.dueAt)
        item.overdue = true
        out.push(item)
      }
    }
  }

  for (const task of tasks) {
    if (!task || task.id == null) continue
    const isDone = task.column === 'done' || Boolean(task.done)
    if (sameLocalDay(task.dueAt, date)) {
      out.push(normalizeDue(task, 'task'))
    } else if (carryForward && isCurrentToday && !isDone && task.dueAt) {
      if (classifyDeadline(task.dueAt) === 'overdue') {
        const item = normalizeDue(task, 'task')
        item.startMin = null
        item.carriedFrom = ymd(task.dueAt)
        item.overdue = true
        out.push(item)
      }
    }
  }

  if (includeSessions !== false) {
    for (const s of sessions) {
      if (!s || s.completed === false) continue
      // If the session was linked to a slot or todo, it is represented by that slot/todo
      if (s.slotId || s.todoId) continue
      if (sameLocalDay(s.startedAt, date)) out.push(normalizeSession(s))
    }
  }

  for (const n of notes) {
    if (!n || n.id == null || !n.dueAt) continue
    if (sameLocalDay(n.dueAt, date)) out.push(normalizeNote(n))
  }

  for (const a of alarms) {
    if (!a || !a.visibleOnCalendar) continue
    let applies = false
    if (a.repeat === 'daily') {
      applies = true
    } else if (a.repeat === 'weekdays') {
      applies = dow < 5
    } else if (a.repeat === 'once') {
      applies = isCurrentToday || (a.createdAt && sameLocalDay(a.createdAt, date))
    }
    if (applies) {
      out.push(normalizeAlarm(a))
    }
  }

  const stamped = out.map((item) => stampPast(item, nowMin))

  const anytime = stamped
    .filter((i) => i.startMin == null)
    .sort(
      (a, b) =>
        (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) ||
        String(a.title).localeCompare(String(b.title)),
    )

  const timed = stamped
    .filter((i) => i.startMin != null)
    .sort(
      (a, b) =>
        a.startMin - b.startMin ||
        (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) ||
        (a.endMin ?? a.startMin) - (b.endMin ?? b.startMin) ||
        String(a.title).localeCompare(String(b.title)),
    )

  return [...anytime, ...timed]
}

/**
 * Roll a built timeline up into the footer summary.
 *
 * @param {Array}  items   output of `buildDayTimeline`
 * @param {number} [nowMin] live minutes-from-midnight; omit for a non-today view
 * @returns {{ remainingMin: number|null, nextItem: object|null, doneCount: number, totalCount: number }}
 *   - remainingMin: minutes from `nowMin` until the last scheduled item ends
 *                   (falls back to midnight); `null` when `nowMin` is omitted
 *   - nextItem:     earliest timed, not-done item starting at/after `nowMin`
 */
export function summarizeDay(items = [], nowMin = null) {
  const list = Array.isArray(items) ? items : []
  const totalCount = list.length
  const doneCount = list.reduce((n, i) => (i.done ? n + 1 : n), 0)

  if (typeof nowMin !== 'number') {
    return { remainingMin: null, nextItem: null, doneCount, totalCount }
  }

  const timed = list.filter((i) => typeof i.startMin === 'number')
  // "End of day" = when the last still-upcoming commitment ends; if nothing is
  // left on the clock, count down to midnight instead.
  const upcomingEnds = timed
    .map((i) => i.endMin ?? i.startMin)
    .filter((m) => m > nowMin)
  const lastEnd = upcomingEnds.length ? Math.max(...upcomingEnds) : DAY_END_MIN
  const remainingMin = Math.max(0, lastEnd - nowMin)
  const nextItem = timed.find((i) => !i.done && i.startMin >= nowMin) || null

  return { remainingMin, nextItem, doneCount, totalCount }
}
