import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Play, Calendar, AlertCircle, X } from 'lucide-react'
import { cn } from '@/utils/cn'

export function ItemDetailPopover({
  item,
  anchorRect,
  onClose,
  onToggleComplete,
  onStartFocus,
  onDelete,
}) {
  const popoverRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [onClose])

  if (!item) return null

  // Positioning logic: place beside anchorRect (prefer right if room, else left)
  const pad = 12
  const popoverWidth = 280
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  let left = anchorRect ? anchorRect.right + pad : vw / 2 - popoverWidth / 2
  if (left + popoverWidth > vw - pad) {
    left = anchorRect ? Math.max(pad, anchorRect.left - popoverWidth - pad) : vw - popoverWidth - pad
  }

  let top = anchorRect ? anchorRect.top : 100
  top = Math.max(pad, Math.min(top, vh - 300))

  const isDone = Boolean(item.done) || item.column === 'done' || item.ref?.column === 'done'
  const title = item.title || item.text || item.ref?.text || item.ref?.title || 'Untitled task'
  const notes = item.notes || item.ref?.notes || ''
  const carriedFrom = item.carriedFrom || item.ref?.carriedFrom
  const dueAt = item.dueAt || item.ref?.dueAt

  const formattedDue = dueAt
    ? (dueAt.toDate ? dueAt.toDate() : new Date(dueAt)).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <AnimatePresence>
      <motion.div
        ref={popoverRef}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -4 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{ position: 'fixed', top, left, width: popoverWidth, zIndex: 9999 }}
        className="rounded-2xl border border-line/80 bg-surface/95 p-3.5 shadow-glass-xl backdrop-blur-2xl"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header row */}
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => onToggleComplete?.(item)}
            className={cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
              isDone
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-line/80 hover:border-accent text-transparent hover:text-accent',
            )}
            title={isDone ? 'Mark incomplete' : 'Mark complete'}
          >
            <Check className="h-2.5 w-2.5" />
          </button>

          <div className="min-w-0 flex-1">
            <h4 className={cn('text-xs font-semibold leading-snug text-ink break-words', isDone && 'line-through text-muted')}>
              {title}
            </h4>
            {item.modeName && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-line/50 bg-surface-2/60 px-1.5 py-0.5 text-[9px] font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.modeColor || '#6366f1' }} />
                {item.modeName}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Carried-forward notice */}
        {carriedFrom && (
          <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-300">
            <AlertCircle className="h-3 w-3 shrink-0 text-amber-400" />
            <span>Carried over from {carriedFrom}</span>
          </div>
        )}

        {/* Due date info */}
        {formattedDue && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
            <Calendar className="h-3 w-3 text-muted/70" />
            <span>Due: {formattedDue}</span>
          </div>
        )}

        {/* Notes if present */}
        {notes && (
          <div className="mt-2 rounded-lg bg-surface-2/40 p-2 text-[11px] text-ink/80 max-h-24 overflow-y-auto whitespace-pre-wrap">
            {notes}
          </div>
        )}

        {/* Actions bar */}
        <div className="mt-3 flex items-center gap-1.5 border-t border-line/40 pt-2.5">
          {onStartFocus && (
            <button
              type="button"
              onClick={() => {
                onStartFocus(item)
                onClose?.()
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accent hover:bg-accent/25 transition-colors"
            >
              <Play className="h-3 w-3" /> Focus 30m
            </button>
          )}

          <button
            type="button"
            onClick={() => onToggleComplete?.(item)}
            className="flex items-center gap-1 rounded-xl border border-line bg-surface-2/60 px-2 py-1 text-[10px] font-medium text-ink hover:bg-surface-2 transition-colors"
          >
            <Check className="h-3 w-3" /> {isDone ? 'Undo' : 'Done'}
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(item)
                onClose?.()
              }}
              className="rounded-xl border border-line bg-surface-2/60 p-1 text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
