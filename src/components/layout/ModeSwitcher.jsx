import { useState } from 'react'
import { Plus, Settings2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { getIcon } from '@/lib/icons'
import { updateActiveMode } from '@/services/userService'
import { ModeEditorModal } from '@/components/modes/ModeEditorModal'
import { cn } from '@/utils/cn'

/**
 * Static, non-draggable mode pill. Navigation order is determined by
 * mode.order and can only be changed via Mode Editor in Settings —
 * eliminating accidental reordering during normal use.
 */
function ModePill({ mode, active, onSelect, onEdit }) {
  const Icon = getIcon(mode.icon)

  return (
    <div className="relative shrink-0">
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

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingMode, setEditingMode] = useState(null)

  // Modes are rendered in their persisted order (mode.order ascending)
  const sortedModes = [...modes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // Inject a pseudo-mode "All" at the front
  const allMode = { id: 'all', name: 'All Scopes', icon: 'Globe', accentColor: '#94a3b8' }

  const selectMode = async (id) => {
    if (id === activeModeId) return
    setActiveModeId(id) // optimistic
    restoreWidgets() // collapse any focused widget on context switch
    try {
      if (id !== 'all') {
        await updateActiveMode(user.uid, id)
      } else {
        // We can just persist 'all' as the active mode. It's safe since it's just a string pointer.
        await updateActiveMode(user.uid, id)
      }
    } catch (err) {
      console.error('[mode] failed to persist active mode', err)
    }
  }

  const openCreate = () => {
    setEditingMode(null)
    setEditorOpen(true)
  }
  const openEdit = (mode) => {
    if (mode.id === 'all') return // Cannot edit the 'All' mode
    setEditingMode(mode)
    setEditorOpen(true)
  }

  return (
    <>
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-line/70 bg-surface/50 p-1.5 backdrop-blur-xl">
        <ModePill
          key="all"
          mode={allMode}
          active={activeModeId === 'all'}
          onSelect={() => selectMode('all')}
          onEdit={() => openEdit(allMode)}
        />
        {sortedModes.map((mode) => (
          <ModePill
            key={mode.id}
            mode={mode}
            active={mode.id === activeModeId}
            onSelect={() => selectMode(mode.id)}
            onEdit={() => openEdit(mode)}
          />
        ))}

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
