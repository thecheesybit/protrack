import { useState, useMemo } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Check, X, Flag, GripVertical, StickyNote, Calendar, Pencil, Copy } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { useTodos } from '@/hooks/useWellness'
import { WidgetFrame } from './WidgetFrame'
import { addTodo, updateTodo, deleteTodo, reorderTodos } from '@/services/todoService'
import { getPriority, nextPriority, PRIORITIES, PRIORITY_ORDER } from '@/lib/priority'
import { classifyDeadline } from '@/lib/deadlines'
import { PriorityLegend } from '@/components/common/PriorityLegend'
import { playPop, playSuccess } from '@/lib/audioFX'
import { cn } from '@/utils/cn'

function toDTLocal(dueAt) {
  if (!dueAt) return ''
  const d = dueAt?.toDate ? dueAt.toDate() : new Date(dueAt)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDueShort(dueAt) {
  if (!dueAt) return ''
  const d = dueAt?.toDate ? dueAt.toDate() : new Date(dueAt)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

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
      aria-label={`Priority ${p.label}`}
    />
  )
}

function Row({ t, index, onToggle, onDelete, onUpdate, onDuplicate }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: t.id })

  const [expanded, setExpanded] = useState(false)
  const [notesDraft, setNotesDraft] = useState(t.notes || '')
  const [editing, setEditing] = useState(false)
  const [textDraft, setTextDraft] = useState(t.text)

  const style = { transform: CSS.Translate.toString(transform), transition }

  const cycleP = () => onUpdate({ priority: nextPriority(t.priority || 'medium') })
  const saveNotes = () => {
    if (notesDraft !== (t.notes || '')) onUpdate({ notes: notesDraft })
  }
  const startEdit = () => { setTextDraft(t.text); setEditing(true) }
  const saveEdit = () => {
    const v = textDraft.trim()
    if (v && v !== t.text) onUpdate({ text: v })
    setEditing(false)
  }
  const cancelEdit = () => setEditing(false)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-xl border border-line/50 bg-surface-2/30',
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted/50 hover:text-muted active:cursor-grabbing"
          aria-label="Drag"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onToggle(t)}
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
            t.done
              ? 'border-transparent bg-accent text-white'
              : 'border-line text-transparent hover:border-accent',
          )}
          aria-label="Toggle done"
        >
          <Check className="h-3 w-3" />
        </button>
        <div className="min-w-0 flex-1 flex items-center">
          <span className="text-muted/50 font-mono text-xs mr-2 select-none shrink-0">{index + 1}.</span>
          {editing ? (
            <input
              autoFocus
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
                if (e.key === 'Escape') cancelEdit()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded border border-accent/60 bg-surface-2/60 px-1.5 py-0.5 text-sm outline-none"
            />
          ) : (
            <span
              onDoubleClick={() => setExpanded((v) => !v)}
              className={cn('flex-1 min-w-0 truncate text-sm cursor-default', t.done && 'text-muted line-through')}
            >
              {t.text}
            </span>
          )}
        </div>
        {t.notes && !expanded && (
          <StickyNote className="h-3 w-3 shrink-0 text-amber-400/80" />
        )}
        {t.dueAt && !expanded && (
          <Calendar
            title={formatDueShort(t.dueAt)}
            className={cn(
              'h-3 w-3 shrink-0',
              classifyDeadline(t.dueAt) === 'overdue' ? 'text-rose-400' : 'text-amber-400/80',
            )}
          />
        )}
        <PriorityDot priority={t.priority} onCycle={cycleP} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); startEdit() }}
          className="text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
          aria-label="Edit"
          title="Edit"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDuplicate(t) }}
          className="text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
          aria-label="Duplicate"
          title="Duplicate"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          onClick={() => onDelete(t.id)}
          className="text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
          aria-label="Delete"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-line/50 px-3 py-2">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={saveNotes}
            placeholder="Notes / comments…"
            rows={2}
            className="w-full resize-none rounded-md border border-line/50 bg-surface-2/40 px-2 py-1.5 text-xs outline-none focus:border-accent"
          />
          <div className="mt-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted" />
            <input
              type="datetime-local"
              value={toDTLocal(t.dueAt)}
              onChange={(e) => onUpdate({ dueAt: e.target.value ? new Date(e.target.value) : null })}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex-1 rounded-md border border-line/50 bg-surface-2/40 px-2 py-1 text-xs outline-none focus:border-accent"
            />
            {t.dueAt && (
              <button
                onClick={() => onUpdate({ dueAt: null })}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-muted hover:text-ink"
                aria-label="Clear due date"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                onClick={() => onUpdate({ priority: p.key })}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                  t.priority === p.key ? 'border-current' : 'border-line/50 text-muted hover:border-line',
                )}
                style={t.priority === p.key ? { color: p.color, borderColor: p.color } : undefined}
              >
                <Flag className="h-2.5 w-2.5" />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function TodosWidget({ widget, variant }) {
  const { user } = useAuth()
  const activeModeId = useStore((s) => s.activeModeId)
  const todos = useTodos()
  const [text, setText] = useState('')

  const active = useMemo(() => {
    return todos
      .filter((t) => !t.done && (activeModeId === 'all' || t.modeId === activeModeId))
      .sort((a, b) => {
        // Order field takes precedence; otherwise priority bumps urgent → low.
        if (a.order != null && b.order != null) return a.order - b.order
        const ap = PRIORITY_ORDER[a.priority || 'medium']
        const bp = PRIORITY_ORDER[b.priority || 'medium']
        return ap - bp
      })
  }, [todos, activeModeId])

  const done = useMemo(() => {
    return todos.filter((t) => t.done && (activeModeId === 'all' || t.modeId === activeModeId))
  }, [todos, activeModeId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  )

  const submit = async () => {
    const value = text.trim()
    if (!value) return
    setText('')
    try {
      playPop()
      await addTodo(user.uid, { text: value, modeId: activeModeId })
    } catch (err) {
      console.error('[todo] add failed', err)
    }
  }

  const onToggle = (t) => {
    if (!t.done) playSuccess()
    updateTodo(user.uid, t.id, { done: !t.done })
  }
  const onDelete = (id) => deleteTodo(user.uid, id)
  const onUpdate = (id, patch) => updateTodo(user.uid, id, patch)
  const onDuplicate = async (t) => {
    try {
      playPop()
      await addTodo(user.uid, {
        text: t.text,
        modeId: t.modeId || activeModeId,
        priority: t.priority,
        notes: t.notes,
        dueAt: t.dueAt,
        subjectId: t.subjectId,
      })
    } catch (err) {
      console.error('[todo] duplicate failed', err)
    }
  }

  const onDragEnd = ({ active: a, over }) => {
    if (!over || a.id === over.id) return
    const oldIndex = active.findIndex((t) => t.id === a.id)
    const newIndex = active.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(active, oldIndex, newIndex)
    reorderTodos(user.uid, reordered.map((t) => t.id))
  }

  return (
    <WidgetFrame widget={widget} variant={variant} subtitle={`${active.length} open`}>
      <div className="flex min-h-0 flex-1 flex-col">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="mb-2 flex items-center gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a to-do…"
            className="flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white"
            aria-label="Add"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>

        {todos.length > 0 && <PriorityLegend className="mb-2 px-1" />}

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {todos.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted">
              <Flag className="h-6 w-6" />
              <span className="text-xs">Nothing yet — capture a quick task.</span>
            </div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={active.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {active.map((t, idx) => (
                <Row
                  key={t.id}
                  t={t}
                  index={idx}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onUpdate={(patch) => onUpdate(t.id, patch)}
                  onDuplicate={onDuplicate}
                />
              ))}
            </SortableContext>
          </DndContext>
          {done.length > 0 && (
            <>
              <span className="mt-2 px-1 text-[11px] font-medium text-muted">
                Done ({done.length})
              </span>
              {done.slice(0, variant === 'hero' ? 50 : 3).map((t) => (
                <div
                  key={t.id}
                  className="group flex items-center gap-2.5 rounded-xl border border-line/50 bg-surface-2/30 px-3 py-2"
                >
                  <button
                    onClick={() => onToggle(t)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-transparent bg-accent text-white"
                    aria-label="Mark not done"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted line-through">
                    {t.text}
                  </span>
                  <button
                    onClick={() => onDelete(t.id)}
                    className="text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </WidgetFrame>
  )
}
