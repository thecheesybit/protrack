import { motion } from 'framer-motion'

/** A growing forest — one tree per completed focus session. */
export function ForestView({ count = 0 }) {
  const shown = Math.min(count, 48)
  return (
    <div className="flex flex-wrap content-end gap-0.5">
      {count === 0 && (
        <span className="text-xs text-muted">
          Complete a session to plant your first tree 🌱
        </span>
      )}
      {Array.from({ length: shown }).map((_, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, y: 6 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="text-xl leading-none"
        >
          🌳
        </motion.span>
      ))}
      {count > 48 && <span className="self-end text-xs text-muted">+{count - 48}</span>}
    </div>
  )
}
