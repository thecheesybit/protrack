import { useState } from 'react'
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { Plus, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/hooks/useSubjects'
import { addTask, updateTask, deleteTask } from '@/services/subjectService'
import { cn } from '@/utils/cn'

const COLUMNS = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
]

function Card({ task, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={cn(
        'group/card relative cursor-grab rounded-lg border border-line/60 bg-surface px-2.5 py-2 pr-6 text-sm shadow-sm active:cursor-grabbing',
        isDragging && 'opacity-40',
        task.column === 'done' && 'text-muted line-through',
      )}
    >
      {task.title}
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
        'flex min-h-0 flex-1 flex-col rounded-xl border border-line/50 bg-surface-2/30 p-2',
        isOver && 'ring-2 ring-accent/40',
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-medium text-muted">{col.label}</span>
        <span className="text-[10px] text-muted">{tasks.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const add = (title, column) => addTask(user.uid, modeId, subjectId, { title, column })
  const del = (taskId) => deleteTask(user.uid, modeId, subjectId, taskId)

  const onDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over) return
    const task = tasks.find((t) => t.id === active.id)
    const overCol = COLUMNS.some((c) => c.id === over.id)
      ? over.id
      : tasks.find((t) => t.id === over.id)?.column
    if (task && overCol && task.column !== overCol) {
      updateTask(user.uid, modeId, subjectId, task.id, {
        column: overCol,
        order: Date.now(),
      })
    }
  }

  const activeTask = tasks.find((t) => t.id === activeId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
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
      <DragOverlay>
        {activeTask ? (
          <div className="rounded-lg border border-accent/40 bg-surface px-2.5 py-2 text-sm shadow-lg">
            {activeTask.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
