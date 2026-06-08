import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Flag, Repeat, CalendarPlus, Sparkles, Check, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { addTodo } from '@/services/todoService'
import { minutesToLabel, durationLabel, DAY_FULL, isSlotOnDay } from '@/lib/time'
import { playPop } from '@/lib/audioFX'
import { cn } from '@/utils/cn'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the Date for dayIndex (0=Mon) of the current week. */
function getWeekDate(dayIndex) {
  const now = new Date()
  const nowDow = (now.getDay() + 6) % 7
  const d = new Date(now)
  d.setDate(now.getDate() + (dayIndex - nowDow))
  d.setHours(0, 0, 0, 0)
  return d
}

/** Return a Date set to dayIndex at the given minute-from-midnight. */
function dayMinToDate(dayIndex, min) {
  const d = getWeekDate(dayIndex)
  d.setHours(Math.floor(min / 60), min % 60, 0, 0)
  return d
}

function formatDate(dayIndex) {
  const d = getWeekDate(dayIndex)
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ActionBtn({ icon: Icon, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-center gap-1.5 rounded-2xl border py-3 text-xs font-semibold transition-all hover:scale-[1.03] active:scale-95',
        color,
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function ItemRow({ icon: Icon, label, detail, iconClass }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line/50 bg-surface-2/40 px-3 py-2">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', iconClass)} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{label}</span>
      {detail && <span className="shrink-0 text-[10px] text-muted">{detail}</span>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Appears after a drag-selection on the timetable. Shows existing items in the
 * selected window and offers three creation shortcuts:
 *   • Weekly Slot  → opens SlotEditorModal
 *   • Task         → creates a todo with dueAt set to the selected start time
 *   • Event        → creates a one-time event block (todo with type='event')
 */
export function TimeContextPanel({
  dayIndex,
  startMin,
  endMin,
  slots,
  todos,
  modeId,
  onClose,
  onCreateSlot,
}) {
  const { user } = useAuth()
  const [mode, setMode] = useState(null) // null | 'task' | 'event'
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const dayName = DAY_FULL[dayIndex] || 'Day'
  const rangeLabel = `${minutesToLabel(startMin)} – ${minutesToLabel(endMin)}`
  const dur = durationLabel(startMin, endMin)

  // Items that overlap the selected range on this day
  const rangeSlots = slots.filter(
    (s) => isSlotOnDay(s, dayIndex) && s.startMin < endMin && s.endMin > startMin,
  )

  const rangeTodos = todos.filter((t) => {
    if (!t.dueAt || t.done) return false
    const d = t.dueAt?.toDate ? t.dueAt.toDate() : new Date(t.dueAt)
    if (isNaN(d)) return false
    const dow = (d.getDay() + 6) % 7
    if (dow !== dayIndex) return false
    const min = d.getHours() * 60 + d.getMinutes()
    return min >= startMin && min < endMin
  })

  const rangeEvents = todos.filter((t) => {
    if (t.type !== 'event' || t.done) return false
    const d = getWeekDate(dayIndex)
    return (
      t.eventDate === d.toISOString().split('T')[0] &&
      t.eventStartMin < endMin &&
      (t.eventEndMin ?? t.eventStartMin + 60) > startMin
    )
  })

  const hasItems = rangeSlots.length > 0 || rangeTodos.length > 0 || rangeEvents.length > 0

  const reset = () => {
    setMode(null)
    setTitle('')
  }

  const save = async () => {
    const text = title.trim()
    if (!text || !user) return
    setSaving(true)
    try {
      playPop()
      const dueAt = dayMinToDate(dayIndex, startMin)
      if (mode === 'task') {
        await addTodo(user.uid, {
          text,
          modeId: modeId || null,
          dueAt,
          column: 'backlog',
        })
        toast.success('Task added')
      } else {
        const eventDate = getWeekDate(dayIndex).toISOString().split('T')[0]
        await addTodo(user.uid, {
          text,
          modeId: modeId || null,
          dueAt,
          type: 'event',
          eventDate,
          eventStartMin: startMin,
          eventEndMin: endMin,
          column: 'backlog',
        })
        toast.success('Event added')
      }
      onClose()
    } catch (err) {
      toast.error('Failed to save')
      console.error('[time-panel] save failed', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-3xl border border-line/70 bg-surface p-5 shadow-glass-lg"
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium text-muted">{formatDate(dayIndex)}</p>
            <p className="text-xl font-bold leading-tight text-ink">{rangeLabel}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
              <Clock className="h-3 w-3" />
              {dur}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-muted transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Existing items */}
        {hasItems && (
          <div className="mb-4 flex flex-col gap-1.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              In this window
            </p>
            {rangeSlots.map((s) => (
              <ItemRow
                key={s.id}
                icon={Repeat}
                label={s.label || 'Session'}
                detail={`${minutesToLabel(s.startMin)}–${minutesToLabel(s.endMin)}`}
                iconClass="text-accent/70"
              />
            ))}
            {rangeEvents.map((e) => (
              <ItemRow
                key={e.id}
                icon={Sparkles}
                label={e.text}
                detail={minutesToLabel(e.eventStartMin)}
                iconClass="text-violet-400"
              />
            ))}
            {rangeTodos.map((t) => (
              <ItemRow
                key={t.id}
                icon={Flag}
                label={t.text}
                iconClass="text-amber-400"
              />
            ))}
          </div>
        )}

        {/* Add mode selector / form */}
        <AnimatePresence mode="wait">
          {mode === null ? (
            <motion.div
              key="actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                Add to this time
              </p>
              <div className="flex gap-2">
                <ActionBtn
                  icon={Repeat}
                  label="Weekly Slot"
                  color="border-accent/30 text-accent bg-accent/5 hover:bg-accent/10"
                  onClick={() => {
                    onClose()
                    onCreateSlot()
                  }}
                />
                <ActionBtn
                  icon={Flag}
                  label="Task"
                  color="border-amber-500/30 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10"
                  onClick={() => setMode('task')}
                />
                <ActionBtn
                  icon={Sparkles}
                  label="Event"
                  color="border-violet-500/30 text-violet-400 bg-violet-500/5 hover:bg-violet-500/10"
                  onClick={() => setMode('event')}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.14 }}
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {mode === 'task' ? 'New task' : 'New event'}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  save()
                }}
              >
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={mode === 'task' ? 'Task title…' : 'Event title…'}
                  className="mb-2.5 w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex-1 rounded-xl border border-line py-2 text-xs font-semibold text-muted transition-colors hover:text-ink"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!title.trim() || saving}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white transition-all disabled:opacity-40',
                      mode === 'task' ? 'bg-amber-500' : 'bg-violet-500',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {saving ? 'Saving…' : mode === 'task' ? 'Add Task' : 'Add Event'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
