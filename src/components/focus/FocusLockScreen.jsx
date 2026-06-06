import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { FocusWidget } from '@/components/widgets/FocusWidget'

/**
 * Full-viewport lockout overlay during Deep Focus sessions.
 * Replaces the entire Dashboard content — TopBar, ModeSwitcher,
 * BoardCanvas, AI FAB are all hidden. Only the FocusWidget (hero mode)
 * and the FlipClock (rendered separately in Dashboard) remain visible.
 *
 * The workspace stays locked even during breaks. Users can only exit by
 * completing the full session or triggering the 3-attempt quit penalty.
 */
export function FocusLockScreen() {
  const focusLocked = useStore((s) => s.focusLocked)
  const phase = useStore((s) => s.phase)
  const session = useStore((s) => s.session)

  return (
    <AnimatePresence>
      {focusLocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[45] flex items-center justify-center"
          style={{
            background: phase === 'break'
              ? 'radial-gradient(ellipse at center, rgba(16,185,129,0.08) 0%, rgba(0,0,0,0.92) 70%)'
              : session?.color
                ? `radial-gradient(ellipse at center, ${session.color}12 0%, rgba(0,0,0,0.92) 70%)`
                : 'radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, rgba(0,0,0,0.92) 70%)',
          }}
        >
          {/* Frosted backdrop */}
          <div className="absolute inset-0 backdrop-blur-3xl" />

          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.03] bg-grid" />

          {/* Focus widget centered */}
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-4xl px-6"
          >
            <FocusWidget widget={{ id: 'focus', icon: 'Timer', label: 'Focus' }} variant="hero" />
          </motion.div>

          {/* Phase indicator glow ring */}
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
            style={{
              boxShadow: phase === 'break'
                ? 'inset 0 0 200px 80px rgba(16,185,129,0.04)'
                : `inset 0 0 200px 80px ${session?.color || 'rgba(99,102,241,0.04)'}08`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
