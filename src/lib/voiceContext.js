/**
 * Pure voice/chat context builder.
 *
 * One source of truth for the "what does the assistant know about the user's
 * workspace right now" prompt block. Before this, HandsFreeTab, ChatTab and
 * BackgroundHandsFree each hand-rolled a near-identical (and thinner) version.
 *
 * It takes a plain snapshot object — never the live store — so it stays pure and
 * unit-testable with a fixed `now`. The caller (useVoiceAgent / ChatTab) reads
 * the store once and hands the relevant slices in.
 */
import { DAYS, DAY_FULL, minutesToLabel } from '@/lib/time'
import { classifyDeadline } from '@/lib/deadlines'

const URGENCY_LABEL = {
  overdue: 'OVERDUE',
  due_today: 'due today',
  due_soon: 'due soon',
  upcoming: 'upcoming',
}

/** 0=Mon … 6=Sun for a given date (matches lib/time.todayDow). */
function dowOf(date) {
  return (date.getDay() + 6) % 7
}

function slotLine(s) {
  const range = `${minutesToLabel(s.startMin)}–${minutesToLabel(s.endMin)}`
  return `  • ${s.label} (${range})`
}

function toDate(d) {
  if (!d) return null
  if (typeof d.toDate === 'function') return d.toDate()
  if (d instanceof Date) return d
  const parsed = new Date(d)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function todoLine(t) {
  const urgency = t.dueAt ? classifyDeadline(t.dueAt) : null
  const due = toDate(t.dueAt)
  const suffix = urgency
    ? ` [${URGENCY_LABEL[urgency] || urgency}${
        due
          ? ` — ${due.toLocaleString([], {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : ''
      }]`
    : ''
  return `  • ${t.text}${suffix}`
}

function focusLine(focus) {
  if (!focus || focus.status === 'idle') return 'Focus timer: idle (no session running).'
  const mins = Math.max(0, Math.round((focus.secondsLeft || 0) / 60))
  const phase = focus.phase === 'break' ? 'break' : 'focus'
  const label = focus.session?.label ? ` on "${focus.session.label}"` : ''
  return `Focus timer: ${focus.status} — ${phase} phase${label}, ~${mins} min left.`
}

function alarmLines(alarms = []) {
  const on = alarms.filter((a) => a.enabled)
  if (!on.length) return 'Alarms: none set.'
  const list = on
    .slice(0, 6)
    .map((a) => `  • ${minutesToLabel(hhmmToMin(a.time))}${a.label ? ` — ${a.label}` : ''} (${a.repeat || 'once'})`)
    .join('\n')
  return `Alarms (${on.length} active):\n${list}`
}

function hhmmToMin(t) {
  const [h, m] = String(t || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * @typedef {Object} VoiceSnapshot
 * @property {string} [modeName]
 * @property {string} [modeId]
 * @property {Array}  [modes]
 * @property {Array}  [subjects]
 * @property {Array}  [slots]
 * @property {Array}  [habits]
 * @property {Array}  [todos]
 * @property {Array}  [alarms]
 * @property {{status:string,phase:string,secondsLeft:number,session?:object}} [focus]
 * @property {{currentStreak?:number,totalFocusMin?:number,treesGrown?:number}} [stats]
 */

/**
 * Build the workspace context string handed to the model.
 * @param {VoiceSnapshot} snapshot
 * @param {Date} [now]
 * @returns {string}
 */
export function buildVoiceContext(snapshot = {}, now = new Date()) {
  const {
    modeName,
    modeId,
    modes = [],
    subjects = [],
    slots = [],
    habits = [],
    todos = [],
    alarms = [],
    focus = null,
    stats = {},
  } = snapshot

  const today = dowOf(now)
  const tomorrow = (today + 1) % 7
  const todayStr = now.toLocaleString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const openTodos = todos.filter((t) => !t.done)
  const laggingFirst = [...subjects].sort(
    (a, b) => (a.progressPct || 0) - (b.progressPct || 0),
  )

  const subjLines = laggingFirst.length
    ? laggingFirst
        .map((s) => `  • ${s.name}: ${s.progressPct || 0}%`)
        .join('\n')
    : '  (none yet)'

  const bySlot = (dow) =>
    slots
      .filter((s) => s.dayOfWeek === dow)
      .sort((a, b) => a.startMin - b.startMin)
  const todaySlots = bySlot(today)
  const tomorrowSlots = bySlot(tomorrow)

  const habitLines = habits.length
    ? habits
        .map((h) => {
          const done = (h.doneDates || []).includes(now.toISOString().slice(0, 10))
          return `  • ${h.name} — ${done ? 'done today ✓' : 'not done today'}`
        })
        .join('\n')
    : '  (none yet)'

  const modeNames = modes.length
    ? modes.map((m) => m.name).filter(Boolean).join(', ')
    : '—'

  return [
    `Now: ${todayStr}.`,
    `Active mode: ${modeName || '—'} (id: ${modeId || 'none'}). All modes: ${modeNames}.`,
    '',
    `Subjects (lowest progress first):\n${subjLines}`,
    '',
    `Habits:\n${habitLines}`,
    '',
    `Open to-dos (${openTodos.length}):\n${
      openTodos.length ? openTodos.slice(0, 15).map(todoLine).join('\n') : '  (none)'
    }`,
    '',
    `Today's schedule (${DAY_FULL[today]}):\n${
      todaySlots.length ? todaySlots.map(slotLine).join('\n') : '  (nothing planned)'
    }`,
    `Tomorrow's schedule (${DAY_FULL[tomorrow]}):\n${
      tomorrowSlots.length ? tomorrowSlots.map(slotLine).join('\n') : '  (nothing planned)'
    }`,
    '',
    focusLine(focus),
    alarmLines(alarms),
    `Focus stats: ${stats?.currentStreak || 0}-day streak, ${Math.round(
      (stats?.totalFocusMin || 0) / 60,
    )}h total focus, ${stats?.treesGrown || 0} sessions completed.`,
  ].join('\n')
}

/** Day-of-week list, exported for callers that need the same 0=Mon indexing. */
export { DAYS }
