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
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, X, GripVertical, Flag, StickyNote, ChevronDown, Calendar, Pencil, Copy, ListTodo, LayoutGrid, ListTree } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { useTasks, useTopics } from '@/hooks/useSubjects'
import { useTodos } from '@/hooks/useWellness'
import {
  addTask,
  updateTask,
  deleteTask,
  setSubjectProgress,
  reorderTasks,
  completeTopicCards,
} from '@/services/subjectService'
import { addTopic, updateTopic, deleteTopic } from '@/services/topicService'
import { updateTodo, deleteTodo, reorderTodos } from '@/services/todoService'
import { mergeSubjectCards } from '@/lib/kanbanMerge'
import { addLedgerEntry } from '@/services/ledgerService'
import { getPriority, nextPriority, PRIORITIES } from '@/lib/priority'
import { classifyDeadline } from '@/lib/deadlines'
import { PriorityLegend } from '@/components/common/PriorityLegend'
import { TopicBoard } from './TopicBoard'
import { playPop, playSuccess } from '@/lib/audioFX'
import { cn } from '@/utils/cn'

const VIEW_KEY = 'protrack:subject_board_view'

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

function TaskCard({ task, index, onDelete, onUpdate, onDuplicate, dragging }) {
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
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const cycleP = () => onUpdate({ priority: nextPriority(task.priority || 'medium') })

  const saveNotes = () => {
    if (notesDraft !== (task.notes || '')) onUpdate({ notes: notesDraft })
  }
  const startEdit = () => { setTitleDraft(task.title); setEditing(true) }
  const saveEdit = () => {
    const v = titleDraft.trim()
    if (v && v !== task.title) onUpdate({ title: v })
    setEditing(false)
  }
  const cancelEdit = () => setEditing(false)

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
      <div className="flex items-start gap-1.5 px-2 py-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none text-muted/50 hover:text-muted active:cursor-grabbing"
          aria-label="Drag"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1 flex items-start gap-1.5">
          <span className="text-muted/50 font-mono text-[10px] mt-0.5 select-none shrink-0">{index + 1}.</span>
          {task._kind === 'todo' && (
            <ListTodo
              className="mt-0.5 h-3 w-3 shrink-0 text-sky-400"
              aria-label="From your general to-dos"
              title="From your general to-dos"
            />
          )}
          {editing ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
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
              className={cn(
                'flex-1 min-w-0 break-words cursor-default',
                task.column === 'done' && 'text-muted line-through',
              )}
            >
              {task.title}
            </span>
          )}
        </div>
        {task.notes && !expanded && (
          <StickyNote
            className="mt-0.5 h-3 w-3 shrink-0 text-amber-400/80"
            aria-label="Has notes"
          />
        )}
        {task.dueAt && !expanded && (
          <Calendar
            title={formatDueShort(task.dueAt)}
            className={cn(
              'mt-0.5 h-3 w-3 shrink-0',
              classifyDeadline(task.dueAt) === 'overdue' ? 'text-rose-400' : 'text-amber-400/80',
            )}
          />
        )}
        <PriorityDot priority={task.priority} onCycle={cycleP} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); startEdit() }}
          className="mt-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 text-muted hover:text-ink"
          aria-label="Edit card"
          title="Edit"
        >
          <Pencil className="h-3 w-3" />
        </button>
        {onDuplicate && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDuplicate(task) }}
            className="mt-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 text-muted hover:text-ink"
            aria-label="Duplicate card"
            title="Duplicate"
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(task.id)}
          className="mt-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 text-muted hover:text-ink"
          aria-label="Delete card"
        >
          <X className="h-3 w-3" />
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
          <div className="mt-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted" />
            <input
              type="datetime-local"
              value={toDTLocal(task.dueAt)}
              onChange={(e) => onUpdate({ dueAt: e.target.value ? new Date(e.target.value) : null })}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex-1 rounded-md border border-line/50 bg-surface-2/40 px-2 py-1 text-xs outline-none focus:border-accent"
            />
            {task.dueAt && (
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

function Column({ col, tasks, onAdd, onDelete, onUpdate, onDuplicate }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const submit = () => {
    if (text.trim()) {
      playPop()
      onAdd(text.trim(), col.id)
    }
    setText('')
    setAdding(false)
  }

  const ids = useMemo(() => tasks.map((t) => t.id), [tasks])

  return (
    <div
      data-column-id={col.id}
      className={cn(
        'flex min-h-0 flex-1 flex-col rounded-xl border border-line/50 bg-surface-2/30 p-2 transition-all duration-200',
        isOver && 'ring-2 ring-accent/40 shadow-glow bg-surface-2/50',
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
          <div
            ref={setNodeRef}
            className="flex min-h-[64px] flex-1 flex-col gap-1.5 overflow-y-auto"
          >
            {tasks.map((t, idx) => (
              <TaskCard
                key={t.id}
                task={t}
                index={idx}
                onDelete={onDelete}
                onUpdate={(patch) => onUpdate(t.id, patch)}
                onDuplicate={t._kind === 'todo' ? undefined : onDuplicate}
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

export function MicroKanban({ modeId, subjectId, subjectName, color }) {
  const { user } = useAuth()
  const tasks = useTasks(modeId, subjectId)
  const topics = useTopics(modeId, subjectId)
  const todos = useTodos()
  const [activeId, setActiveId] = useState(null)

  // 'flat' (3-column Kanban) or 'topics' (lessons grouped under topic headers).
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'topics' ? 'topics' : 'flat'
    } catch {
      return 'flat'
    }
  })
  const setBoardView = (next) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* private mode */
    }
  }

  // Unified board: this subject's own Kanban tasks + any general todo linked
  // to it (todo.subjectId === subjectId) — see lib/kanbanMerge.js.
  const cards = useMemo(() => mergeSubjectCards(tasks, todos, subjectId), [tasks, todos, subjectId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  )

  const add = (title, column) =>
    addTask(user.uid, modeId, subjectId, { title, column, priority: 'medium' })
  const dup = (task) =>
    addTask(user.uid, modeId, subjectId, {
      title: task.title,
      column: task.column,
      priority: task.priority || 'medium',
      notes: task.notes || '',
      dueAt: task.dueAt || null,
    })
  const del = (cardId) => {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    if (card._kind === 'todo') deleteTodo(user.uid, cardId)
    else deleteTask(user.uid, modeId, subjectId, cardId)

    const remaining = cards.filter((c) => c.id !== cardId)
    const total = remaining.length
    const done = remaining.filter((c) => c.column === 'done').length
    const pct = total ? Math.round((done / total) * 100) : 0
    setSubjectProgress(user.uid, modeId, subjectId, pct)
  }
  const upd = (cardId, patch) => {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    if (card._kind === 'todo') {
      // Cards are normalized to `.title`; a merged todo stores it as `.text`.
      const { title, ...rest } = patch
      return updateTodo(user.uid, cardId, title !== undefined ? { ...rest, text: title } : rest)
    }
    return updateTask(user.uid, modeId, subjectId, cardId, patch)
  }

  /**
   * Move one card to a target Kanban column, keeping subject progress, the
   * Island pulse and the ledger in sync. Shared by drag-drop (flat view) and
   * the grouped view's done checkbox so both behave identically.
   */
  const moveCardToColumn = (card, targetCol) => {
    if (!card || card.column === targetCol) return
    if (targetCol === 'done') playSuccess()

    if (card._kind === 'todo') {
      updateTodo(user.uid, card.id, { subjectColumn: targetCol, done: targetCol === 'done' })
    } else {
      updateTask(user.uid, modeId, subjectId, card.id, { column: targetCol, order: Date.now() })
    }

    const crossesDone = targetCol === 'done' || card.column === 'done'
    if (!crossesDone) return

    const total = cards.length
    const doneAfter =
      cards.filter((c) => c.id !== card.id && c.column === 'done').length +
      (targetCol === 'done' ? 1 : 0)
    const pct = total ? Math.round((doneAfter / total) * 100) : 0
    setSubjectProgress(user.uid, modeId, subjectId, pct)

    if (targetCol === 'done') {
      const label = subjectName ? `${subjectName} · ${pct}% complete` : `${pct}% of board complete`
      useStore.getState().pushIsland({
        kind: 'progress',
        title: 'Task completed',
        detail: label,
        progress: pct,
        duration: 4200,
      })
      addLedgerEntry(user.uid, {
        kind: 'task',
        title: card.title,
        detail: subjectName ? `Completed in ${subjectName}` : 'Task completed',
        modeId,
      })
    }
  }

  // ── Topic (grouped view) handlers — operate on native subject tasks ───────
  const toggleTaskDone = (taskId) => {
    const card = cards.find((c) => c.id === taskId)
    if (!card) return
    moveCardToColumn(card, card.column === 'done' ? 'todo' : 'done')
  }
  // Route topic assignment by card kind: native tasks store `topicId`, merged
  // general to-dos store `subjectTopicId` (surfaced as topicId by kanbanMerge).
  const assignTaskTopic = (cardId, topicId) => {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    if (card._kind === 'todo') {
      return updateTodo(user.uid, cardId, { subjectTopicId: topicId || null })
    }
    return updateTask(user.uid, modeId, subjectId, cardId, { topicId: topicId || null })
  }
  const addTaskToTopic = (title, topicId) =>
    addTask(user.uid, modeId, subjectId, {
      title,
      column: 'todo',
      priority: 'medium',
      topicId: topicId || null,
    })
  const completeTopic = async (topic, groupCards) => {
    const notDone = (groupCards || []).filter((c) => c.column !== 'done')
    if (!notDone.length) return
    const taskIds = notDone.filter((c) => c._kind !== 'todo').map((c) => c.id)
    const todoIds = notDone.filter((c) => c._kind === 'todo').map((c) => c.id)
    await completeTopicCards(user.uid, modeId, subjectId, { taskIds, todoIds })
    useStore.getState().pushIsland({
      kind: 'progress',
      title: 'Topic completed',
      detail: subjectName ? `${topic.title} · ${subjectName}` : topic.title,
      duration: 4200,
    })
    addLedgerEntry(user.uid, {
      kind: 'task',
      title: `Completed topic: ${topic.title}`,
      detail: subjectName ? `All items done in ${subjectName}` : 'All items done',
      modeId,
    }).catch(() => {})
  }
  const createTopic = (title) => addTopic(user.uid, modeId, subjectId, { title })
  const renameTopic = (topicId, title) => updateTopic(user.uid, modeId, subjectId, topicId, { title })
  const recolorTopic = (topicId, color) => updateTopic(user.uid, modeId, subjectId, topicId, { color })
  const removeTopic = (topicId) => deleteTopic(user.uid, modeId, subjectId, topicId)
  // Reorder within a topic — tasks and todos live in separate collections with
  // independent `order` sequences, so each kind's subset is re-numbered.
  const reorderTaskIds = (ids) => ids?.length && reorderTasks(user.uid, modeId, subjectId, ids)
  const reorderTodoIds = (ids) => ids?.length && reorderTodos(user.uid, ids)

  /** Find which column a draggable id belongs to (card id OR column id). */
  const findColumnFor = (id) => {
    if (COLUMNS.some((c) => c.id === id)) return id
    const c = cards.find((x) => x.id === id)
    return c?.column
  }

  const onDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over) return

    const task = cards.find((c) => c.id === active.id)
    if (!task) return

    const targetCol = findColumnFor(over.id)
    if (!targetCol) return

    // Case 1: dropping on a different column → move + recompute progress.
    if (task.column !== targetCol) {
      moveCardToColumn(task, targetCol)
      return
    }

    // Case 2: same-column reorder. Tasks and todos live in separate
    // collections with independent `order` sequences, so each kind's batch
    // reorder is re-applied to just its own subset in the new relative
    // order — exact between-kind interleaving isn't guaranteed, but moving
    // a card between columns (the main point of merging them in) always is.
    if (active.id === over.id) return
    const colCards = cards.filter((c) => c.column === targetCol)
    const oldIndex = colCards.findIndex((c) => c.id === active.id)
    const newIndex = colCards.findIndex((c) => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(colCards, oldIndex, newIndex)
    const reorderedTaskIds = reordered.filter((c) => c._kind === 'task').map((c) => c.id)
    const reorderedTodoIds = reordered.filter((c) => c._kind === 'todo').map((c) => c.id)
    if (reorderedTaskIds.length) reorderTasks(user.uid, modeId, subjectId, reorderedTaskIds)
    if (reorderedTodoIds.length) reorderTodos(user.uid, reorderedTodoIds)
  }

  const activeTask = cards.find((c) => c.id === activeId)

  const toolbar = (
    <div className="flex items-center justify-between gap-2 px-1">
      <PriorityLegend />
      <div
        className="flex shrink-0 items-center gap-0.5 rounded-lg border border-line/60 bg-surface-2/40 p-0.5"
        role="group"
        aria-label="Board view"
      >
        <button
          type="button"
          onClick={() => setBoardView('flat')}
          title="Board view (To do · Doing · Done)"
          aria-pressed={view === 'flat'}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
            view === 'flat' ? 'bg-accent/20 text-accent' : 'text-muted hover:text-ink',
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setBoardView('topics')}
          title="Topics view (group lessons under topics)"
          aria-pressed={view === 'topics'}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
            view === 'topics' ? 'bg-accent/20 text-accent' : 'text-muted hover:text-ink',
          )}
        >
          <ListTree className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )

  if (view === 'topics') {
    return (
      <div className="flex h-full flex-col gap-2">
        {toolbar}
        <TopicBoard
          tasks={cards}
          topics={topics}
          color={color}
          onToggleTask={toggleTaskDone}
          onDeleteTask={del}
          onUpdateTask={upd}
          onAddTask={addTaskToTopic}
          onAssignTopic={assignTaskTopic}
          onCompleteTopic={completeTopic}
          onAddTopic={createTopic}
          onRenameTopic={renameTopic}
          onRecolorTopic={recolorTopic}
          onDeleteTopic={removeTopic}
          onReorderTasks={reorderTaskIds}
          onReorderTodos={reorderTodoIds}
        />
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full flex-col gap-2">
        {toolbar}
        <div className="flex min-h-0 flex-1 gap-2">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              col={col}
              tasks={cards.filter((c) => c.column === col.id)}
              onAdd={add}
              onDelete={del}
              onUpdate={upd}
              onDuplicate={dup}
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
