import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  useDroppable,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Check,
  X,
  Flag,
  GripVertical,
  Calendar,
  Zap,
  Inbox,
  Play,
  Clock3,
  Pencil,
  Undo2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { useTodos } from '@/hooks/useWellness'
import { WidgetFrame } from './WidgetFrame'
import { addTodo, updateTodo, deleteTodo, reorderTodos } from '@/services/todoService'
import { getPriority, nextPriority, PRIORITIES, PRIORITY_ORDER } from '@/lib/priority'
import { classifyDeadline } from '@/lib/deadlines'
import { parseCapture } from '@/lib/nlParse'
import toast from 'react-hot-toast'
import { playPop, playSuccess } from '@/lib/audioFX'
import { cn } from '@/utils/cn'

// ── Column configuration ──────────────────────────────────────────────────────

const COLS = {
  backlog: {
    id: 'backlog',
    label: 'Backlog',
    Icon: Inbox,
    headerClass: 'text-slate-400',
    borderClass: 'border-white/[0.08]',
    bgClass: 'bg-surface-2/20',
    cardBorder: 'border-white/[0.07] hover:border-white/20',
    cardBg: 'bg-surface-2/40 hover:bg-surface-2/65',
    emptyHint: 'Add tasks above',
  },
  doing: {
    id: 'doing',
    label: 'In Progress',
    Icon: Zap,
    headerClass: 'text-amber-400',
    borderClass: 'border-amber-500/25',
    bgClass: 'bg-amber-500/[0.04]',
    cardBorder: 'border-amber-500/30 hover:border-amber-500/50',
    cardBg: 'bg-amber-500/[0.08] hover:bg-amber-500/[0.13]',
    emptyHint: 'Double-click a backlog task',
  },
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDueShort(dueAt) {
  if (!dueAt) return ''
  const d = dueAt?.toDate ? dueAt.toDate() : new Date(dueAt)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

// ── PriorityDot ───────────────────────────────────────────────────────────────

function PriorityDot({ priority, onCycle }) {
  const p = getPriority(priority)
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onCycle?.()
      }}
      title={`Priority: ${p.label} — click to cycle`}
      className={cn('h-2.5 w-2.5 shrink-0 rounded-full ring-2', p.dot, p.ring)}
    />
  )
}

// ── Priority Legend ───────────────────────────────────────────────────────────

const PriorityLegend = memo(function PriorityLegend() {
  return (
    <div className="flex items-center gap-3 px-1 py-0.5">
      {PRIORITIES.map((p) => (
        <span key={p.key} className="flex items-center gap-1">
          <span className={cn('h-2 w-2 rounded-full', p.dot)} />
          <span className="text-[10px] text-muted">{p.label}</span>
        </span>
      ))}
    </div>
  )
})


// ── Calendar Deadline Picker ──────────────────────────────────────────────────

function CalendarDeadlinePicker({ x, y, dueAt, onSave, onClear, onClose }) {
  const today = new Date()

  const [selectedDate, setSelectedDate] = useState(() => {
    if (!dueAt) return null
    const d = dueAt?.toDate ? dueAt.toDate() : new Date(dueAt)
    return isNaN(d.getTime()) ? null : d
  })

  const [viewYear, setViewYear] = useState(() => (selectedDate || today).getFullYear())
  const [viewMonth, setViewMonth] = useState(() => (selectedDate || today).getMonth())


  const [timeHour, setTimeHour] = useState(() => {
    if (!dueAt) return null
    const d = dueAt?.toDate ? dueAt.toDate() : new Date(dueAt)
    if (isNaN(d.getTime())) return null
    const h24 = d.getHours()
    if (h24 === 0) return 12
    return h24 > 12 ? h24 - 12 : h24
  })
  const [timeMinute, setTimeMinute] = useState(() => {
    if (!dueAt) return 0
    const d = dueAt?.toDate ? dueAt.toDate() : new Date(dueAt)
    if (isNaN(d.getTime())) return 0
    return Math.round(d.getMinutes() / 5) * 5
  })
  const [timePeriod, setTimePeriod] = useState(() => {
    if (!dueAt) return 'AM'
    const d = dueAt?.toDate ? dueAt.toDate() : new Date(dueAt)
    if (isNaN(d.getTime())) return 'AM'
    return d.getHours() >= 12 ? 'PM' : 'AM'
  })

  // Build calendar grid
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1)
  const startOffset = firstDayOfMonth.getDay() // 0=Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // Pad to fill last row
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11) }
    else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0) }
    else setViewMonth((m) => m + 1)
  }

  const selectDay = (day) => {
    setSelectedDate(new Date(viewYear, viewMonth, day))
  }

  const save = () => {
    if (!selectedDate) {
      onClear()
      onClose()
      return
    }
    const d = new Date(selectedDate)
    if (timeHour != null) {
      const h24 = timePeriod === 'AM'
        ? (timeHour === 12 ? 0 : timeHour)
        : (timeHour === 12 ? 12 : timeHour + 12)
      d.setHours(h24, timeMinute || 0, 0, 0)
    } else {
      d.setHours(23, 59, 0, 0)
    }
    onSave(d)
    onClose()
  }

  // Clamp position to viewport
  const clampedX = Math.min(Math.max(x, 8), window.innerWidth - 300)
  const clampedY = Math.min(Math.max(y, 8), window.innerHeight - 520)

  const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.14 }}
      style={{ position: 'fixed', top: clampedY, left: clampedX, zIndex: 9999 }}
      className="w-[280px] rounded-2xl border border-line/70 bg-surface p-3 shadow-glass-lg backdrop-blur-xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-xs font-semibold text-ink">Set deadline</p>

      {/* Month navigation */}
      <div className="mb-2 flex items-center justify-between">
        <button onClick={prevMonth} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-semibold text-ink">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {DAY_LABELS.map((d) => (
          <span key={d} className="flex h-6 items-center justify-center text-[10px] font-medium text-muted/70">
            {d}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="mb-2.5 grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <span key={`e-${i}`} className="h-7" />

          const cellDate = new Date(viewYear, viewMonth, day)
          const isToday = sameDay(cellDate, today)
          const isSelected = selectedDate && sameDay(cellDate, selectedDate)
          const isPast = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())

          return (
            <button
              key={`d-${day}`}
              onClick={() => selectDay(day)}
              disabled={isPast}
              className={cn(
                'flex h-7 w-full items-center justify-center rounded-lg text-xs transition-all',
                isPast && 'text-muted/30 cursor-not-allowed',
                isSelected
                  ? 'bg-accent text-white font-bold shadow-glow-sm'
                  : isToday
                    ? 'ring-1 ring-accent/50 text-accent font-semibold hover:bg-accent/15'
                    : !isPast && 'text-ink hover:bg-surface-2',
              )}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* ── Visual Time Picker ── */}
      <div className="mb-2.5 rounded-xl border border-line/50 bg-surface-2/30 p-2.5">
        <div className="mb-2 flex items-center gap-1.5">
          <Clock3 className="h-3 w-3 text-muted" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Time</span>
          <span className="ml-auto text-xs font-bold tabular-nums text-ink">
            {timeHour != null
              ? `${timeHour}:${String(timeMinute || 0).padStart(2, '0')} ${timePeriod}`
              : '—'}
          </span>
        </div>

        {/* Hour grid (6×2) */}
        <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted/60">Hour</p>
        <div className="mb-2 grid grid-cols-6 gap-1">
          {HOURS.map((h) => (
            <button
              key={`h-${h}`}
              onClick={() => setTimeHour(h)}
              className={cn(
                'flex h-6 items-center justify-center rounded-md text-[11px] font-medium transition-all',
                timeHour === h
                  ? 'bg-accent text-white shadow-glow-sm'
                  : 'text-ink hover:bg-surface-2',
              )}
            >
              {h}
            </button>
          ))}
        </div>

        {/* Minute grid (6×2) */}
        <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted/60">Minute</p>
        <div className="mb-2 grid grid-cols-6 gap-1">
          {MINUTES.map((m) => (
            <button
              key={`m-${m}`}
              onClick={() => setTimeMinute(m)}
              className={cn(
                'flex h-6 items-center justify-center rounded-md text-[11px] font-medium transition-all',
                timeMinute === m && timeHour != null
                  ? 'bg-accent text-white shadow-glow-sm'
                  : 'text-ink hover:bg-surface-2',
              )}
            >
              {String(m).padStart(2, '0')}
            </button>
          ))}
        </div>

        {/* AM / PM toggle */}
        <div className="flex gap-1">
          {['AM', 'PM'].map((p) => (
            <button
              key={p}
              onClick={() => setTimePeriod(p)}
              className={cn(
                'flex-1 rounded-lg py-1 text-[11px] font-bold tracking-wide transition-all',
                timePeriod === p
                  ? 'bg-accent text-white shadow-glow-sm'
                  : 'text-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={save}
          disabled={!selectedDate}
          className="flex-1 rounded-xl bg-accent py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
        {dueAt && (
          <button
            onClick={() => { onClear(); onClose() }}
            className="rounded-xl border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink"
          >
            Clear
          </button>
        )}
        <button
          onClick={onClose}
          className="rounded-xl border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  )
}

// ── Drop Animation Configuration ───────────────────────────────────────────────

const dropAnimationConfig = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
  duration: 250,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
}

// ── KanbanCardOverlay (Floating preview while dragging) ───────────────────────

function KanbanCardOverlay({ todo, isFocusReady }) {
  if (!todo) return null
  const col = COLS[todo.column || 'backlog']
  const urgency = classifyDeadline(todo.dueAt)
  const isDoing = (todo.column || 'backlog') === 'doing'

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border backdrop-blur-2xl select-none cursor-grabbing transition-transform duration-150',
        'shadow-2xl ring-2 ring-accent/60 bg-surface/95 scale-[1.04] rotate-[1.5deg]',
        col.cardBorder,
        col.cardBg,
        isFocusReady && 'ring-2 ring-amber-500/60',
      )}
      style={{
        boxShadow: '0 20px 35px -8px rgba(0, 0, 0, 0.45), 0 0 24px -2px rgba(99, 102, 241, 0.35)',
      }}
    >
      {/* Main row */}
      <div className="flex items-start gap-2 p-2.5">
        <div className="mt-0.5 text-accent">
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5">
          <Check className="h-2.5 w-2.5 text-transparent" />
        </div>

        {isDoing && (
          <span className="mt-1.5 relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
          </span>
        )}

        <span className="min-w-0 flex-1 text-xs leading-relaxed font-medium text-ink">
          {todo.text}
        </span>

        <PriorityDot priority={todo.priority} />
      </div>

      {/* Deadline row */}
      {todo.dueAt && (
        <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pl-[28px]">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm',
              urgency === 'overdue'
                ? 'border-rose-500/30 bg-rose-500/15 text-rose-300'
                : 'border-white/10 bg-white/[0.06] text-muted',
            )}
          >
            <Clock3 className="h-2.5 w-2.5 shrink-0" />
            {formatDueShort(todo.dueAt)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── KanbanCard ────────────────────────────────────────────────────────────────

const KanbanCard = memo(function KanbanCard({
  todo,
  onToggle,
  onUpdate,
  onDelete,
  onDoubleClick,
  isFocusReady,
  onStartFocus,
  onDeadlineClick,
  onPushBack,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id, data: { column: todo.column || 'backlog' } })

  const [editing, setEditing] = useState(false)
  const [textDraft, setTextDraft] = useState(todo.text)

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    position: 'relative',
  }
  const col = COLS[todo.column || 'backlog']
  const urgency = classifyDeadline(todo.dueAt)
  const isDoing = (todo.column || 'backlog') === 'doing'

  const saveEdit = () => {
    const v = textDraft.trim()
    if (v && v !== todo.text) onUpdate({ text: v })
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex flex-col rounded-2xl border transition-all duration-200',
        isDragging
          ? 'border-2 border-dashed border-accent/60 bg-accent/[0.04] opacity-35 scale-[0.98]'
          : cn(col.cardBorder, col.cardBg, 'backdrop-blur-md hover:-translate-y-0.5 hover:shadow-premium-sm'),
        isFocusReady && !isDragging && 'ring-2 ring-amber-500/40',
      )}
    >
      {/* Main row */}
      <div
        className="flex items-start gap-2 p-2.5"
        onDoubleClick={(e) => {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return
          onDoubleClick()
        }}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none text-muted/30 hover:text-muted active:cursor-grabbing transition-colors"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Checkbox */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onToggle()}
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5 transition-all hover:border-emerald-400 hover:bg-emerald-500/15"
          aria-label="Toggle done"
        >
          <Check className="h-2.5 w-2.5 text-transparent group-hover:text-emerald-500/70 transition-colors" />
        </button>

        {/* Active Doing pulse indicator */}
        {isDoing && (
          <span className="mt-1.5 relative flex h-1.5 w-1.5 shrink-0" title="In progress">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
          </span>
        )}

        {editing ? (
          <input
            autoFocus
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
              if (e.key === 'Escape') setEditing(false)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 rounded-lg border border-accent/60 bg-surface-2/80 px-2 py-0.5 text-xs outline-none shadow-inner-sm"
          />
        ) : (
          <span className="min-w-0 flex-1 cursor-default text-xs leading-relaxed text-ink/95">
            {todo.text}
          </span>
        )}

        <PriorityDot
          priority={todo.priority}
          onCycle={() => onUpdate({ priority: nextPriority(todo.priority || 'medium') })}
        />

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setTextDraft(todo.text); setEditing(true) }}
          className="hidden shrink-0 text-muted/50 hover:text-ink group-hover:block transition-colors"
          aria-label="Edit"
        >
          <Pencil className="h-3 w-3" />
        </button>

        {/* X button: in "doing" → push back; in "backlog" → delete */}
        {isDoing ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onPushBack?.() }}
            className="hidden shrink-0 text-muted/50 hover:text-amber-400 group-hover:block transition-colors"
            aria-label="Move back to Backlog"
            title="Move back to Backlog"
          >
            <Undo2 className="h-3 w-3" />
          </button>
        ) : (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="hidden shrink-0 text-muted/50 hover:text-rose-400 group-hover:block transition-colors"
            aria-label="Delete"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Deadline row */}
      <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pl-[28px]">
        {todo.dueAt ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDeadlineClick(e) }}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm transition-all',
              urgency === 'overdue'
                ? 'border-rose-500/30 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                : 'border-white/10 bg-white/[0.06] text-muted hover:border-white/20 hover:text-ink',
            )}
          >
            <Clock3 className="h-2.5 w-2.5 shrink-0" />
            {formatDueShort(todo.dueAt)}
          </button>
        ) : (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDeadlineClick(e) }}
            className="hidden items-center gap-1 rounded-full border border-white/5 bg-white/[0.04] px-2 py-0.5 text-[10px] text-muted hover:border-white/15 hover:text-ink group-hover:flex transition-all"
          >
            <Calendar className="h-2.5 w-2.5" />
            Deadline
          </button>
        )}
      </div>

      {/* Focus-ready banner */}
      <AnimatePresence>
        {isFocusReady && (
          <motion.div
            initial={{ opacity: 0, y: 4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 2, height: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-2 mb-2.5 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-amber-400/8 px-2.5 py-2 backdrop-blur-sm">
              <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400 animate-pulse" />
              <span className="flex-1 text-[11px] font-semibold text-amber-300">Ready to focus?</span>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onPushBack?.() }}
                title="Push back to Backlog"
                className="shrink-0 rounded-lg p-1 text-amber-400/50 transition-colors hover:bg-amber-500/15 hover:text-amber-300"
                aria-label="Push back to Backlog"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onStartFocus() }}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1 text-[10px] font-bold text-white shadow-premium-sm transition-transform hover:scale-105 active:scale-95"
              >
                <Play className="h-2.5 w-2.5 fill-white" />
                Begin
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})


// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({
  colId,
  todos,
  focusReadyId,
  onDoubleClick,
  onToggle,
  onUpdate,
  onDelete,
  onStartFocus,
  onDeadlineClick,
  onPushBack,
  onFocusAdd,
  style,
}) {
  const col = COLS[colId]
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: colId })

  return (
    <div
      style={style || { flex: '1 1 0%' }}
      className={cn(
        'flex min-w-0 flex-col rounded-3xl border transition-all duration-300 backdrop-blur-md',
        col.borderClass,
        col.bgClass,
        isOver && 'ring-2 ring-accent/60 bg-accent/[0.06] shadow-glow-sm',
      )}
    >
      <div className={cn('flex shrink-0 items-center gap-2 px-3.5 py-2.5 text-xs font-semibold', col.headerClass)}>
        <col.Icon className="h-3.5 w-3.5" />
        {col.label}
        <button
          type="button"
          onClick={() => onFocusAdd?.(colId)}
          className="ml-auto flex items-center gap-0.5 rounded-lg border border-line/60 bg-surface-2/40 px-1.5 py-0.5 text-[9px] font-medium text-muted hover:text-ink hover:border-accent/40 transition-colors"
          title={`Add task to ${col.label}`}
        >
          <Plus className="h-2.5 w-2.5" /> Add
        </button>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-muted">
          {todos.length}
        </span>
      </div>

      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setDropRef}
          onDoubleClick={(e) => {
            if (e.target === e.currentTarget || e.target.closest('.empty-column-trigger')) {
              onFocusAdd?.(colId)
            }
          }}
          className="flex min-h-[56px] flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5"
        >
          {todos.map((t) => (
            <KanbanCard
              key={t.id}
              todo={t}
              isFocusReady={focusReadyId === t.id}
              onDoubleClick={() => onDoubleClick(t)}
              onToggle={() => onToggle(t)}
              onUpdate={(patch) => onUpdate(t.id, patch)}
              onDelete={() => onDelete(t.id)}
              onStartFocus={() => onStartFocus(t)}
              onDeadlineClick={(e) => onDeadlineClick(t.id, t.dueAt, e)}
              onPushBack={() => onPushBack?.(t)}
            />
          ))}
          {todos.length === 0 && (
            <div
              className={cn(
                'empty-column-trigger flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-white/5 py-6 text-center text-xs font-medium text-muted/50 transition-colors m-0.5 cursor-pointer hover:border-accent/30',
                isOver && 'border-accent/40 bg-accent/5 text-accent',
              )}
              title="Double-click to add task"
            >
              {col.emptyHint}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ── TodosWidget ───────────────────────────────────────────────────────────────

export function TodosWidget({ widget, variant }) {
  const { user } = useAuth()
  const activeModeId = useStore((s) => s.activeModeId)
  const startFocus = useStore((s) => s.startFocus)
  const todos = useTodos()

  const [text, setText] = useState('')
  const [pendingDueAt, setPendingDueAt] = useState(null)
  const [focusReadyId, setFocusReadyId] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [deadlinePicker, setDeadlinePicker] = useState(null)
  const [targetColumn, setTargetColumn] = useState('backlog')
  const inputRef = useRef(null)

  const handleFocusColumn = (colId) => {
    setTargetColumn(colId)
    inputRef.current?.focus()
  }

  const parsed = useMemo(() => parseCapture(text), [text])
  const effectiveDeadline = pendingDueAt || parsed.date

  const isHero = variant === 'hero'

  const filtered = useMemo(
    () => todos.filter((t) => activeModeId === 'all' || t.modeId === activeModeId),
    [todos, activeModeId],
  )

  const backlogTodos = useMemo(
    () =>
      filtered
        .filter((t) => !t.done && (t.column || 'backlog') === 'backlog')
        .sort((a, b) => {
          if (a.order != null && b.order != null) return a.order - b.order
          return (PRIORITY_ORDER[a.priority || 'medium'] ?? 2) - (PRIORITY_ORDER[b.priority || 'medium'] ?? 2)
        }),
    [filtered],
  )

  const doingTodos = useMemo(
    () => filtered.filter((t) => !t.done && (t.column || 'backlog') === 'doing'),
    [filtered],
  )

  const doneTodos = useMemo(() => filtered.filter((t) => t.done), [filtered])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  const submit = async () => {
    const value = text.trim()
    if (!value) return

    let dueAt = pendingDueAt || parsed.date || null
    let taskText = parsed.date && parsed.title ? parsed.title : value

    // If dueAt is at midnight (00:00) with unspecified time, default to 09:00 AM so it displays on the calendar
    if (dueAt) {
      const d = new Date(dueAt)
      if (d.getHours() === 0 && d.getMinutes() === 0) {
        d.setHours(9, 0, 0, 0)
        dueAt = d
      }
    }

    setText('')
    setPendingDueAt(null)

    try {
      playPop()
      await addTodo(user.uid, {
        text: taskText,
        modeId: activeModeId === 'all' ? null : activeModeId,
        column: targetColumn || 'backlog',
        dueAt: dueAt || null,
      })
      if (dueAt) {
        const dueStr = new Date(dueAt).toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
        toast.success(`Task added · Due ${dueStr}`)
      }
    } catch (err) {
      console.error('[todo] add failed', err)
      toast.error('Failed to add task')
    }
  }

  const onToggle = (t) => {
    if (!t.done) { playSuccess(); if (focusReadyId === t.id) setFocusReadyId(null) }
    updateTodo(user.uid, t.id, { done: !t.done })
  }

  const onDelete = (id) => {
    if (focusReadyId === id) setFocusReadyId(null)
    deleteTodo(user.uid, id)
  }

  const onUpdate = useCallback((id, patch) => updateTodo(user.uid, id, patch), [user?.uid])

  const onDoubleClick = (t) => {
    const col = t.column || 'backlog'
    if (col === 'doing') { setFocusReadyId((prev) => (prev === t.id ? null : t.id)); return }
    playPop()
    updateTodo(user.uid, t.id, { column: 'doing' })
    setFocusReadyId(t.id)
  }

  const onPushBack = (t) => {
    updateTodo(user.uid, t.id, { column: 'backlog' })
    setFocusReadyId(null)
  }

  const onStartFocus = (t) => {
    setFocusReadyId(null)
    startFocus({
      label: t.text,
      color: '#f59e0b',
      modeId: t.modeId || (activeModeId === 'all' ? null : activeModeId),
      subjectId: t.subjectId || null,
      todoId: t.id,
    })
  }

  const onDeadlineClick = (todoId, dueAt, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setDeadlinePicker({ todoId, dueAt, x: rect.left, y: rect.bottom + 4 })
  }

  const [columns, setColumns] = useState({
    backlog: [],
    doing: [],
  })

  // Synchronize local columns with store todos when not actively dragging
  useEffect(() => {
    if (!activeId) {
      setColumns({
        backlog: backlogTodos,
        doing: doingTodos,
      })
    }
  }, [backlogTodos, doingTodos, activeId])

  const columnsRef = useRef(columns)
  columnsRef.current = columns

  const findCol = useCallback((id) => {
    if (!id) return null
    if (id === 'backlog' || id === 'doing') return id
    const current = columnsRef.current
    if (current.backlog.some((t) => t.id === id)) return 'backlog'
    if (current.doing.some((t) => t.id === id)) return 'doing'
    return null
  }, [])

  const collisionDetectionStrategy = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      return pointerCollisions
    }
    return closestCorners(args)
  }, [])

  const onDragStart = useCallback(({ active }) => {
    setActiveId(active.id)
    playPop()
  }, [])

  const onDragOver = useCallback(({ active, over }) => {
    if (!over) return

    const activeId = active.id
    const overId = over.id

    const activeCol = findCol(activeId)
    const overCol = findCol(overId)

    if (!activeCol || !overCol || activeCol === overCol) {
      return
    }

    setColumns((prev) => {
      const activeItems = prev[activeCol]
      const overItems = prev[overCol]

      const activeIndex = activeItems.findIndex((t) => t.id === activeId)
      if (activeIndex === -1) return prev

      const activeItem = activeItems[activeIndex]
      const overIndex = overItems.findIndex((t) => t.id === overId)

      let newIndex
      if (overId === overCol) {
        newIndex = overItems.length
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height / 2
        const modifier = isBelowOverItem ? 1 : 0
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length
      }

      return {
        ...prev,
        [activeCol]: activeItems.filter((t) => t.id !== activeId),
        [overCol]: [
          ...overItems.slice(0, newIndex),
          { ...activeItem, column: overCol },
          ...overItems.slice(newIndex),
        ],
      }
    })
  }, [findCol])

  const onDragEnd = useCallback(({ active, over }) => {
    setActiveId(null)

    if (!over) {
      setColumns({ backlog: backlogTodos, doing: doingTodos })
      return
    }

    const activeCol = findCol(active.id)
    const overCol = findCol(over.id)

    if (!activeCol || !overCol) {
      setColumns({ backlog: backlogTodos, doing: doingTodos })
      return
    }

    const currentCols = columnsRef.current
    const activeIndex = currentCols[activeCol].findIndex((t) => t.id === active.id)
    const overIndex = currentCols[overCol].findIndex((t) => t.id === over.id)

    let finalItems = currentCols[overCol]
    if (activeCol === overCol && activeIndex !== overIndex && overIndex !== -1) {
      finalItems = arrayMove(currentCols[overCol], activeIndex, overIndex)
      setColumns((prev) => ({
        ...prev,
        [overCol]: finalItems,
      }))
    }

    playPop()

    const originalTodo = todos.find((t) => t.id === active.id)
    const origCol = originalTodo?.column || 'backlog'

    if (origCol !== overCol) {
      updateTodo(user.uid, active.id, { column: overCol })
      if (overCol === 'doing') setFocusReadyId(active.id)
      else if (focusReadyId === active.id) setFocusReadyId(null)
    }

    // Persist ordering
    reorderTodos(user.uid, finalItems.map((t) => t.id))
  }, [findCol, backlogTodos, doingTodos, todos, user?.uid, focusReadyId])

  const onDragCancel = useCallback(() => {
    setActiveId(null)
    setColumns({ backlog: backlogTodos, doing: doingTodos })
  }, [backlogTodos, doingTodos])

  const activeTodo = useMemo(() => {
    if (!activeId) return null
    return (
      columns.backlog.find((t) => t.id === activeId) ||
      columns.doing.find((t) => t.id === activeId) ||
      todos.find((t) => t.id === activeId) ||
      null
    )
  }, [activeId, columns, todos])

  const openCount = columns.backlog.length + columns.doing.length

  const { backlogFlex, doingFlex } = useMemo(() => {
    if (isHero) {
      return { backlogFlex: '1 1 0%', doingFlex: '1 1 0%' }
    }
    const backlogCount = columns.backlog.length
    const doingCount = columns.doing.length

    if (backlogCount === 0 && doingCount === 0) {
      return { backlogFlex: '1 1 0%', doingFlex: '1 1 0%' }
    }
    if (backlogCount === 0) {
      return { backlogFlex: '0 0 76px', doingFlex: '1 1 0%' }
    }
    if (doingCount === 0) {
      return { backlogFlex: '1 1 0%', doingFlex: '0 0 76px' }
    }

    // Both have tasks, scale proportionally with clamping to prevent extremes
    const total = backlogCount + doingCount
    const ratio = backlogCount / total
    const clamped = Math.max(0.3, Math.min(0.7, ratio))
    return {
      backlogFlex: `${clamped} ${clamped} 0%`,
      doingFlex: `${1 - clamped} ${1 - clamped} 0%`,
    }
  }, [isHero, columns.backlog.length, columns.doing.length])

  return (
    <WidgetFrame widget={widget} variant={variant} subtitle={`${openCount} open`}>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {/* Add input capsule */}
        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="flex flex-col gap-2">
          <div className="group/capsule flex items-center gap-2 rounded-2xl border border-white/10 bg-surface-2/40 px-3 py-1.5 shadow-inner-sm backdrop-blur-md transition-all focus-within:border-accent/50 focus-within:bg-surface-2/70 focus-within:ring-2 focus-within:ring-accent/20">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={targetColumn === 'doing' ? "Add to Doing… (e.g. 'Math test 10am')" : "Add a task… (e.g. 'Math test tomorrow 10am')"}
              className="min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-ink placeholder:text-muted/60 outline-none"
            />
            <button
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setDeadlinePicker({
                  forNew: true,
                  dueAt: effectiveDeadline,
                  x: Math.min(rect.left, window.innerWidth - 300),
                  y: rect.bottom + 4,
                })
              }}
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border transition-all',
                effectiveDeadline
                  ? 'border-accent/40 bg-accent/20 text-accent'
                  : 'border-transparent text-muted/60 hover:border-white/10 hover:bg-white/5 hover:text-ink',
              )}
              title={effectiveDeadline ? 'Change deadline' : 'Set deadline'}
              aria-label="Set deadline"
            >
              <Calendar className="h-3.5 w-3.5" />
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-glow-sm transition-all hover:brightness-110 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:hover:brightness-100"
              aria-label="Add"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {effectiveDeadline && (
            <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] text-accent backdrop-blur-sm">
              <span className="flex items-center gap-1.5 truncate">
                <Clock3 className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Due:{' '}
                  <strong className="font-semibold">
                    {new Date(effectiveDeadline).toLocaleString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                </span>
                {parsed.matched && !pendingDueAt && (
                  <span className="truncate text-[10px] opacity-75">
                    (from &quot;{parsed.matched}&quot;)
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPendingDueAt(null)
                  if (parsed.matched && !pendingDueAt) {
                    setText(parsed.title || '')
                  }
                }}
                className="ml-1 rounded p-0.5 transition-colors hover:text-ink"
                title="Remove deadline"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </form>

        {/* Priority Legend */}
        <PriorityLegend />

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted">
            <Flag className="h-6 w-6 text-muted/60" />
            <span className="text-xs">Capture your first task above.</span>
          </div>
        )}

        {/* Kanban board with fluid DragOverlay & designated drop area animation */}
        {filtered.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <div className={cn('flex min-h-0 flex-1 gap-2', isHero ? 'flex-row' : 'flex-col')}>
              <KanbanColumn
                colId="backlog"
                todos={columns.backlog}
                focusReadyId={focusReadyId}
                onDoubleClick={onDoubleClick}
                onFocusAdd={handleFocusColumn}
                onToggle={onToggle}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onStartFocus={onStartFocus}
                onDeadlineClick={onDeadlineClick}
                onPushBack={onPushBack}
                style={{ flex: backlogFlex }}
              />
              <KanbanColumn
                colId="doing"
                todos={columns.doing}
                focusReadyId={focusReadyId}
                onDoubleClick={onDoubleClick}
                onFocusAdd={handleFocusColumn}
                onToggle={onToggle}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onStartFocus={onStartFocus}
                onDeadlineClick={onDeadlineClick}
                onPushBack={onPushBack}
                style={{ flex: doingFlex }}
              />
            </div>

            <DragOverlay dropAnimation={dropAnimationConfig}>
              {activeTodo ? (
                <KanbanCardOverlay
                  todo={activeTodo}
                  isFocusReady={focusReadyId === activeTodo.id}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Done section */}
        {doneTodos.length > 0 && (
          <div className="mt-1 shrink-0 rounded-3xl border border-white/[0.08] bg-surface-2/20 px-3 py-2.5 backdrop-blur-md">
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              <Check className="h-3 w-3 text-emerald-400" />
              <span>Completed</span>
              <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-muted">{doneTodos.length}</span>
            </p>
            <div className="flex flex-col gap-1">
              {doneTodos.slice(0, isHero ? 50 : 3).map((t) => (
                <div key={t.id} className="group flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-white/5 transition-colors">
                  <button
                    onClick={() => onToggle(t)}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-transparent bg-emerald-500/80 text-white transition-colors hover:bg-emerald-500"
                    aria-label="Mark not done"
                  >
                    <Check className="h-2.5 w-2.5" />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted/60 line-through">{t.text}</span>
                  <button
                    onClick={() => onDelete(t.id)}
                    className="hidden text-muted/40 hover:text-rose-400 group-hover:block"
                    aria-label="Delete"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Calendar deadline picker — portaled to document.body */}
      {createPortal(
        <AnimatePresence>
          {deadlinePicker && (
            <>
              <div
                className="fixed inset-0"
                style={{ zIndex: 9998 }}
                onClick={() => setDeadlinePicker(null)}
              />
              <CalendarDeadlinePicker
                x={deadlinePicker.x}
                y={deadlinePicker.y}
                dueAt={deadlinePicker.dueAt}
                onSave={(date) => {
                  if (deadlinePicker.forNew) {
                    setPendingDueAt(date)
                  } else {
                    onUpdate(deadlinePicker.todoId, { dueAt: date })
                  }
                  setDeadlinePicker(null)
                }}
                onClear={() => {
                  if (deadlinePicker.forNew) {
                    setPendingDueAt(null)
                  } else {
                    onUpdate(deadlinePicker.todoId, { dueAt: null })
                  }
                  setDeadlinePicker(null)
                }}
                onClose={() => setDeadlinePicker(null)}
              />
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </WidgetFrame>
  )
}
