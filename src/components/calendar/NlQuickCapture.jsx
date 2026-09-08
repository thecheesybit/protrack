import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, CalendarClock, ListTodo, Link2, X, Loader2, CornerDownLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { parseCapture, dateToDow, dateToMinutes } from '@/lib/nlParse'
import { getWeekDate, dayMinToDate, ymd } from '@/lib/dates'
import { DAYS, DAY_START_MIN, minutesToLabel, clampMin } from '@/lib/time'
import { addSlot } from '@/services/timetableService'
import { addTodo } from '@/services/todoService'
import { getSubjectsOnce, addTask } from '@/services/subjectService'

/**
 * Natural-language quick capture. Opens when the calendar grid is clicked; the
 * user types ("Revise Polity tomorrow 5pm for 2h") and converts it — in one tap
 * — into a recurring session, a to-do with a deadline, or a subject-linked task.
 * Parsing is fully local (chrono-node), so it costs zero Firestore reads.
 */
export function NlQuickCapture({ open, onClose, seed, modeId, defaultColor }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [subjects, setSubjects] = useState([])
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState('')
  const modes = useStore((s) => s.modes)

  useEffect(() => {
    if (!open) {
      setText('')
      setPicking(false)
      setBusy('')
    }
  }, [open])

  // Lazily load subjects (cache-first) the first time the picker is needed.
  useEffect(() => {
    if (open && picking && user && modeId && subjects.length === 0) {
      if (modeId === 'all') {
        const activeModes = modes || []
        Promise.all(
          activeModes.map((m) =>
            getSubjectsOnce(user.uid, m.id).then((subjs) =>
              subjs.map((s) => ({
                ...s,
                _modeName: m.name,
                _modeColor: m.accentColor,
                _modeId: m.id,
              }))
            )
          )
        )
          .then((results) => {
            setSubjects(results.flat())
          })
          .catch(() => setSubjects([]))
      } else {
        getSubjectsOnce(user.uid, modeId).then(setSubjects).catch(() => setSubjects([]))
      }
    }
  }, [open, picking, user, modeId, subjects.length, modes])

  const parsed = useMemo(() => parseCapture(text), [text])

  // Derive session placement: parsed time wins, else the clicked grid cell.
  const placement = useMemo(() => {
    const dow = parsed.date ? dateToDow(parsed.date) : seed?.dayOfWeek ?? 0
    const startMin = parsed.date ? dateToMinutes(parsed.date) : seed?.startMin ?? DAY_START_MIN
    const endMin = parsed.endDate ? dateToMinutes(parsed.endDate) : startMin + 60
    return {
      dayOfWeek: dow,
      startMin: clampMin(startMin),
      endMin: clampMin(Math.max(endMin, startMin + 20)),
    }
  }, [parsed, seed])

  if (!user) return null
  const title = parsed.title || text.trim()
  const canSubmit = title.length > 0

  const done = (kind, detail) => {
    useStore.getState().pushIsland({ kind, title: 'Captured', detail, duration: 3200 })
    onClose()
  }

  const addAsSession = async () => {
    if (!canSubmit || busy) return
    setBusy('session')
    try {
      const targetModeId = modeId === 'all' ? (modes[0]?.id || '') : modeId
      await addSlot(user.uid, targetModeId, {
        dayOfWeek: placement.dayOfWeek,
        startMin: placement.startMin,
        endMin: placement.endMin,
        label: title,
        color: defaultColor,
      })
      done('success', `${DAYS[placement.dayOfWeek]} · ${minutesToLabel(placement.startMin)} session added`)
    } catch (err) {
      console.error('[capture] session failed', err)
      setBusy('')
    }
  }

  const addAsEvent = async () => {
    if (!canSubmit || busy) return
    setBusy('event')
    try {
      const targetModeId = modeId === 'all' ? (modes[0]?.id || '') : modeId
      const eventDate = ymd(getWeekDate(placement.dayOfWeek))
      const dueAt =
        parsed.date ||
        (seed?.dayOfWeek != null ? dayMinToDate(seed.dayOfWeek, seed.startMin ?? DAY_START_MIN) : null)
      await addTodo(user.uid, {
        text: title,
        modeId: targetModeId,
        dueAt,
        type: 'event',
        eventDate,
        eventStartMin: placement.startMin,
        eventEndMin: placement.endMin,
        column: 'backlog',
      })
      done('success', `${DAYS[placement.dayOfWeek]} · ${minutesToLabel(placement.startMin)} event added`)
    } catch (err) {
      console.error('[capture] event failed', err)
      setBusy('')
    }
  }

  const addAsTodo = async () => {
    if (!canSubmit || busy) return
    setBusy('todo')
    try {
      const targetModeId = modeId === 'all' ? (modes[0]?.id || '') : modeId
      const effectiveDue =
        parsed.date ||
        (seed?.dayOfWeek != null ? dayMinToDate(seed.dayOfWeek, seed.startMin ?? DAY_START_MIN) : null)
      await addTodo(user.uid, {
        text: title,
        modeId: targetModeId,
        dueAt: effectiveDue || null,
        subjectId: null,
      })
      done(
        'success',
        effectiveDue
          ? `To-do due ${effectiveDue.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
          : 'To-do added',
      )
    } catch (err) {
      console.error('[capture] todo failed', err)
      setBusy('')
    }
  }

  const addAsKanbanTask = async (subjectId) => {
    if (!canSubmit || busy) return
    setBusy('subject')
    try {
      const subject = subjects.find((s) => s.id === subjectId)
      const targetModeId = modeId === 'all' ? (subject?._modeId || modeId) : modeId
      const effectiveDue =
        parsed.date ||
        (seed?.dayOfWeek != null ? dayMinToDate(seed.dayOfWeek, seed.startMin ?? DAY_START_MIN) : null)
      await addTask(user.uid, targetModeId, subjectId, {
        title,
        column: 'todo',
        priority: 'medium',
        notes: '',
        dueAt: effectiveDue || null,
      })
      done('success', `Kanban card added to ${subject?.name || 'subject'}`)
    } catch (err) {
      console.error('[capture] kanban task failed', err)
      setBusy('')
    }
  }

  const scheduleChip = parsed.date
    ? `${DAYS[placement.dayOfWeek]} · ${minutesToLabel(placement.startMin)}${
        parsed.endDate ? ` – ${minutesToLabel(placement.endMin)}` : ''
      }`
    : seed
      ? `${DAYS[seed.dayOfWeek]} · ${minutesToLabel(seed.startMin)} (from grid)`
      : 'No time detected'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[18vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="edge-light relative w-full max-w-lg overflow-hidden rounded-3xl border border-line/70 bg-surface/90 p-5 shadow-glass-lg backdrop-blur-2xl"
          >
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-accent" />
              Quick capture
              <button
                type="button"
                onClick={onClose}
                className="ml-auto text-muted transition-colors hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addAsSession()
                  if (e.key === 'Escape') onClose()
                }}
                placeholder="e.g. Revise Polity tomorrow 5pm for 2h"
                className="w-full rounded-2xl border border-line/70 bg-surface-2/40 px-4 py-3 pr-10 text-sm outline-none placeholder:text-muted/60 focus:border-accent/60"
              />
              <CornerDownLeft className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/50" />
            </div>

            {/* Live interpretation */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent">
                <CalendarClock className="h-3.5 w-3.5" />
                {scheduleChip}
              </span>
              {title && (
                <span className="truncate rounded-full bg-surface-2/60 px-2.5 py-1 text-muted">
                  “{title}”
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              <ActionButton
                icon={Sparkles}
                label="Event"
                hint="One-time"
                busy={busy === 'event'}
                disabled={!canSubmit || Boolean(busy)}
                onClick={addAsEvent}
              />
              <ActionButton
                icon={CalendarClock}
                label="Session"
                hint="Weekly"
                busy={busy === 'session'}
                disabled={!canSubmit || Boolean(busy)}
                onClick={addAsSession}
              />
              <ActionButton
                icon={ListTodo}
                label="To-do"
                hint={parsed.date || seed ? 'Deadline' : 'No deadline'}
                busy={busy === 'todo'}
                disabled={!canSubmit || Boolean(busy)}
                onClick={addAsTodo}
              />
              <ActionButton
                icon={Link2}
                label="Subject"
                hint="Link task"
                busy={busy === 'subject'}
                disabled={!canSubmit || Boolean(busy)}
                onClick={() => setPicking((p) => !p)}
                active={picking}
              />
            </div>

            <AnimatePresence>
              {picking && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex flex-wrap gap-2">
                    {subjects.length === 0 ? (
                      <span className="text-xs text-muted">No subjects in this mode yet.</span>
                    ) : (
                      subjects.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => addAsKanbanTask(s.id)}
                          className="flex items-center gap-1.5 rounded-full border border-line/70 px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent/50 disabled:opacity-50"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ActionButton({ icon: Icon, label, hint, onClick, disabled, busy, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'border-accent/70 bg-accent/10' : 'border-line/70 bg-surface-2/40 hover:border-accent/40'
      }`}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin text-accent" /> : <Icon className="h-5 w-5 text-accent" />}
      <span className="text-xs font-semibold text-ink">{label}</span>
      <span className="text-[10px] text-muted">{hint}</span>
    </button>
  )
}
