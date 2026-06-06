import * as chrono from 'chrono-node'

/**
 * Parse a natural-language phrase into a structured capture, stripping the date
 * phrase from the title. Powers the "click the calendar and type" quick entry.
 *
 * @param {string} input  e.g. "Revise Polity tomorrow 5pm for 2h"
 * @param {Date}   [ref]  reference "now" for relative phrases
 * @returns {{ date: Date|null, endDate: Date|null, title: string, matched: string|null }}
 */
export function parseCapture(input, ref = new Date()) {
  const text = (input || '').trim()
  if (!text) return { date: null, endDate: null, title: '', matched: null }

  const results = chrono.parse(text, ref, { forwardDate: true })
  if (!results.length) return { date: null, endDate: null, title: text, matched: null }

  const r = results[0]
  const date = r.start ? r.start.date() : null
  const endDate = r.end ? r.end.date() : null
  const matched = r.text

  let title = (text.slice(0, r.index) + text.slice(r.index + matched.length)).trim()
  title = title
    .replace(/\s{2,}/g, ' ')
    .replace(/^(for|at|on|by|from|,|-|—)\s+/i, '')
    .replace(/\s+(for|at|on|by|from)$/i, '')
    .trim()
  if (!title) title = text

  return { date, endDate, title, matched }
}

/** JS Date → timetable day-of-week (0=Mon … 6=Sun). */
export function dateToDow(date) {
  return (date.getDay() + 6) % 7
}

/** JS Date → minutes from midnight. */
export function dateToMinutes(date) {
  return date.getHours() * 60 + date.getMinutes()
}
