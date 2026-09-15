import { useMemo, useState } from 'react'
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
import {
  Plus,
  X,
  Check,
  ChevronDown,
  Pencil,
  Trash2,
  FolderPlus,
  CheckCheck,
  GripVertical,
  Palette,
} from 'lucide-react'
import { groupTasksByTopic, topicStats, isTopicComplete } from '@/lib/topics'
import { getPriority, nextPriority } from '@/lib/priority'
import { MODE_PALETTE } from '@/lib/constants'
import { cn } from '@/utils/cn'

/**
 * Grouped, collapsible topic view of a subject's board — the alternative to the
 * flat 3-column Kanban. Items (native Kanban tasks AND general to-dos merged
 * into the subject) are bundled under topics ("Lessons 1–5 → Kinematics").
 *
 * Interactions:
 *  - Drag a lesson by its grip → drop on another topic to move it there, or drop
 *    within the same topic to reorder. Works with the "Ungrouped" bucket too.
 *  - "Complete topic" marks every item in a topic done; progress updates.
 *  - Recolor / rename / delete a topic from its header; add or reassign items.
 *
 * Presentational only: every mutation is delegated to MicroKanban via callbacks
 * so progress/ledger/island stay in one place.
 */

const UNGROUPED = '__ungrouped__'
const dropId = (topicId) => `topic:${topicId}`
const parseDropId = (id) =>
  typeof id === 'string' && id.startsWith('topic:') ? id.slice('topic:'.length) : null

/** pointer-first collision with graceful fallbacks (mirrors MicroKanban). */
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
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onCycle}
      title={`Priority: ${p.label} — click to cycle`}
      className={cn('h-2.5 w-2.5 shrink-0 rounded-full ring-2', p.dot, p.ring)}
      aria-label={`Priority ${p.label}`}
    />
  )
}

function TaskRow({ task, index, topics, onToggle, onDelete, onUpdate, onAssign, dragging }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { topicId: task.topicId || null },
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const done = task.column === 'done'

  const style = { transform: CSS.Translate.toString(transform), transition }

  const save = () => {
    const v = draft.trim()
    if (v && v !== task.title) onUpdate({ title: v })
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/row flex items-center gap-1.5 rounded-lg border bg-surface px-2 py-1.5 text-sm transition-shadow',
        isDragging || dragging ? 'border-accent/50 opacity-40' : 'border-line/50',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted/40 hover:text-muted active:cursor-grabbing"
        aria-label="Drag lesson"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onToggle}
        title={done ? 'Mark not done' : 'Mark done'}
        aria-label={done ? 'Mark not done' : 'Mark done'}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors',
          done ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-line hover:border-accent',
        )}
      >
        {done && <Check className="h-3 w-3" />}
      </button>

      <span className="w-5 shrink-0 select-none text-right font-mono text-[10px] text-muted/50">
        {index + 1}.
      </span>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="min-w-0 flex-1 rounded border border-accent/60 bg-surface-2/60 px-1.5 py-0.5 text-sm outline-none"
        />
      ) : (
        <span
          onDoubleClick={() => {
            setDraft(task.title)
            setEditing(true)
          }}
          className={cn('min-w-0 flex-1 truncate', done && 'text-muted line-through')}
          title={task.title}
        >
          {task.title}
        </span>
      )}

      <PriorityDot priority={task.priority} onCycle={() => onUpdate({ priority: nextPriority(task.priority || 'medium') })} />

      {/* Reassign via menu (keyboard-friendly fallback to drag) */}
      <select
        value={task.topicId || ''}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => onAssign(e.target.value || null)}
        title="Move to topic"
        className="max-w-[7.5rem] shrink-0 rounded-md border border-line/60 bg-surface-2/50 px-1 py-0.5 text-[10px] text-muted opacity-0 outline-none transition-opacity focus:border-accent focus:opacity-100 group-hover/row:opacity-100"
      >
        <option value="">Ungrouped</option>
        {topics.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete()}
        aria-label="Delete lesson"
        className="shrink-0 text-muted opacity-0 transition-opacity hover:text-rose-400 group-hover/row:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function AddLessonRow({ topicId, onAdd }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const submit = () => {
    const v = text.trim()
    if (v) onAdd(v, topicId)
    setText('')
    setOpen(false)
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
      >
        <Plus className="h-3 w-3" /> Add lesson
      </button>
    )
  }
  return (
    <input
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit()
        if (e.key === 'Escape') setOpen(false)
      }}
      placeholder="Lesson title…"
      className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
    />
  )
}

/** A droppable list body shared by topic sections and the ungrouped bucket. */
function DroppableBody({ id, cards, children, className }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(id) })
  const ids = useMemo(() => cards.map((c) => c.id), [cards])
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[36px] flex-col gap-1.5 rounded-xl transition-colors',
          isOver && 'bg-accent/5 ring-1 ring-inset ring-accent/30',
          className,
        )}
      >
        {children}
      </div>
    </SortableContext>
  )
}

function TopicSection({
  topic,
  tasks,
  topics,
  collapsed,
  onToggleCollapse,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onAssign,
  onAddTask,
  onComplete,
  onRename,
  onRecolor,
  onDelete,
  color,
}) {
  const [renaming, setRenaming] = useState(false)
  const [titleDraft, setTitleDraft] = useState(topic.title)
  const [picking, setPicking] = useState(false)
  const stats = topicStats(tasks)
  const complete = isTopicComplete(tasks)
  const dotColor = topic.color || color

  const saveRename = () => {
    const v = titleDraft.trim()
    if (v && v !== topic.title) onRename(v)
    setRenaming(false)
  }

  return (
    <div className="rounded-xl border border-line/50 bg-surface-2/30">
      {/* Header */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          title="Recolor topic"
          aria-label="Recolor topic"
          className="relative shrink-0"
        >
          <span className="block h-2.5 w-2.5 rounded-full ring-2 ring-transparent transition-all hover:ring-white/20" style={{ background: dotColor }} />
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted transition-transform', collapsed && '-rotate-90')} />
          {renaming ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename()
                if (e.key === 'Escape') setRenaming(false)
              }}
              className="min-w-0 flex-1 rounded border border-accent/60 bg-surface px-1.5 py-0.5 text-sm font-semibold outline-none"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={topic.title}>
              {topic.title}
            </span>
          )}
        </button>

        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px]',
            complete ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface text-muted',
          )}
          title={`${stats.done} of ${stats.total} done`}
        >
          {stats.done}/{stats.total}
        </span>

        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          title="Recolor topic"
          aria-label="Recolor topic"
          className="shrink-0 text-muted transition-colors hover:text-ink"
        >
          <Palette className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setTitleDraft(topic.title)
            setRenaming(true)
          }}
          title="Rename topic"
          aria-label="Rename topic"
          className="shrink-0 text-muted transition-colors hover:text-ink"
        >
          <Pencil className="h-3 w-3" />
        </button>

        <button
          type="button"
          onClick={onComplete}
          disabled={stats.total === 0 || complete}
          title="Complete topic — mark every lesson done"
          aria-label="Complete topic"
          className="shrink-0 text-muted transition-colors hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-muted"
        >
          <CheckCheck className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={onDelete}
          title="Delete topic (lessons become ungrouped)"
          aria-label="Delete topic"
          className="shrink-0 text-muted transition-colors hover:text-rose-400"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Color palette popover */}
      {picking && (
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2">
          {MODE_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onRecolor(c)
                setPicking(false)
              }}
              className={cn(
                'h-5 w-5 rounded-full transition-transform hover:scale-110',
                dotColor === c && 'ring-2 ring-offset-2 ring-offset-surface',
              )}
              style={{ background: c, '--tw-ring-color': c }}
              aria-label={`Set colour ${c}`}
            />
          ))}
        </div>
      )}

      {/* Progress hairline */}
      {stats.total > 0 && (
        <div className="mx-2.5 h-1 overflow-hidden rounded-full bg-line/40">
          <div className="h-full rounded-full transition-all" style={{ width: `${stats.pct}%`, background: dotColor }} />
        </div>
      )}

      {/* Body (droppable) */}
      {!collapsed && (
        <div className="p-2.5 pt-2">
          <DroppableBody id={topic.id} cards={tasks}>
            {tasks.map((t, i) => (
              <TaskRow
                key={t.id}
                task={t}
                index={i}
                topics={topics}
                onToggle={() => onToggleTask(t.id)}
                onDelete={() => onDeleteTask(t.id)}
                onUpdate={(patch) => onUpdateTask(t.id, patch)}
                onAssign={(topicId) => onAssign(t.id, topicId)}
              />
            ))}
            {tasks.length === 0 && (
              <span className="px-1 py-1 text-[11px] text-muted">Drop lessons here, or add one below.</span>
            )}
          </DroppableBody>
          <AddLessonRow topicId={topic.id} onAdd={onAddTask} />
        </div>
      )}
    </div>
  )
}

export function TopicBoard({
  tasks,
  topics,
  color,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onAddTask,
  onAssignTopic,
  onCompleteTopic,
  onAddTopic,
  onRenameTopic,
  onRecolorTopic,
  onDeleteTopic,
  onReorderTasks,
  onReorderTodos,
}) {
  const { groups, ungrouped } = useMemo(() => groupTasksByTopic(tasks, topics), [tasks, topics])
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [addingTopic, setAddingTopic] = useState(false)
  const [topicText, setTopicText] = useState('')
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  )

  const toggleCollapse = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submitTopic = () => {
    const v = topicText.trim()
    if (v) onAddTopic(v)
    setTopicText('')
    setAddingTopic(false)
  }

  /** Ordered cards of the group a topicId (or null → ungrouped) owns. */
  const groupCardsFor = (topicId) =>
    topicId ? groups.find((g) => g.topic.id === topicId)?.tasks || [] : ungrouped

  const onDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over) return
    const card = tasks.find((c) => c.id === active.id)
    if (!card) return

    // Resolve the target topic: dropping on a topic body (or empty topic) vs. on
    // another card (inherit that card's topic).
    let targetTopicId
    const overTopicRaw = parseDropId(over.id)
    if (overTopicRaw !== null) {
      targetTopicId = overTopicRaw === UNGROUPED ? null : overTopicRaw
    } else {
      const overCard = tasks.find((c) => c.id === over.id)
      if (!overCard) return
      targetTopicId = overCard.topicId || null
    }

    const currentTopicId = card.topicId || null

    // Case 1: moved to a different topic → reassign.
    if ((targetTopicId || null) !== currentTopicId) {
      onAssignTopic(card.id, targetTopicId)
      return
    }

    // Case 2: same topic → reorder within it.
    if (active.id === over.id) return
    const groupCards = groupCardsFor(currentTopicId)
    const oldIndex = groupCards.findIndex((c) => c.id === active.id)
    const newIndex = groupCards.findIndex((c) => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(groupCards, oldIndex, newIndex)
    const taskIds = reordered.filter((c) => c._kind !== 'todo').map((c) => c.id)
    const todoIds = reordered.filter((c) => c._kind === 'todo').map((c) => c.id)
    if (taskIds.length) onReorderTasks(taskIds)
    if (todoIds.length) onReorderTodos(todoIds)
  }

  const activeCard = tasks.find((c) => c.id === activeId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
        {groups.map((g) => (
          <TopicSection
            key={g.topic.id}
            topic={g.topic}
            tasks={g.tasks}
            topics={topics}
            color={color}
            collapsed={collapsed.has(g.topic.id)}
            onToggleCollapse={() => toggleCollapse(g.topic.id)}
            onToggleTask={onToggleTask}
            onDeleteTask={onDeleteTask}
            onUpdateTask={onUpdateTask}
            onAssign={onAssignTopic}
            onAddTask={onAddTask}
            onComplete={() => onCompleteTopic(g.topic, g.tasks)}
            onRename={(title) => onRenameTopic(g.topic.id, title)}
            onRecolor={(c) => onRecolorTopic(g.topic.id, c)}
            onDelete={() => onDeleteTopic(g.topic.id, g.topic.title)}
          />
        ))}

        {/* Ungrouped bucket — a drop target so you can drag items out of topics. */}
        {(ungrouped.length > 0 || groups.length > 0) && (
          <div className="rounded-xl border border-dashed border-line/50 bg-surface-2/20 p-2.5">
            <div className="mb-2 flex items-center gap-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <span>Ungrouped</span>
              <span className="rounded-full bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
                {ungrouped.length}
              </span>
            </div>
            <DroppableBody id={UNGROUPED} cards={ungrouped}>
              {ungrouped.map((t, i) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  index={i}
                  topics={topics}
                  onToggle={() => onToggleTask(t.id)}
                  onDelete={() => onDeleteTask(t.id)}
                  onUpdate={(patch) => onUpdateTask(t.id, patch)}
                  onAssign={(topicId) => onAssignTopic(t.id, topicId)}
                />
              ))}
              {ungrouped.length === 0 && (
                <span className="px-1 py-1 text-[11px] text-muted">Drag an item here to remove it from its topic.</span>
              )}
            </DroppableBody>
          </div>
        )}

        {/* New topic */}
        {addingTopic ? (
          <input
            autoFocus
            value={topicText}
            onChange={(e) => setTopicText(e.target.value)}
            onBlur={submitTopic}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitTopic()
              if (e.key === 'Escape') setAddingTopic(false)
            }}
            placeholder="Topic name (e.g. Kinematics)…"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingTopic(true)}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line/70 bg-surface-2/20 py-2 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:text-accent"
          >
            <FolderPlus className="h-3.5 w-3.5" /> New topic
          </button>
        )}

        {groups.length === 0 && ungrouped.length === 0 && !addingTopic && (
          <span className="px-1 py-2 text-center text-[11px] text-muted">
            Group your lessons into topics — create one above, then add lessons or drag existing ones in.
          </span>
        )}
      </div>

      {createPortal(
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2,0,0,1)' }}>
          {activeCard ? (
            <div className="flex cursor-grabbing items-center gap-1.5 rounded-lg border border-accent/50 bg-surface px-2 py-1.5 text-sm shadow-glass-lg">
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted/50" />
              <PriorityDot priority={activeCard.priority} />
              <span className="truncate">{activeCard.title}</span>
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
