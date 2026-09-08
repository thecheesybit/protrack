import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Flag, Repeat, Sparkles, Check, Clock, Layers, Play } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { addTodo } from '@/services/todoService'
import { minutesToLabel, durationLabel, isSlotOnDay } from '@/lib/time'
import { getWeekDate, dayMinToDate, ymd } from '@/lib/dates'
import { playPop } from '@/lib/audioFX'
import { cn } from '@/utils/cn'

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const modes = useStore((s) => s.modes)
  const startFocus = useStore((s) => s.startFocus)
  const maximizeWidget = useStore((s) => s.maximizeWidget)
  const [selectedModeId, setSelectedModeId] = useState(() => modeId || (modes?.length ? modes[0].id : null))
  const [mode, setMode] = useState(null) // null | 'task' | 'event'
  const [title, setTitle] = useState('')
  const [curStartMin, setCurStartMin] = useState(startMin)
  const [curEndMin, setCurEndMin] = useState(endMin)
  const [isAllDay, setIsAllDay] = useState(false)
  const [saving, setSaving] = useState(false)

  // Keep internal range in sync if external selection updates
  useEffect(() => {
    setCurStartMin(startMin)
    setCurEndMin(endMin)
  }, [startMin, endMin])

  const rangeLabel = isAllDay ? 'All Day' : `${minutesToLabel(curStartMin)} – ${minutesToLabel(curEndMin)}`
  const dur = isAllDay ? 'All-day' : durationLabel(curStartMin, curEndMin)
  const selectedDateStr = ymd(getWeekDate(dayIndex))

  // Items that overlap the selected range on this day
  const rangeSlots = slots.filter(
    (s) => isSlotOnDay(s, dayIndex, new Date()) && s.startMin < curEndMin && s.endMin > curStartMin,
  )

  const rangeTodos = todos.filter((t) => {
    if (!t.dueAt || t.done) return false
    const d = t.dueAt?.toDate ? t.dueAt.toDate() : new Date(t.dueAt)
    if (isNaN(d)) return false
    if (ymd(d) !== selectedDateStr) return false
    const min = d.getHours() * 60 + d.getMinutes()
    return min >= curStartMin && min < curEndMin
  })

  const rangeEvents = todos.filter((t) => {
    if (t.type !== 'event' || t.done) return false
    return (
      t.eventDate === selectedDateStr &&
      t.eventStartMin < curEndMin &&
      (t.eventEndMin ?? t.eventStartMin + 60) > curStartMin
    )
  })

  const hasItems = rangeSlots.length > 0 || rangeTodos.length > 0 || rangeEvents.length > 0

  const reset = () => {
    setMode(null)
    setTitle('')
  }

  const handleStartFocus = () => {
    const durMin = Math.max(5, curEndMin - curStartMin)
    startFocus({
      label: title.trim() || `${dur} Scheduled Focus`,
      durationMin: durMin,
      color: '#10b981',
      modeId: selectedModeId,
    })
    maximizeWidget('focus')
    playPop()
    toast.success(`Started ${durationLabel(curStartMin, curEndMin)} focus session`)
    onClose()
  }

  const handleCreateSlot = () => {
    onCreateSlot?.({ dayIndex, startMin: curStartMin, endMin: curEndMin })
    onClose()
  }

  const save = async () => {
    const text = title.trim()
    if (!text || !user) return
    setSaving(true)
    try {
      playPop()
      const dueAt = isAllDay ? dayMinToDate(dayIndex, 9 * 60) : dayMinToDate(dayIndex, curStartMin)
      const targetModeId = selectedModeId || modeId || null
      if (mode === 'task') {
        await addTodo(user.uid, {
          text,
          modeId: targetModeId,
          dueAt,
          allDay: isAllDay,
          column: 'backlog',
        })
        toast.success(`Task added · ${isAllDay ? 'All Day' : minutesToLabel(curStartMin)}`)
      } else {
        const eventDate = selectedDateStr
        await addTodo(user.uid, {
          text,
          modeId: targetModeId,
          dueAt,
          type: 'event',
          eventDate,
          eventStartMin: isAllDay ? 9 * 60 : curStartMin,
          eventEndMin: isAllDay ? 18 * 60 : curEndMin,
          allDay: isAllDay,
          column: 'backlog',
        })
        toast.success(`Event added · ${isAllDay ? 'All Day' : minutesToLabel(curStartMin)}`)
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ActionBtn
                  icon={Play}
                  label={`Focus (${dur})`}
                  color="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                  onClick={handleStartFocus}
                />
                <ActionBtn
                  icon={Repeat}
                  label="Weekly Slot"
                  color="border-accent/30 text-accent bg-accent/5 hover:bg-accent/10"
                  onClick={handleCreateSlot}
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
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {mode === 'task' ? 'New task' : 'New event'}
                </p>
                <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="rounded border-line text-accent"
                  />
                  <span>All-day</span>
                </label>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  save()
                }}
              >
                {modes && modes.length > 1 && (
                  <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto py-0.5">
                    <span className="flex items-center gap-1 text-[10px] font-medium text-muted">
                      <Layers className="h-3 w-3" /> Scope:
                    </span>
                    {modes.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedModeId(m.id)}
                        className={cn(
                          'shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all',
                          selectedModeId === m.id
                            ? 'border border-accent/40 bg-accent/20 text-accent shadow-sm'
                            : 'border border-line/50 bg-surface-2/60 text-muted hover:text-ink',
                        )}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
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
