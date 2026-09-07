/**
 * Gemini function-calling tool schema + executor.
 *
 * The assistant doesn't write to Firestore directly — it returns a structured
 * tool call, this executor validates it, looks up the right ids in the live
 * Zustand store, and calls the existing per-domain service. That keeps a single
 * source of truth (the services) and makes the tools safe to extend.
 *
 * Every tool returns `{ ok: true, summary }` or `{ ok: false, error }` so the
 * assistant can narrate the outcome back to the user.
 */
import { SchemaType } from '@google/generative-ai'
import {
  addTodo,
  updateTodo,
} from '@/services/todoService'
import {
  addSubject,
  setSubjectProgress,
  getSubjectsOnce,
  addTask,
  addTasksBulk,
  updateTask,
  subscribeToTasks,
} from '@/services/subjectService'
import { addSlot } from '@/services/timetableService'
import {
  addHabit,
  toggleHabitToday,
} from '@/services/habitService'
import { addLedgerEntry } from '@/services/ledgerService'
import { DAYS } from '@/lib/time'

/* ── Helpers ───────────────────────────────────────────────── */

function parseDayOfWeek(input) {
  if (input == null) return null
  const n = Number(input)
  if (Number.isInteger(n) && n >= 0 && n <= 6) return n
  const idx = DAYS.findIndex(
    (d) => d.toLowerCase() === String(input).slice(0, 3).toLowerCase(),
  )
  return idx === -1 ? null : idx
}

function parseClockMinutes(input) {
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
  return h * 60 + min
}

/** Fuzzy match a name against the live subject list. Returns the subject or null. */
function findSubject(subjects, name) {
  if (!name) return null
  const needle = String(name).trim().toLowerCase()
  return (
    subjects.find((s) => s.name?.toLowerCase() === needle) ||
    subjects.find((s) => s.name?.toLowerCase().includes(needle)) ||
    null
  )
}

function findHabit(habits, name) {
  if (!name) return null
  const needle = String(name).trim().toLowerCase()
  return (
    habits.find((h) => h.name?.toLowerCase() === needle) ||
    habits.find((h) => h.name?.toLowerCase().includes(needle)) ||
    null
  )
}

/** One-shot read of the tasks in a subject (the live ChatTab doesn't sub to all). */
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

/* ── Tool declarations (Gemini schema) ─────────────────────── */

export const TOOL_DECLARATIONS = [
  {
    functionDeclarations: [
      {
        name: 'complete_task',
        description:
          "Mark a task on a subject's Kanban board as Done. Use when the user says they finished or completed work on a subject. Recomputes the subject's progress percentage.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            subjectName: {
              type: SchemaType.STRING,
              description: 'Name of the subject containing the task',
            },
            taskTitle: {
              type: SchemaType.STRING,
              description:
                'Title (or partial title) of the task to complete. If omitted, all in-progress tasks for the subject are marked Done.',
            },
          },
          required: ['subjectName'],
        },
      },
      {
        name: 'set_subject_progress',
        description:
          "Set a subject's progress percentage directly (0-100). Use for explicit progress updates like 'set Calculus to 60%'.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            subjectName: { type: SchemaType.STRING },
            percent: {
              type: SchemaType.NUMBER,
              description: 'Whole number between 0 and 100',
            },
          },
          required: ['subjectName', 'percent'],
        },
      },
      {
        name: 'add_subject',
        description: 'Create a new subject in the active mode.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING },
            color: {
              type: SchemaType.STRING,
              description: 'Optional hex color like #8b5cf6',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'add_task',
        description:
          'Add a new Kanban task under an existing subject. column defaults to "todo".',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            subjectName: { type: SchemaType.STRING },
            title: { type: SchemaType.STRING },
            column: {
              type: SchemaType.STRING,
              description: '"todo" | "doing" | "done"',
            },
            priority: {
              type: SchemaType.STRING,
              description: '"low" | "medium" | "high" | "urgent"',
            },
            notes: {
              type: SchemaType.STRING,
              description: 'Optional notes / comments for the task',
            },
          },
          required: ['subjectName', 'title'],
        },
      },
      {
        name: 'add_tasks_bulk',
        description:
          'Add multiple tasks to an existing subject in a single batched operation. Ideal for lesson ranges or task lists.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            subjectName: {
              type: SchemaType.STRING,
              description: 'Name of the subject to add tasks to',
            },
            titles: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'List of task titles to create',
            },
          },
          required: ['subjectName', 'titles'],
        },
      },
      {
        name: 'add_todo',
        description: 'Add a quick to-do item to the global inbox.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            text: { type: SchemaType.STRING },
            dueAt: {
              type: SchemaType.STRING,
              description: 'Optional ISO 8601 datetime',
            },
            subjectName: {
              type: SchemaType.STRING,
              description: 'Optional subject this to-do belongs to',
            },
            priority: {
              type: SchemaType.STRING,
              description: '"low" | "medium" | "high" | "urgent"',
            },
            notes: {
              type: SchemaType.STRING,
              description: 'Optional notes / comments',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'mark_todo_done',
        description: 'Mark a quick to-do item as completed by matching its text.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            text: {
              type: SchemaType.STRING,
              description: 'Title (or substring) of the to-do',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'add_timetable_slot',
        description:
          'Add a recurring weekly timetable slot for the active mode. dayOfWeek 0=Mon..6=Sun.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            label: { type: SchemaType.STRING },
            dayOfWeek: {
              type: SchemaType.STRING,
              description: '"Mon".."Sun" or 0..6',
            },
            start: {
              type: SchemaType.STRING,
              description: 'Clock time like "9:00 AM" or "14:30"',
            },
            end: {
              type: SchemaType.STRING,
              description: 'Clock time like "10:30 AM" or "16:00"',
            },
            color: { type: SchemaType.STRING },
          },
          required: ['label', 'dayOfWeek', 'start', 'end'],
        },
      },
      {
        name: 'toggle_habit_today',
        description:
          "Toggle today's completion for a habit (mark it done if not, undo if already done).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            habitName: { type: SchemaType.STRING },
          },
          required: ['habitName'],
        },
      },
      {
        name: 'add_habit',
        description: 'Create a new habit to track.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING },
            timesPerDay: { type: SchemaType.NUMBER },
            interval: {
              type: SchemaType.STRING,
              description:
                '"none" | "every-1h" | "every-2h" | "every-4h" | "morning" | "evening"',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'set_todo_due',
        description: 'Set or clear the due date on an existing to-do item by matching its text.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            text: {
              type: SchemaType.STRING,
              description: 'Title (or substring) of the to-do',
            },
            dueAt: {
              type: SchemaType.STRING,
              description: 'ISO 8601 datetime to set, or omit/null to clear the due date',
            },
          },
          required: ['text'],
        },
      },
    ],
  },
]

/* ── Executor ──────────────────────────────────────────────── */

/**
 * @param {string} name  tool name as declared above
 * @param {object} args  arguments returned by Gemini
 * @param {{ uid: string, modeId: string, subjects: Array, habits: Array, todos: Array }} ctx
 * @returns {Promise<{ ok: boolean, summary?: string, error?: string }>}
 */
export async function executeTool(name, args, ctx) {
  try {
    const { uid, modeId, subjects, habits, todos } = ctx
    if (!uid) return { ok: false, error: 'Not signed in.' }

    switch (name) {
      case 'complete_task': {
        if (!modeId) return { ok: false, error: 'No active mode.' }
        const subj = findSubject(subjects, args.subjectName)
        if (!subj)
          return { ok: false, error: `Subject "${args.subjectName}" not found.` }
        const tasks = await loadTasksOnce(uid, modeId, subj.id)
        if (!tasks.length)
          return { ok: false, error: `No tasks on "${subj.name}".` }

        const target = args.taskTitle
          ? tasks.filter(
              (t) =>
                t.title?.toLowerCase().includes(args.taskTitle.toLowerCase()) &&
                t.column !== 'done',
            )
          : tasks.filter((t) => t.column !== 'done')
        if (!target.length)
          return {
            ok: false,
            error: args.taskTitle
              ? `Could not find an open task matching "${args.taskTitle}".`
              : `All tasks on "${subj.name}" already complete.`,
          }

        for (const t of target) {
          await updateTask(uid, modeId, subj.id, t.id, { column: 'done' })
        }
        const done = tasks.filter((t) => t.column === 'done').length + target.length
        const pct = Math.round((done / tasks.length) * 100)
        await setSubjectProgress(uid, modeId, subj.id, pct)
        await addLedgerEntry(uid, {
          kind: 'task',
          title: `${target.length} task${target.length > 1 ? 's' : ''} done · ${subj.name}`,
          detail: `Progress now ${pct}% (via AI)`,
          modeId,
        })
        return {
          ok: true,
          summary: `Marked ${target.length} task${target.length > 1 ? 's' : ''} done on "${subj.name}" — progress is now ${pct}%.`,
        }
      }

      case 'set_subject_progress': {
        if (!modeId) return { ok: false, error: 'No active mode.' }
        const subj = findSubject(subjects, args.subjectName)
        if (!subj) return { ok: false, error: `Subject "${args.subjectName}" not found.` }
        const pct = Math.max(0, Math.min(100, Math.round(Number(args.percent))))
        if (!Number.isFinite(pct)) return { ok: false, error: 'Invalid percent.' }
        await setSubjectProgress(uid, modeId, subj.id, pct)
        await addLedgerEntry(uid, {
          kind: 'milestone',
          title: `${subj.name} → ${pct}%`,
          detail: 'Updated via AI',
          modeId,
        })
        return { ok: true, summary: `"${subj.name}" set to ${pct}%.` }
      }

      case 'add_subject': {
        if (!modeId) return { ok: false, error: 'No active mode.' }
        await addSubject(uid, modeId, {
          name: args.name,
          color: args.color || '#8b5cf6',
          order: (subjects?.length || 0) + 1,
        })
        return { ok: true, summary: `Added subject "${args.name}".` }
      }

      case 'add_task': {
        if (!modeId) return { ok: false, error: 'No active mode.' }
        const subj = findSubject(subjects, args.subjectName)
        if (!subj) return { ok: false, error: `Subject "${args.subjectName}" not found.` }
        const col = ['todo', 'doing', 'done'].includes(args.column) ? args.column : 'todo'
        const priority = ['low', 'medium', 'high', 'urgent'].includes(args.priority)
          ? args.priority
          : 'medium'
        await addTask(uid, modeId, subj.id, {
          title: args.title,
          column: col,
          priority,
          notes: args.notes || '',
        })
        return { ok: true, summary: `Added "${args.title}" to ${subj.name} (${col}, ${priority}).` }
      }

      case 'add_tasks_bulk': {
        if (!modeId) return { ok: false, error: 'No active mode.' }
        const subj = findSubject(subjects, args.subjectName)
        if (!subj) return { ok: false, error: `Subject "${args.subjectName}" not found.` }
        if (!Array.isArray(args.titles) || args.titles.length === 0) {
          return { ok: false, error: 'No task titles provided.' }
        }
        const res = await addTasksBulk(uid, modeId, subj.id, args.titles, {
          subjectName: subj.name,
        })
        return {
          ok: true,
          summary: `Added ${res.count} task${res.count > 1 ? 's' : ''} to "${subj.name}".`,
        }
      }

      case 'add_todo': {
        const subj = args.subjectName ? findSubject(subjects, args.subjectName) : null
        const dueAt = args.dueAt ? new Date(args.dueAt) : null
        const dueValid = dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt.toISOString() : null
        const priority = ['low', 'medium', 'high', 'urgent'].includes(args.priority)
          ? args.priority
          : 'medium'
        await addTodo(uid, {
          text: args.text,
          modeId: modeId || null,
          dueAt: dueValid,
          subjectId: subj?.id || null,
          priority,
          notes: args.notes || '',
        })
        return { ok: true, summary: `Added to-do: "${args.text}" (${priority}).` }
      }

      case 'mark_todo_done': {
        const needle = String(args.text || '').toLowerCase()
        const t = todos?.find(
          (x) => !x.done && x.text?.toLowerCase().includes(needle),
        )
        if (!t) return { ok: false, error: `No open to-do matching "${args.text}".` }
        await updateTodo(uid, t.id, { done: true })
        return { ok: true, summary: `Checked off "${t.text}".` }
      }

      case 'add_timetable_slot': {
        if (!modeId) return { ok: false, error: 'No active mode.' }
        const dow = parseDayOfWeek(args.dayOfWeek)
        const startMin = parseClockMinutes(args.start)
        const endMin = parseClockMinutes(args.end)
        if (dow == null || startMin == null || endMin == null)
          return { ok: false, error: 'Could not parse day or time.' }
        if (endMin <= startMin) return { ok: false, error: 'End must be after start.' }
        await addSlot(uid, modeId, {
          label: args.label,
          dayOfWeek: dow,
          startMin,
          endMin,
          color: args.color || '#6366f1',
        })
        return {
          ok: true,
          summary: `Scheduled "${args.label}" on ${DAYS[dow]} ${args.start}–${args.end}.`,
        }
      }

      case 'toggle_habit_today': {
        const h = findHabit(habits, args.habitName)
        if (!h) return { ok: false, error: `Habit "${args.habitName}" not found.` }
        await toggleHabitToday(uid, h)
        const today = new Date().toISOString().slice(0, 10)
        const wasDone = (h.doneDates || []).includes(today)
        return {
          ok: true,
          summary: wasDone
            ? `Un-marked "${h.name}" for today.`
            : `Marked "${h.name}" done for today. Streak counted.`,
        }
      }

      case 'add_habit': {
        const interval = [
          'none',
          'every-1h',
          'every-2h',
          'every-4h',
          'morning',
          'evening',
        ].includes(args.interval)
          ? args.interval
          : 'none'
        await addHabit(uid, {
          name: args.name,
          timesPerDay: Math.max(1, Number(args.timesPerDay) || 1),
          interval,
          order: (habits?.length || 0) + 1,
        })
        return { ok: true, summary: `Created habit "${args.name}".` }
      }

      case 'set_todo_due': {
        const needle = String(args.text || '').toLowerCase()
        const t = todos?.find((x) => !x.done && x.text?.toLowerCase().includes(needle))
        if (!t) return { ok: false, error: `No open to-do matching "${args.text}".` }
        const dueAt = args.dueAt ? new Date(args.dueAt) : null
        const dueValid = dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null
        await updateTodo(uid, t.id, { dueAt: dueValid })
        return {
          ok: true,
          summary: dueValid
            ? `Due date on "${t.text}" set to ${dueValid.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.`
            : `Cleared due date on "${t.text}".`,
        }
      }

      default:
        return { ok: false, error: `Unknown tool: ${name}` }
    }
  } catch (err) {
    return { ok: false, error: err?.message || 'Tool execution failed.' }
  }
}

/** Used in tests / debug — keep getSubjectsOnce reachable from this module. */
export { getSubjectsOnce }
