/**
 * Extended agent action layer (voice + chat "do anything").
 *
 * geminiTools.js owns the original create/update write tools. This module adds
 * the breadth that makes the assistant feel like a real voice agent:
 *   • read / query          — answer "what's due tomorrow?", "how's Physics?"
 *   • navigation / UI        — "open my analytics", "switch to Exam mode"
 *   • focus timer control    — "start a 30 minute session on Physics", "pause"
 *   • alarms                 — "wake me at 7am"
 *   • modes / notes          — "create a Fitness mode", "note down …"
 *   • delete (with confirm)  — the model must confirm verbally first (see SYSTEM)
 *
 * Same contract as executeTool: every case resolves to
 *   { ok: true, summary } | { ok: false, error }
 * so the model can narrate the outcome. UI / focus / nav actions read the live
 * Zustand store via getState() — no new Firestore reads are introduced, keeping
 * the free-tier discipline intact.
 */
import { SchemaType } from '@google/generative-ai'
import { useStore } from '@/store/useStore'
import {
  deleteSubject,
  deleteTask,
  subscribeToTasks,
} from '@/services/subjectService'
import { deleteTodo } from '@/services/todoService'
import { deleteHabit } from '@/services/habitService'
import { addNote } from '@/services/noteService'
import { createMode } from '@/services/modeService'
import { updateActiveMode } from '@/services/userService'
import {
  createAlarm,
  getAlarms,
  deleteAlarm,
} from '@/services/alarmService'
import { classifyDeadline } from '@/lib/deadlines'
import { minutesToLabel, DAYS, DAY_FULL } from '@/lib/time'
import { stopAlarmRingtone } from '@/lib/sound'

/* ── local helpers (kept self-contained to avoid a geminiTools import cycle) ── */

function findByName(list, name, key = 'name') {
  if (!name) return null
  const needle = String(name).trim().toLowerCase()
  return (
    list.find((x) => x[key]?.toLowerCase() === needle) ||
    list.find((x) => x[key]?.toLowerCase().includes(needle)) ||
    null
  )
}

/** Parse "7:30 pm" / "07:30" / "9am" → "HH:MM" 24-hour, or null. */
function parseTimeTo24h(input) {
  if (input == null) return null
  const s = String(input).trim().toLowerCase()
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] || 0)
  const ampm = m[3]
  if (ampm === 'pm' && h < 12) h += 12
  if (ampm === 'am' && h === 12) h = 0
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function loadTasksOnce(uid, modeId, subjectId) {
  return new Promise((resolve, reject) => {
    let unsub = null
    const timer = setTimeout(() => {
      unsub?.()
      reject(new Error('Tasks load timed out'))
    }, 5000)
    unsub = subscribeToTasks(uid, modeId, subjectId, (tasks) => {
      clearTimeout(timer)
      unsub?.()
      resolve(tasks)
    })
  })
}

const isToday = (dateStr) => dateStr === new Date().toISOString().slice(0, 10)

/* Widget ids that `open_view` can maximise, plus the overlay panels. */
const WIDGET_VIEWS = [
  'timetable',
  'todos',
  'habits',
  'focus',
  'notes',
  'subjects',
  'scorecard',
  'analytics',
  'ledger',
]
const PANEL_VIEWS = ['settings', 'assistant', 'support']

/* ── Tool declarations (Gemini schema) ─────────────────────── */

export const AGENT_TOOL_DECLARATIONS = [
  {
    name: 'get_status',
    description:
      "Read the user's current workspace state to answer a question. Use for 'what's due today/tomorrow', 'how am I doing', 'what's on my schedule', 'is the timer running', etc. Returns a plain-language summary — read it back to the user.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic: {
          type: SchemaType.STRING,
          description:
            "One of: 'agenda_today', 'agenda_tomorrow', 'todos_open', 'todos_overdue', 'subjects', 'habits', 'focus', 'alarms', 'stats'.",
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'open_view',
    description:
      "Navigate the app: bring a widget or panel into view. Use for 'show me…', 'open…', 'go to…'.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        view: {
          type: SchemaType.STRING,
          description:
            "One of the widgets: 'timetable','todos','habits','focus','notes','subjects','scorecard','analytics','ledger'; or a panel: 'settings','assistant','support'.",
        },
      },
      required: ['view'],
    },
  },
  {
    name: 'switch_mode',
    description:
      "Switch the active workspace mode (context). Use 'all' for the everything view.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        modeName: { type: SchemaType.STRING, description: 'Name of the mode, or "all".' },
      },
      required: ['modeName'],
    },
  },
  {
    name: 'create_mode',
    description: 'Create a new workspace mode (a context like "Exam Prep" or "Fitness").',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        color: { type: SchemaType.STRING, description: 'Optional hex accent color.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'start_focus',
    description:
      'Start a Deep Focus (Pomodoro) session. Optionally tie it to a subject and set a custom duration in minutes.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        subjectName: { type: SchemaType.STRING, description: 'Optional subject to focus on.' },
        durationMin: { type: SchemaType.NUMBER, description: 'Optional session length in minutes.' },
      },
    },
  },
  {
    name: 'control_focus',
    description: "Control a running Deep Focus session.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        action: { type: SchemaType.STRING, description: "'pause' | 'resume' | 'stop'" },
      },
      required: ['action'],
    },
  },
  {
    name: 'set_alarm',
    description: 'Set an alarm / wake-up. Time like "7:30 AM" or "07:30".',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        time: { type: SchemaType.STRING },
        label: { type: SchemaType.STRING, description: 'Optional label.' },
        repeat: { type: SchemaType.STRING, description: "'once' | 'daily' | 'weekdays'" },
      },
      required: ['time'],
    },
  },
  {
    name: 'cancel_alarm',
    description: 'Cancel/delete an alarm, matched by its label or time.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: 'Alarm label or time to match.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_note',
    description: 'Save a quick text note for the user.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        text: { type: SchemaType.STRING },
        title: { type: SchemaType.STRING, description: 'Optional short title.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'delete_todo',
    description:
      'Permanently delete a to-do by matching its text. Only call after the user has explicitly confirmed the deletion.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { text: { type: SchemaType.STRING } },
      required: ['text'],
    },
  },
  {
    name: 'delete_task',
    description:
      "Permanently delete a task from a subject's board. Only call after explicit user confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        subjectName: { type: SchemaType.STRING },
        taskTitle: { type: SchemaType.STRING },
      },
      required: ['subjectName', 'taskTitle'],
    },
  },
  {
    name: 'delete_subject',
    description:
      'Permanently delete a subject and all its tasks. Destructive — only call after explicit user confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { subjectName: { type: SchemaType.STRING } },
      required: ['subjectName'],
    },
  },
  {
    name: 'delete_habit',
    description:
      'Permanently delete a habit and its history. Only call after explicit user confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { habitName: { type: SchemaType.STRING } },
      required: ['habitName'],
    },
  },
  {
    name: 'dismiss_assistant',
    description:
      'Put the assistant to sleep or end the hands-free voice session. Call when the user says "goodbye", "that\'s all", "thank you that\'s it", "stop listening", "go to sleep", or dismisses the assistant.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        message: {
          type: SchemaType.STRING,
          description: 'Friendly closing message like "You\'re welcome! Say Hey Track whenever you need me."',
        },
      },
    },
  },
]

/* ── read-tool formatting helpers ──────────────────────────── */

function summarizeStatus(topic, ctx) {
  const { subjects = [], habits = [], todos = [] } = ctx
  const st = useStore.getState()
  const open = todos.filter((t) => !t.done)

  switch (topic) {
    case 'agenda_today':
    case 'agenda_tomorrow': {
      const isTomorrow = topic === 'agenda_tomorrow'
      const now = new Date()
      const dow = ((now.getDay() + 6) % 7 + (isTomorrow ? 1 : 0)) % 7
      const slots = st.slots || ctx.slots || []
      const daySlots = slots
        .filter((s) => s.dayOfWeek === dow)
        .sort((a, b) => a.startMin - b.startMin)
        .map((s) => `${s.label} (${minutesToLabel(s.startMin)}–${minutesToLabel(s.endMin)})`)
      const due = open
        .filter((t) => {
          const c = t.dueAt ? classifyDeadline(t.dueAt) : null
          return isTomorrow ? c === 'due_soon' : c === 'overdue' || c === 'due_today'
        })
        .map((t) => t.text)
      const when = isTomorrow ? `Tomorrow (${DAY_FULL[dow]})` : `Today (${DAY_FULL[dow]})`
      const parts = [
        daySlots.length ? `Schedule: ${daySlots.join('; ')}.` : 'Nothing scheduled.',
        due.length ? `To-dos: ${due.join('; ')}.` : 'No to-dos flagged.',
      ]
      return `${when} — ${parts.join(' ')}`
    }
    case 'todos_open':
      return open.length
        ? `${open.length} open to-do${open.length > 1 ? 's' : ''}: ${open.slice(0, 12).map((t) => t.text).join('; ')}.`
        : 'No open to-dos — all clear.'
    case 'todos_overdue': {
      const overdue = open.filter((t) => classifyDeadline(t.dueAt) === 'overdue')
      return overdue.length
        ? `${overdue.length} overdue: ${overdue.map((t) => t.text).join('; ')}.`
        : 'Nothing overdue.'
    }
    case 'subjects':
      return subjects.length
        ? subjects
            .slice()
            .sort((a, b) => (a.progressPct || 0) - (b.progressPct || 0))
            .map((s) => `${s.name} ${s.progressPct || 0}%`)
            .join(', ')
        : 'No subjects yet.'
    case 'habits':
      return habits.length
        ? habits
            .map((h) => `${h.name}: ${(h.doneDates || []).some(isToday) ? 'done' : 'pending'}`)
            .join(', ')
        : 'No habits tracked yet.'
    case 'focus':
      return st.status === 'idle'
        ? 'The focus timer is idle.'
        : `Focus timer is ${st.status} — ${st.phase} phase, about ${Math.round((st.secondsLeft || 0) / 60)} minutes left.`
    case 'alarms': {
      const on = getAlarms().filter((a) => a.enabled)
      return on.length
        ? `${on.length} alarm${on.length > 1 ? 's' : ''}: ${on
            .map((a) => `${a.time}${a.label ? ` (${a.label})` : ''}`)
            .join(', ')}.`
        : 'No alarms set.'
    }
    case 'stats': {
      const s = st.stats || {}
      return `${s.currentStreak || 0}-day streak, ${Math.round((s.totalFocusMin || 0) / 60)} hours of focus, ${s.treesGrown || 0} sessions completed.`
    }
    default:
      return null
  }
}

/* ── Executor ──────────────────────────────────────────────── */

/**
 * @param {string} name
 * @param {object} args
 * @param {{uid:string,modeId:string,subjects:Array,habits:Array,todos:Array}} ctx
 * @returns {Promise<{ok:boolean,summary?:string,error?:string}>}
 */
export async function executeAgentAction(name, args = {}, ctx = {}) {
  try {
    const { uid, modeId, subjects = [], habits = [], todos = [] } = ctx
    if (!uid) return { ok: false, error: 'Not signed in.' }
    const store = useStore.getState()

    switch (name) {
      case 'get_status': {
        const summary = summarizeStatus(args.topic, ctx)
        if (summary == null) return { ok: false, error: `Unknown topic "${args.topic}".` }
        return { ok: true, summary }
      }

      case 'open_view': {
        const view = String(args.view || '').trim().toLowerCase()
        if (WIDGET_VIEWS.includes(view)) {
          store.maximizeWidget?.(view)
          return { ok: true, summary: `Opened ${view}.` }
        }
        if (view === 'settings') {
          store.setSettingsOpen?.(true)
          return { ok: true, summary: 'Opened Settings.' }
        }
        if (view === 'assistant' || view === 'chat' || view === 'ai') {
          store.setAiOpen?.(true)
          return { ok: true, summary: 'Opened the AI companion.' }
        }
        if (view === 'support') {
          store.setSupportOpen?.(true)
          return { ok: true, summary: 'Opened Support.' }
        }
        return {
          ok: false,
          error: `Unknown view "${args.view}". Try one of: ${[...WIDGET_VIEWS, ...PANEL_VIEWS].join(', ')}.`,
        }
      }

      case 'switch_mode': {
        const raw = String(args.modeName || '').trim().toLowerCase()
        if (!raw) return { ok: false, error: 'Which mode?' }
        if (['all', 'everything', 'every mode'].includes(raw)) {
          store.setActiveModeId?.('all')
          await updateActiveMode(uid, 'all')
          return { ok: true, summary: 'Switched to the everything view.' }
        }
        const mode = findByName(store.modes || [], args.modeName)
        if (!mode) return { ok: false, error: `Mode "${args.modeName}" not found.` }
        store.setActiveModeId?.(mode.id)
        await updateActiveMode(uid, mode.id)
        return { ok: true, summary: `Switched to ${mode.name} mode.` }
      }

      case 'create_mode': {
        const order = (store.modes?.length || 0) + 1
        await createMode(uid, {
          name: args.name,
          icon: 'Sparkles',
          accentColor: args.color || '#8b5cf6',
          order,
        })
        return { ok: true, summary: `Created "${args.name}" mode.` }
      }

      case 'start_focus': {
        const subj = args.subjectName ? findByName(subjects, args.subjectName) : null
        if (args.subjectName && !subj)
          return { ok: false, error: `Subject "${args.subjectName}" not found.` }
        const durationMin =
          Number.isFinite(Number(args.durationMin)) && Number(args.durationMin) > 0
            ? Math.round(Number(args.durationMin))
            : undefined
        const label = subj?.name ? `Focus · ${subj.name}` : 'Deep Focus'
        store.startFocus?.({
          label,
          color: subj?.color || '#6366f1',
          subjectId: subj?.id || null,
          modeId: modeId || store.activeModeId || null,
          durationMin,
        })
        store.maximizeWidget?.('focus')
        return {
          ok: true,
          summary: `Started a${durationMin ? ` ${durationMin}-minute` : ''} focus session${subj ? ` on ${subj.name}` : ''}.`,
        }
      }

      case 'control_focus': {
        const action = String(args.action || '').trim().toLowerCase()
        if (store.status === 'idle' && action !== 'stop')
          return { ok: false, error: 'No focus session is running.' }
        if (action === 'pause') {
          store.pause?.()
          return { ok: true, summary: 'Paused the focus timer.' }
        }
        if (action === 'resume') {
          store.resume?.()
          return { ok: true, summary: 'Resumed the focus timer.' }
        }
        if (action === 'stop') {
          store.endToIdle?.()
          return { ok: true, summary: 'Stopped the focus session.' }
        }
        return { ok: false, error: `Unknown focus action "${args.action}".` }
      }

      case 'set_alarm': {
        const time = parseTimeTo24h(args.time)
        if (!time) return { ok: false, error: `Could not read the time "${args.time}".` }
        const repeat = ['once', 'daily', 'weekdays'].includes(args.repeat) ? args.repeat : 'once'
        createAlarm({ time, label: args.label || '', repeat })
        const [h, m] = time.split(':').map(Number)
        return {
          ok: true,
          summary: `Alarm set for ${minutesToLabel(h * 60 + m)}${args.label ? ` — ${args.label}` : ''} (${repeat}).`,
        }
      }

      case 'cancel_alarm': {
        const q = String(args.query || '').trim().toLowerCase()
        if (['stop', 'dismiss', 'current', 'silence', 'ringing', 'off'].includes(q) || !q) {
          stopAlarmRingtone()
          store.setAlarmModalOpen?.(false)
          return { ok: true, summary: 'Silenced the active alarm.' }
        }
        const alarms = getAlarms()
        const hit =
          alarms.find((a) => a.label?.toLowerCase() === q) ||
          alarms.find((a) => a.label?.toLowerCase().includes(q)) ||
          alarms.find((a) => a.time === parseTimeTo24h(args.query)) ||
          null
        if (!hit) return { ok: false, error: `No alarm matching "${args.query}".` }
        deleteAlarm(hit.id)
        return { ok: true, summary: `Cancelled the ${hit.time} alarm${hit.label ? ` (${hit.label})` : ''}.` }
      }

      case 'dismiss_assistant': {
        store.setHandsFreeActive?.(false)
        store.setHandsFreeStatus?.('idle')
        const message = args.message || "Going to sleep. Just say 'Hey Track' whenever you need me."
        return { ok: true, summary: message, dismissed: true }
      }

      case 'add_note': {
        await addNote(uid, {
          content: args.text,
          title: args.title || '',
          modeId: modeId || null,
        })
        return { ok: true, summary: `Saved a note${args.title ? `: "${args.title}"` : ''}.` }
      }

      case 'delete_todo': {
        const needle = String(args.text || '').toLowerCase()
        const t = todos.find((x) => x.text?.toLowerCase().includes(needle))
        if (!t) return { ok: false, error: `No to-do matching "${args.text}".` }
        await deleteTodo(uid, t.id)
        return { ok: true, summary: `Deleted the to-do "${t.text}".` }
      }

      case 'delete_task': {
        if (!modeId) return { ok: false, error: 'No active mode.' }
        const subj = findByName(subjects, args.subjectName)
        if (!subj) return { ok: false, error: `Subject "${args.subjectName}" not found.` }
        const tasks = await loadTasksOnce(uid, modeId, subj.id)
        const needle = String(args.taskTitle || '').toLowerCase()
        const task = tasks.find((x) => x.title?.toLowerCase().includes(needle))
        if (!task) return { ok: false, error: `No task matching "${args.taskTitle}" on ${subj.name}.` }
        await deleteTask(uid, modeId, subj.id, task.id)
        return { ok: true, summary: `Deleted "${task.title}" from ${subj.name}.` }
      }

      case 'delete_subject': {
        if (!modeId) return { ok: false, error: 'No active mode.' }
        const subj = findByName(subjects, args.subjectName)
        if (!subj) return { ok: false, error: `Subject "${args.subjectName}" not found.` }
        await deleteSubject(uid, modeId, subj.id)
        return { ok: true, summary: `Deleted the subject "${subj.name}" and its tasks.` }
      }

      case 'delete_habit': {
        const h = findByName(habits, args.habitName)
        if (!h) return { ok: false, error: `Habit "${args.habitName}" not found.` }
        await deleteHabit(uid, h.id)
        return { ok: true, summary: `Deleted the habit "${h.name}".` }
      }

      default:
        return null // signal "not an agent action" to the dispatcher
    }
  } catch (err) {
    return { ok: false, error: err?.message || 'Action failed.' }
  }
}

/** Names this module handles — used by the dispatcher to route quickly. */
export const AGENT_ACTION_NAMES = AGENT_TOOL_DECLARATIONS.map((d) => d.name)

export { DAYS }
