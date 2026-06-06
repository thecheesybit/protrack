import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core'
import { Plus, X, GripVertical } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/hooks/useSubjects'
import { addTask, updateTask, deleteTask } from '@/services/subjectService'
import { cn } from '@/utils/cn'

const COLUMNS = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
]

// Prefer the droppable under the pointer; fall back to rect intersection so a
// drop always resolves to a column even near edges.
function collisionDetection(args) {
  const within = pointerWithin(args)
  return within.length ? within : rectIntersection(args)
}

function Card({ task, onDelete }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { column: task.column },
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'group/card relative flex touch-none cursor-grab items-start gap-1.5 rounded-lg border border-line/60 bg-surface px-2 py-2 pr-6 text-sm shadow-sm transition-shadow active:cursor-grabbing',
        // Keep the source in place (its slot stays) but faded while a clone drags.
        isDragging && 'opacity-30',
        task.column === 'done' && 'text-muted line-through',
      )}
    >
      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted/50" />
      <span className="min-w-0 flex-1 break-words">{task.title}</span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(task.id)}
        className="absolute right-1 top-1.5 opacity-0 transition-opacity group-hover/card:opacity-100"
        aria-label="Delete card"
      >
        <X className="h-3 w-3 text-muted" />
      </button>
    </div>
  )
}

function Column({ col, tasks, onAdd, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')

  const submit = () => {
    if (text.trim()) onAdd(text.trim(), col.id)
    setText('')
    setAdding(false)
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-0 flex-1 flex-col rounded-xl border bg-surface-2/30 p-2 transition-colors',
        isOver ? 'border-accent/60 bg-accent/5' : 'border-line/50',
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-medium text-muted">{col.label}</span>
        <span className="rounded-full bg-surface px-1.5 text-[10px] text-muted">
          {tasks.length}
        </span>
      </div>

      {/* Drop area — min height so empty columns still accept drops. */}
      <div className="flex min-h-[64px] flex-1 flex-col gap-1.5 overflow-y-auto">
        {tasks.map((t) => (
          <Card key={t.id} task={t} onDelete={onDelete} />
        ))}
      </div>

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

export function MicroKanban({ modeId, subjectId }) {
  const { user } = useAuth()
  const tasks = useTasks(modeId, subjectId)
  const [activeId, setActiveId] = useState(null)

  // Small activation distance so a click still selects, but a drag starts fast.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  )

  const add = (title, column) => addTask(user.uid, modeId, subjectId, { title, column })
  const del = (taskId) => deleteTask(user.uid, modeId, subjectId, taskId)

  const onDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over) return
    const task = tasks.find((t) => t.id === active.id)
    // Droppables are columns; resolve the target column id.
    const targetCol = COLUMNS.some((c) => c.id === over.id)
      ? over.id
      : over.data?.current?.column
    if (task && targetCol && task.column !== targetCol) {
      updateTask(user.uid, modeId, subjectId, task.id, {
        column: targetCol,
        order: Date.now(),
      })
    }
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
      <div className="flex h-full gap-2">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            col={col}
            tasks={tasks.filter((t) => t.column === col.id)}
            onAdd={add}
            onDelete={del}
          />
        ))}
      </div>

      {/* Portal to <body> so the floating card escapes the widget's
          transformed/overflow-hidden ancestor (the cause of the jank). */}
      {createPortal(
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2,0,0,1)' }}>
          {activeTask ? (
            <div className="flex cursor-grabbing items-start gap-1.5 rounded-lg border border-accent/50 bg-surface px-2 py-2 text-sm shadow-glass-lg">
              <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted/50" />
              <span>{activeTask.title}</span>
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
