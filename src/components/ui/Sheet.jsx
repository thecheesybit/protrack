import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

/** Reusable slide-over panel (right by default). */
export function Sheet({ open, onClose, title, icon, children, side = 'right', className }) {
  const x = side === 'right' ? '100%' : '-100%'
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.aside
            initial={{ x }}
            animate={{ x: 0 }}
            exit={{ x }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className={cn(
              'absolute bottom-0 top-0 flex w-full max-w-md flex-col border-line bg-surface/95 shadow-glass backdrop-blur-2xl',
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              className,
            )}
          >
            <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
              <div className="flex items-center gap-2.5">
                {icon}
                <h3 className="font-semibold">{title}</h3>
              </div>
              <button
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
