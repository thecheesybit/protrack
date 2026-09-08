/**
 * counts.js — Pure item counts aggregator for headers and badges.
 *
 * Computes open todos, today's events, and overdue items from already-subscribed
 * data arrays. Free-tier discipline: pure calculation, zero Firestore reads.
 */
import { classifyDeadline } from '@/lib/deadlines'
import { ymd } from '@/lib/dates'

function toDate(val) {
  if (!val) return null
  if (typeof val.toDate === 'function') return val.toDate()
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Compute counts of open todos, events on given date, and overdue items.
 *
 * @param {object} input
 * @param {Array}  [input.todos]   todos (non-event tasks)
 * @param {Array}  [input.events]  calendar events / one-time todos (type:'event')
 * @param {Date}   [input.date]    reference date (defaults to now)
 * @returns {{ openTodos: number, eventsToday: number, overdue: number }}
 */
export function openItemCounts({
  todos = [],
  events = [],
  date = new Date(),
} = {}) {
  const todoList = Array.isArray(todos) ? todos : []
  const eventList = Array.isArray(events) ? events : []
  const dayStr = ymd(date)

  let openTodos = 0
  let overdue = 0

  for (const t of todoList) {
    if (!t || t.type === 'event') continue
    if (t.source === 'gcal') continue // pulled Google events live in the local cache, not the to-do list
    const isDone = Boolean(t.done) || t.column === 'done'
    if (!isDone) {
      openTodos++
      if (t.dueAt && classifyDeadline(t.dueAt) === 'overdue') {
        overdue++
      }
    }
  }

  let eventsToday = 0
  for (const e of eventList) {
    if (!e) continue
    if (e.eventDate) {
      if (e.eventDate === dayStr) eventsToday++
    } else if (e.dueAt) {
      const d = toDate(e.dueAt)
      if (d && ymd(d) === dayStr) eventsToday++
    }
  }

  return { openTodos, eventsToday, overdue }
}
