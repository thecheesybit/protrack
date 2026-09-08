import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Plus, Settings2, Sun, Moon, Settings, LogOut, Heart, Minimize2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useStore } from '@/store/useStore'
import { getIcon } from '@/lib/icons'
import { updateActiveMode } from '@/services/userService'
import { ModeEditorModal } from '@/components/modes/ModeEditorModal'
import { DeleteModeModal } from '@/components/modes/DeleteModeModal'
import { ModeContextMenu } from '@/components/modes/ModeContextMenu'
import { cn } from '@/utils/cn'

/**
 * Vertical mode pill — compact icon button with a colored indicator and tooltip.
 */
function VerticalModePill({ mode, active, onSelect, onEdit, onContextMenu }) {
  const Icon = getIcon(mode.icon)
  const accentColor = mode.accentColor || 'rgb(var(--accent))'
  const isEditable = mode.id !== 'all'

  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        onContextMenu={(e) => {
          if (isEditable) {
            e.preventDefault()
            onContextMenu?.(e, mode)
          }
        }}
        onDoubleClick={(e) => {
          if (isEditable) {
            e.stopPropagation()
            onEdit()
          }
        }}
        className={cn(
          'relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200',
          active
            ? 'text-ink'
            : 'text-muted hover:scale-105 hover:bg-ink/5 hover:text-ink',
        )}
        style={active ? { backgroundColor: `${mode.accentColor || '#6366f1'}1f` } : {}}
        aria-label={mode.name}
        title={isEditable ? `${mode.name} (Right-click for options)` : mode.name}
      >
        {/* Sliding accent indicator — one per rail, glides between actives. */}
        {active && (
          <motion.span
            layoutId="rail-mode-indicator"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="absolute -left-[10px] h-7 w-1.5 rounded-r-full"
            style={{ backgroundColor: accentColor }}
          />
        )}
        <span
          className={cn(
            'absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full transition-opacity',
            active ? 'opacity-100' : 'opacity-50',
          )}
          style={{ backgroundColor: accentColor }}
        />
        <Icon className="h-6 w-6" style={active ? { color: accentColor } : {}} />
      </button>

      {/* Tooltip & Edit Action Popover — seamlessly attached with pl-2 to avoid dead zone */}
      <div className="pointer-events-none absolute left-full top-1/2 z-30 -translate-y-1/2 pl-2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-line/60 bg-surface/95 px-2.5 py-1.5 text-xs font-semibold text-ink shadow-glass backdrop-blur-md">
          <span>{mode.name}</span>
          {isEditable && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              title={`Edit or delete ${mode.name}`}
              className="ml-1 flex h-5 w-5 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink transition-colors cursor-pointer"
              aria-label={`Edit ${mode.name}`}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Horizontal mode pill (original layout, for fallback).
 */
function ModePill({ mode, active, onSelect, onEdit, onContextMenu }) {
  const Icon = getIcon(mode.icon)
  const isEditable = mode.id !== 'all'

  return (
    <div className="relative shrink-0">
      <button
        onClick={onSelect}
        onContextMenu={(e) => {
          if (isEditable) {
            e.preventDefault()
            onContextMenu?.(e, mode)
          }
        }}
        onDoubleClick={(e) => {
          if (isEditable) {
            e.stopPropagation()
            onEdit()
          }
        }}
        title={isEditable ? `${mode.name} (Right-click for options)` : mode.name}
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
        {isEditable && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="-mr-1 ml-0.5 flex h-5 w-5 items-center justify-center rounded-md text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 cursor-pointer"
            aria-label={`Edit ${mode.name}`}
            title={`Edit ${mode.name}`}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
    </div>
  )
}

export function ModeSwitcher({ vertical = false }) {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const setActiveModeId = useStore((s) => s.setActiveModeId)
  const restoreWidgets = useStore((s) => s.restoreWidgets)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const setSupportOpen = useStore((s) => s.setSupportOpen)
  const fullscreen = useStore((s) => s.fullscreen)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingMode, setEditingMode] = useState(null)
  const [contextMenu, setContextMenu] = useState({ open: false, position: null, mode: null })
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletingMode, setDeletingMode] = useState(null)

  // 5s inactivity auto-hide logic for vertical rail
  const [isRetracted, setIsRetracted] = useState(false)
  const hideTimerRef = useRef(null)

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const startHideTimer = () => {
    clearHideTimer()
    if (!editorOpen && !deleteModalOpen && !contextMenu.open) {
      hideTimerRef.current = setTimeout(() => {
        setIsRetracted(true)
      }, 5000)
    }
  }

  useEffect(() => {
    if (!editorOpen && !deleteModalOpen && !contextMenu.open) {
      startHideTimer()
    } else {
      clearHideTimer()
      setIsRetracted(false)
    }
    return () => clearHideTimer()
    // start/clearHideTimer are recreated each render but carry no external deps
    // beyond the modal flags already listed — only re-run on those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, deleteModalOpen, contextMenu.open])

  const handleRailMouseEnter = () => {
    clearHideTimer()
    setIsRetracted(false)
  }

  const handleRailMouseLeave = () => {
    startHideTimer()
  }


  // Modes are rendered in their persisted order (mode.order ascending)
  const sortedModes = [...modes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // Inject a pseudo-mode "All" at the front
  const allMode = { id: 'all', name: 'All Scopes', icon: 'Globe', accentColor: '#94a3b8' }

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

  const openCreate = () => {
    setEditingMode(null)
    setEditorOpen(true)
  }
  const openEdit = (mode) => {
    if (mode.id === 'all') return // Cannot edit the 'All' mode
    setEditingMode(mode)
    setEditorOpen(true)
  }

  const handleContextMenu = (e, mode) => {
    if (mode.id === 'all') return
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      open: true,
      position: { x: e.clientX, y: e.clientY },
      mode,
    })
  }

  const handleRequestDelete = (mode) => {
    setContextMenu({ open: false, position: null, mode: null })
    setDeletingMode(mode)
    setDeleteModalOpen(true)
  }

  const sharedDialogs = (
    <>
      <ModeEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        mode={editingMode}
        onDeleteRequest={handleRequestDelete}
      />

      <DeleteModeModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setDeletingMode(null)
        }}
        mode={deletingMode}
      />

      <ModeContextMenu
        open={contextMenu.open}
        position={contextMenu.position}
        mode={contextMenu.mode}
        onClose={() => setContextMenu({ open: false, position: null, mode: null })}
        onEdit={(m) => openEdit(m)}
        onDelete={(m) => handleRequestDelete(m)}
        canDelete={modes.length > 1}
      />
    </>
  )

  // ── Vertical: unified sidebar rail (DESIGN_SYSTEM.md §5) ──────────────────
  // One continuous glass rail — modes on top, utilities below a hairline —
  // with 5s auto-retract all the way inside after mouse inactivity.
  if (vertical) {
    const railAction =
      'flex h-12 w-12 items-center justify-center rounded-2xl text-muted transition-all duration-200 hover:scale-105 hover:bg-ink/5 hover:text-ink'

    return (
      <>
        {/* Invisible edge trigger: hovering near the left screen edge immediately reveals the rail */}
        {isRetracted && (
          <div
            onMouseEnter={handleRailMouseEnter}
            className="fixed left-0 top-1/4 bottom-1/4 z-30 w-5 flex items-center cursor-pointer group"
            title="Hover to reveal mode switcher"
          >
            <div className="h-20 w-1 rounded-r-full bg-accent/40 transition-all duration-200 group-hover:w-2 group-hover:bg-accent group-hover:shadow-glow-sm" />
          </div>
        )}

        <div
          onMouseEnter={handleRailMouseEnter}
          onMouseLeave={handleRailMouseLeave}
          className="relative select-none"
        >
          <motion.div
            animate={{
              x: isRetracted ? -90 : 0,
              opacity: isRetracted ? 0 : 1,
              pointerEvents: isRetracted ? 'none' : 'auto',
            }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative flex shrink-0 flex-col items-center gap-2 rounded-[1.75rem] border border-line/60 bg-surface/80 px-2 py-3 shadow-premium-md backdrop-blur-xl transition-shadow duration-300"
          >
            <VerticalModePill
              key="all"
              mode={allMode}
              active={activeModeId === 'all'}
              onSelect={() => selectMode('all')}
              onEdit={() => openEdit(allMode)}
            />

            {sortedModes.map((mode) => (
              <VerticalModePill
                key={mode.id}
                mode={mode}
                active={mode.id === activeModeId}
                onSelect={() => selectMode(mode.id)}
                onEdit={() => openEdit(mode)}
                onContextMenu={handleContextMenu}
              />
            ))}

            <button onClick={openCreate} title="New mode" className={railAction}>
              <Plus className="h-6 w-6" />
            </button>

            {/* Hairline between modes and utilities */}
            <div className="my-1 h-[1px] w-6 bg-line/60" />

            {fullscreen && (
              <button
                onClick={() => window.protrack?.window?.toggleFullScreen?.()}
                title="Exit Full Screen"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-amber-400 transition-all duration-200 hover:scale-105 hover:bg-amber-500/10 hover:text-amber-500"
              >
                <Minimize2 className="h-6 w-6" />
              </button>
            )}

            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className={railAction}
            >
              {theme === 'dark' ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </button>

            <button onClick={() => setSettingsOpen(true)} title="Settings" className={railAction}>
              <Settings className="h-6 w-6" />
            </button>

            <button
              onClick={() => setSupportOpen(true)}
              title="Support Corner"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-rose-400 transition-all duration-200 hover:scale-105 hover:bg-rose-500/10 hover:text-rose-500"
            >
              <Heart className="h-6 w-6 fill-rose-400/20" />
            </button>

            <button
              onClick={signOut}
              title="Sign out"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-all duration-200 hover:scale-105 hover:bg-red-500/10 hover:text-red-500"
            >
              <LogOut className="h-6 w-6" />
            </button>
          </motion.div>
        </div>

        {sharedDialogs}
      </>
    )
  }

  // ── Horizontal: Original inline mode bar ──────────────────────────────────
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
            onContextMenu={handleContextMenu}
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

      {sharedDialogs}
    </>
  )
}
