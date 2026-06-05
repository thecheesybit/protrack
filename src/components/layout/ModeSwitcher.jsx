import { useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Settings2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { getIcon } from '@/lib/icons'
import { reorderModes } from '@/services/modeService'
import { updateActiveMode } from '@/services/userService'
import { ModeEditorModal } from '@/components/modes/ModeEditorModal'
import { cn } from '@/utils/cn'

function SortableModePill({ mode, active, onSelect, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: mode.id })
  const Icon = getIcon(mode.icon)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative shrink-0', isDragging && 'z-10 opacity-80')}
      {...attributes}
      {...listeners}
    >
      <button
        onClick={onSelect}
        className={cn(
          'group flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
          active
            ? 'bg-surface-2 text-ink shadow-sm'
            : 'text-muted hover:bg-surface-2/50 hover:text-ink',
        )}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: mode.accentColor || '#6366f1' }}
        />
        <Icon className="h-4 w-4" />
        <span className="whitespace-nowrap">{mode.name}</span>
        {active && (
          <span
            role="button"
            tabIndex={0}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="-mr-1 ml-0.5 flex h-5 w-5 items-center justify-center rounded-md text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
            aria-label="Edit mode"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
    </div>
  )
}

export function ModeSwitcher() {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const setActiveModeId = useStore((s) => s.setActiveModeId)
  const restoreWidgets = useStore((s) => s.restoreWidgets)

  const [items, setItems] = useState(modes)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingMode, setEditingMode] = useState(null)

  useEffect(() => setItems(modes), [modes])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const selectMode = async (id) => {
    if (id === activeModeId) return
    setActiveModeId(id) // optimistic
    restoreWidgets() // collapse any focused widget on context switch
    try {
      await updateActiveMode(user.uid, id)
    } catch (err) {
      console.error('[mode] failed to persist active mode', err)
    }
  }

  const onDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((m) => m.id === active.id)
    const newIndex = items.findIndex((m) => m.id === over.id)
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next) // optimistic
    try {
      await reorderModes(user.uid, next.map((m) => m.id))
    } catch (err) {
      console.error('[mode] reorder failed', err)
      setItems(modes) // rollback
    }
  }

  const openCreate = () => {
    setEditingMode(null)
    setEditorOpen(true)
  }
  const openEdit = (mode) => {
    setEditingMode(mode)
    setEditorOpen(true)
  }

  return (
    <>
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-line/70 bg-surface/50 p-1.5 backdrop-blur-xl">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((m) => m.id)}
            strategy={horizontalListSortingStrategy}
          >
            {items.map((mode) => (
              <SortableModePill
                key={mode.id}
                mode={mode}
                active={mode.id === activeModeId}
                onSelect={() => selectMode(mode.id)}
                onEdit={() => openEdit(mode)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button
          onClick={openCreate}
          title="New mode"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <ModeEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        mode={editingMode}
      />
    </>
  )
}
