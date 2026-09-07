import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Trash2 } from 'lucide-react'
import { getIcon } from '@/lib/icons'
import { cn } from '@/utils/cn'

/**
 * Context menu displayed upon right-clicking a mode pill.
 * Rendered via createPortal to document.body to avoid parent CSS transforms.
 */
export function ModeContextMenu({
  open,
  position,
  mode,
  onClose,
  onEdit,
  onDelete,
  canDelete = true,
}) {
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleScrollOrResize = () => {
      onClose()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [open, onClose])

  if (typeof document === 'undefined' || !mode) return null

  // Approximate menu dimensions for boundary clamping
  const MENU_WIDTH = 210
  const MENU_HEIGHT = 140
  const posX = position ? Math.max(8, Math.min(position.x, window.innerWidth - MENU_WIDTH - 8)) : 0
  const posY = position ? Math.max(8, Math.min(position.y, window.innerHeight - MENU_HEIGHT - 8)) : 0

  const Icon = getIcon(mode.icon)

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              left: `${posX}px`,
              top: `${posY}px`,
            }}
            className="pointer-events-auto w-52 overflow-hidden rounded-2xl border border-line/70 bg-surface/95 p-1.5 shadow-glass backdrop-blur-xl select-none"
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Header with Mode Name & Icon */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-line/50 mb-1">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: mode.accentColor || '#6366f1' }}
              >
                <Icon className="h-3 w-3" />
              </span>
              <span className="truncate text-xs font-semibold text-ink" title={mode.name}>
                {mode.name}
              </span>
            </div>

            {/* Action 1: Rename / Edit */}
            <button
              onClick={() => {
                onClose()
                onEdit(mode)
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2 hover:text-ink cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5 text-muted" />
              <span>Rename & Edit Mode</span>
            </button>

            {/* Action 2: Delete */}
            <button
              onClick={() => {
                if (!canDelete) return
                onClose()
                onDelete(mode)
              }}
              disabled={!canDelete}
              title={!canDelete ? 'Keep at least one mode' : `Delete ${mode.name}`}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer',
                canDelete
                  ? 'text-rose-500 hover:bg-rose-500/10 hover:text-rose-600'
                  : 'text-muted/50 cursor-not-allowed opacity-50',
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Mode</span>
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
