import { motion } from 'framer-motion'
import { TreePine, Sprout } from 'lucide-react'

/** A growing forest — one tree per completed focus session. */
export function ForestView({ count = 0 }) {
  const shown = Math.min(count, 48)
  return (
    <div className="flex flex-wrap content-end gap-1">
      {count === 0 && (
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Sprout className="h-4 w-4 text-emerald-400" />
          Complete a session to plant your first tree
        </span>
      )}
      {Array.from({ length: shown }).map((_, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, y: 6 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="leading-none text-emerald-400"
        >
          <TreePine className="h-5 w-5" />
        </motion.span>
      ))}
      {count > 48 && <span className="self-end text-xs text-muted">+{count - 48}</span>}
    </div>
  )
}
