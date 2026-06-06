import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, X, GripVertical, Flag, StickyNote, ChevronDown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { useTasks } from '@/hooks/useSubjects'
import {
  addTask,
  updateTask,
  deleteTask,
  setSubjectProgress,
  reorderTasks,
} from '@/services/subjectService'
import { addLedgerEntry } from '@/services/ledgerService'
import { getPriority, nextPriority, PRIORITIES } from '@/lib/priority'
import { PriorityLegend } from '@/components/common/PriorityLegend'
import { cn } from '@/utils/cn'

const COLUMNS = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
]

function collisionDetection(args) {
  const within = pointerWithin(args)
  if (within.length) return within
  const rect = rectIntersection(args)
  if (rect.length) return rect
  return closestCenter(args)
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

function TaskCard({ task, onDelete, onUpdate, dragging }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { column: task.column } })

  const [expanded, setExpanded] = useState(false)
  const [notesDraft, setNotesDraft] = useState(task.notes || '')

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const cycleP = () => onUpdate({ priority: nextPriority(task.priority || 'medium') })

  const saveNotes = () => {
    if (notesDraft !== (task.notes || '')) onUpdate({ notes: notesDraft })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/card relative rounded-lg border bg-surface text-sm shadow-sm transition-shadow',
        (isDragging || dragging) ? 'border-accent/50 opacity-40' : 'border-line/60',
        task.column === 'done' && !expanded && 'opacity-80',
      )}
    >
      <div className="flex items-start gap-1.5 px-2 py-2 pr-6">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none text-muted/50 hover:text-muted active:cursor-grabbing"
          aria-label="Drag"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'min-w-0 flex-1 break-words text-left',
            task.column === 'done' && 'text-muted line-through',
          )}
        >
          {task.title}
        </button>
        {task.notes && !expanded && (
          <StickyNote
            className="mt-0.5 h-3 w-3 shrink-0 text-amber-400/80"
            aria-label="Has notes"
          />
        )}
        <PriorityDot priority={task.priority} onCycle={cycleP} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(task.id)}
          className="absolute right-1 top-1.5 opacity-0 transition-opacity group-hover/card:opacity-100"
          aria-label="Delete card"
        >
          <X className="h-3 w-3 text-muted" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-line/50 px-2 py-2">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={saveNotes}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Notes / comments…"
            rows={3}
            className="w-full resize-none rounded-md border border-line/50 bg-surface-2/40 px-2 py-1.5 text-xs outline-none focus:border-accent"
          />
          <div className="mt-2 flex items-center gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                onClick={() => onUpdate({ priority: p.key })}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                  task.priority === p.key
                    ? 'border-current'
                    : 'border-line/50 text-muted hover:border-line',
                )}
                style={task.priority === p.key ? { color: p.color, borderColor: p.color } : undefined}
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

function Column({ col, tasks, onAdd, onDelete, onUpdate }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const submit = () => {
    if (text.trim()) onAdd(text.trim(), col.id)
    setText('')
    setAdding(false)
  }

  const ids = useMemo(() => tasks.map((t) => t.id), [tasks])

  return (
    <div
      data-column-id={col.id}
      className={cn(
        'flex min-h-0 flex-1 flex-col rounded-xl border border-line/50 bg-surface-2/30 p-2 transition-colors',
      )}
    >
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="mb-2 flex w-full items-center justify-between px-1 text-xs font-medium text-muted hover:text-ink"
      >
        <span className="flex items-center gap-1.5">
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', collapsed && '-rotate-90')}
          />
          {col.label}
        </span>
        <span className="rounded-full bg-surface px-1.5 text-[10px] text-muted">
          {tasks.length}
        </span>
      </button>

      {!collapsed && (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="flex min-h-[64px] flex-1 flex-col gap-1.5 overflow-y-auto">
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onDelete={onDelete}
                onUpdate={(patch) => onUpdate(t.id, patch)}
              />
            ))}
          </div>
        </SortableContext>
      )}

      {adding ? (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setAdding(false)
          }}
          placeholder="Card title…"
          className="mt-1.5 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-1.5 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      )}
    </div>
  )
}

export function MicroKanban({ modeId, subjectId, subjectName }) {
  const { user } = useAuth()
  const tasks = useTasks(modeId, subjectId)
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  )

  const add = (title, column) =>
    addTask(user.uid, modeId, subjectId, { title, column, priority: 'medium' })
  const del = (taskId) => deleteTask(user.uid, modeId, subjectId, taskId)
  const upd = (taskId, patch) => updateTask(user.uid, modeId, subjectId, taskId, patch)

  /** Find which column a draggable id belongs to (task id OR column id). */
  const findColumnFor = (id) => {
    if (COLUMNS.some((c) => c.id === id)) return id
    const t = tasks.find((x) => x.id === id)
    return t?.column
  }

  const onDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over) return

    const task = tasks.find((t) => t.id === active.id)
    if (!task) return

    const targetCol = findColumnFor(over.id)
    if (!targetCol) return

    // Case 1: dropping on a different column → move + recompute progress.
    if (task.column !== targetCol) {
      updateTask(user.uid, modeId, subjectId, task.id, {
        column: targetCol,
        order: Date.now(),
      })

      const crossesDone = targetCol === 'done' || task.column === 'done'
      if (crossesDone) {
        const total = tasks.length
        const doneAfter =
          tasks.filter((t) => t.id !== task.id && t.column === 'done').length +
          (targetCol === 'done' ? 1 : 0)
        const pct = total ? Math.round((doneAfter / total) * 100) : 0
        setSubjectProgress(user.uid, modeId, subjectId, pct)

        if (targetCol === 'done') {
          const label = subjectName
            ? `${subjectName} · ${pct}% complete`
            : `${pct}% of board complete`
          useStore.getState().pushIsland({
            kind: 'progress',
            title: 'Task completed',
            detail: label,
            progress: pct,
            duration: 4200,
          })
          addLedgerEntry(user.uid, {
            kind: 'task',
            title: task.title,
            detail: subjectName ? `Completed in ${subjectName}` : 'Task completed',
            modeId,
          })
        }
      }
      return
    }

    // Case 2: same-column reorder.
    if (active.id === over.id) return
    const colTasks = tasks.filter((t) => t.column === targetCol)
    const oldIndex = colTasks.findIndex((t) => t.id === active.id)
    const newIndex = colTasks.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(colTasks, oldIndex, newIndex)
    reorderTasks(user.uid, modeId, subjectId, reordered.map((t) => t.id))
  }

  const activeTask = tasks.find((t) => t.id === activeId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full flex-col gap-2">
        <PriorityLegend className="px-1" />
        <div className="flex min-h-0 flex-1 gap-2">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              col={col}
              tasks={tasks.filter((t) => t.column === col.id)}
              onAdd={add}
              onDelete={del}
              onUpdate={upd}
            />
          ))}
        </div>
      </div>

      {createPortal(
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2,0,0,1)' }}>
          {activeTask ? (
            <div className="flex cursor-grabbing items-start gap-1.5 rounded-lg border border-accent/50 bg-surface px-2 py-2 text-sm shadow-glass-lg">
              <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted/50" />
              <PriorityDot priority={activeTask.priority} />
              <span>{activeTask.title}</span>
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
