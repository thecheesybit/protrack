import { createPortal } from 'react-dom'
import { useEffect, useRef, useId } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * Reusable centered glass modal with a backdrop blur and spring entry.
 * Closes on backdrop click or Escape.
 *
 * Rendered through a portal to <body> so `position: fixed` always resolves
 * against the viewport. Without this, opening the modal from inside any
 * transformed ancestor (e.g. the sidebar rail, which uses -translate-y-1/2)
 * makes the transform a containing block and crushes the modal into that
 * element's box — the bug that squished the mode editor into a left-edge strip.
 *
 * Accessibility: WAI-ARIA dialog pattern — role="dialog", aria-modal, focus
 * trap, Escape to close, body scroll lock, and focus restoration on unmount.
 */
export function Modal({ open, onClose, title, children, className, footer, headerExtra }) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)
  const titleId = useId()

  // ── Focus trap + Escape + scroll lock ──
  useEffect(() => {
    if (!open) return

    // Remember the element that had focus before the modal opened.
    previousFocusRef.current = document.activeElement

    // Lock body scroll.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the first focusable element inside the dialog, or the dialog itself.
    const raf = requestAnimationFrame(() => {
      const el = dialogRef.current
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
      // Tab trap — cycle focus within the dialog.
      if (e.key === 'Tab') {
        const el = dialogRef.current
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
      // Restore focus to the previously focused element.
      previousFocusRef.current?.focus?.()
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={cn(
              'relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-line/70 bg-surface/90 shadow-glass backdrop-blur-2xl outline-none',
              className,
            )}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
                <h3 id={titleId} className="font-semibold">{title}</h3>
                <div className="flex items-center gap-1.5">
                  {headerExtra}
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            <div className="p-5">{children}</div>
            {footer && (
              <div className="flex justify-end gap-2 border-t border-line/60 px-5 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
