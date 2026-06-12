import { ymd, lastNDays } from '@/lib/dates'

/**
 * Daily check-in engine — pure logic, no IO. The hook (useCheckIns) owns
 * timers, Firestore and localStorage; everything here is deterministic and
 * unit-tested.
 *
 * Three slots per day. Each slot asks at most ONE short question; answers are
 * stored per-slot in users/{uid}/checkins/{ymd} so a day costs at most three
 * tiny writes. Question selection is rule-based (zero tokens) — an optional
 * AI-personalized text can override the morning wording, never the structure.
 *
 * @typedef {Object} CheckinQuestion
 * @property {string} id    Stable id, stored with the answer.
 * @property {'intent'|'scale'} type  Drives the card UI: free text vs 1–5 chips.
 * @property {string} text  The question shown to the user.
 * @property {string} [low]   Label under chip 1 (scale only).
 * @property {string} [high]  Label under chip 5 (scale only).
 * @property {boolean} [note] Offer an optional free-text note (scale only).
 */

export const CHECKIN_SLOTS = ['morning', 'midday', 'evening']

/** Slot for a local time: morning 5–12, midday 12–17, evening 17–23, else null. */
export function currentSlot(d = new Date()) {
  const h = d.getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'midday'
  if (h >= 17 && h < 23) return 'evening'
  return null
}

// 1 = rough, 5 = great — every scale reads in the same direction so trends
// can be averaged across question variants.
const QUESTION_BANK = {
  morning: [
    { id: 'm-win', type: 'intent', text: 'What one thing would make today a win?' },
    { id: 'm-first', type: 'intent', text: 'What will you start with today?' },
    { id: 'm-matter', type: 'intent', text: 'What matters most today?' },
  ],
  midday: [
    { id: 'd-energy', type: 'scale', text: 'How is your energy right now?', low: 'Drained', high: 'Charged' },
    { id: 'd-track', type: 'scale', text: 'How on-track does today feel so far?', low: 'Adrift', high: 'Locked in' },
    { id: 'd-load', type: 'scale', text: 'How light does your plate feel right now?', low: 'Crushing', high: 'Light' },
  ],
  evening: [
    { id: 'e-day', type: 'scale', text: 'How did today go overall?', low: 'Rough', high: 'Great', note: true },
    { id: 'e-done', type: 'scale', text: 'How satisfied are you with what you got done?', low: 'Not at all', high: 'Very', note: true },
  ],
}

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d - start) / 86_400_000)
}

function truncate(s, max) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/**
 * Pick today's question for a slot. Deterministic rotation by day-of-year so
 * the wording varies day to day without repeating within a day. The evening
 * question closes the loop on the morning intent when one was set — that is
 * what makes the check-in feel personal without any AI involved.
 *
 * @param {'morning'|'midday'|'evening'} slot
 * @param {{ date?: Date, morningIntent?: ?string, overrideText?: ?string }} opts
 * @returns {?CheckinQuestion}
 */
export function selectQuestion(slot, { date = new Date(), morningIntent = null, overrideText = null } = {}) {
  const bank = QUESTION_BANK[slot]
  if (!bank) return null
  if (slot === 'evening' && morningIntent) {
    return {
      id: 'e-intent',
      type: 'scale',
      text: `Did you get to "${truncate(morningIntent, 60)}"?`,
      low: 'Not yet',
      high: 'Done',
      note: true,
    }
  }
  const q = bank[dayOfYear(date) % bank.length]
  return overrideText ? { ...q, id: `${q.id}-ai`, text: overrideText } : q
}

/**
 * Should the card appear right now? All gates in one place:
 *  - feature enabled, inside a slot window
 *  - this slot not already answered today
 *  - not snoozed, and the app has been open long enough to let the user settle
 *
 * @param {{ enabled?: boolean, slot: ?string, todayDoc: ?{answers?: Object},
 *           snoozedUntil?: number, now?: number, sessionStartedAt?: number,
 *           settleMs?: number }} args
 */
export function shouldPrompt({
  enabled = true,
  slot,
  todayDoc = null,
  snoozedUntil = 0,
  now = Date.now(),
  sessionStartedAt = 0,
  settleMs = 90_000,
} = {}) {
  if (!enabled || !slot) return false
  if (now - sessionStartedAt < settleMs) return false
  if (now < snoozedUntil) return false
  if (todayDoc?.answers?.[slot]) return false
  return true
}

/** Numeric scale answers for one day's doc, averaged (null if none). */
function dayValue(checkinDoc) {
  const answers = Object.values(checkinDoc?.answers || {}).filter(
    (a) => a?.type === 'scale' && typeof a.value === 'number',
  )
  if (!answers.length) return null
  return answers.reduce((sum, a) => sum + a.value, 0) / answers.length
}

/**
 * Last-n-days energy series for the card's quiet trend strip.
 * @param {Array<{date: string}>} checkins  Recent docs (any order).
 * @param {number} days
 * @returns {Array<{ key: string, label: string, value: ?number }>}
 */
export function energyTrend(checkins, days = 7) {
  const byDate = new Map((checkins || []).map((c) => [c.date, c]))
  return lastNDays(days).map(({ key, label }) => ({
    key,
    label,
    value: dayValue(byDate.get(key)),
  }))
}

/**
 * One calm, rule-based sentence about the recent pattern — or null when there
 * is not enough signal (or nothing worth saying). Never alarmist.
 */
export function checkinInsight(checkins, { today = ymd() } = {}) {
  const series = energyTrend(checkins, 7).filter((d) => d.value !== null && d.key <= today)
  if (series.length < 3) return null
  const avg = series.reduce((s, d) => s + d.value, 0) / series.length
  const half = Math.floor(series.length / 2)
  const first = series.slice(0, half)
  const second = series.slice(series.length - half)
  const mean = (arr) => arr.reduce((s, d) => s + d.value, 0) / arr.length
  const delta = mean(second) - mean(first)

  if (avg >= 4) return 'Strong week so far — keep the rhythm going.'
  if (avg <= 2.4) return 'The last few days have felt heavy. Lighter sessions might help.'
  if (delta >= 0.8) return 'Your days are trending up this week.'
  if (delta <= -0.8) return 'Your days have been dipping — be kind to yourself.'
  return null
}
