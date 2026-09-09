import { useEffect, useRef, useId } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * Reusable slide-over panel (right by default).
 *
 * Accessibility: WAI-ARIA dialog pattern — role="dialog", aria-modal, focus
 * trap, Escape to close, body scroll lock, and focus restoration on unmount.
 */
export function Sheet({ open, onClose, title, icon, children, side = 'right', className }) {
  const x = side === 'right' ? '100%' : '-100%'
  const panelRef = useRef(null)
  const previousFocusRef = useRef(null)
  const titleId = useId()

  // ── Focus trap + Escape + scroll lock ──
  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const raf = requestAnimationFrame(() => {
      const el = panelRef.current
      if (!el) return
      const focusable = el.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length) focusable[0].focus()
      else el.focus()
    })

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key === 'Tab') {
        const el = panelRef.current
        if (!el) return
        const focusable = el.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prev
      previousFocusRef.current?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={{ x }}
            animate={{ x: 0 }}
            exit={{ x }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className={cn(
              'absolute bottom-0 top-0 flex w-full max-w-md flex-col border-line bg-surface/95 shadow-glass backdrop-blur-2xl outline-none',
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              className,
            )}
          >
            <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
              <div className="flex items-center gap-2.5">
                {icon}
                <h3 id={titleId} className="font-semibold">{title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
