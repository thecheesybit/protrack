import { AnimatePresence, motion } from 'framer-motion'
import { X, Play } from 'lucide-react'
import { useStore } from '@/store/useStore'

/**
 * Distraction-free overlay opened from a timetable slot (or subject).
 * Sprint 5 embeds the live Pomodoro here; for now it's a calm staging room
 * that hands off to the Deep Focus widget.
 */
export function FocusPanel() {
  const ctx = useStore((s) => s.focusContext)
  const closeFocus = useStore((s) => s.closeFocus)
  const maximizeWidget = useStore((s) => s.maximizeWidget)
  const startFocus = useStore((s) => s.startFocus)
  const activeModeId = useStore((s) => s.activeModeId)

  const start = () => {
    startFocus({
      label: ctx.title,
      color: ctx.color,
      subjectId: ctx.subjectId || null,
      modeId: activeModeId,
      durationMin: ctx.durationMin,
    })
    maximizeWidget('focus')
    closeFocus()
  }

  return (
    <AnimatePresence>
      {ctx && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* immersive backdrop tinted by the session color */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background: `radial-gradient(60% 60% at 50% 40%, ${ctx.color || '#6366f1'}40, transparent)`,
            }}
          />

          <button
            onClick={closeFocus}
            className="absolute right-6 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Exit focus"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* breathing ring */}
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-10 flex h-44 w-44 items-center justify-center rounded-full border"
              style={{ borderColor: `${ctx.color || '#6366f1'}80` }}
            >
              <div
                className="h-28 w-28 rounded-full blur-2xl"
                style={{ backgroundColor: ctx.color || '#6366f1' }}
              />
            </motion.div>

            <p className="text-sm uppercase tracking-[0.3em] text-white/50">Focus on</p>
            <h2 className="mt-2 max-w-xl text-3xl font-bold text-white sm:text-4xl">
              {ctx.title || 'Deep work'}
            </h2>
            {ctx.subtitle && (
              <p className="mt-2 text-white/60">{ctx.subtitle}</p>
            )}

            <button
              onClick={start}
              className="mt-10 flex items-center gap-2.5 rounded-2xl bg-white px-7 py-3.5 font-semibold text-gray-900 shadow-xl transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Play className="h-5 w-5 fill-gray-900" />
              Start Deep Focus
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
