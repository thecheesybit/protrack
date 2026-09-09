import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Check } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { SpriteFoliage } from '@/components/focus/ForestSprites'
import { playFocusChime } from '@/lib/audioFX'
import { useEffect } from 'react'

export function SessionCompleteModal() {
  const congratulations = useStore((s) => s.congratulations)
  const clearCongratulations = useStore((s) => s.clearCongratulations)

  useEffect(() => {
    if (congratulations) {
      try {
        playFocusChime()
      } catch { /* noop */ }
    }
  }, [congratulations])

  const durationMin = congratulations?.durationMin ?? 25
  const plantType = congratulations?.plantType || (durationMin < 10 ? 'flower' : durationMin <= 15 ? 'shrub' : 'tree')
  const plantLabel = plantType === 'flower' ? 'Flower' : plantType === 'shrub' ? 'Shrub' : 'Tree'
  const label = congratulations?.label ?? 'Deep Focus'

  const handleDismiss = () => {
    clearCongratulations()
  }

  return (
    <AnimatePresence>
      {congratulations && (
        <motion.div
          key="session-complete-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
        >
          <motion.div
            key="session-complete-modal"
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-500/30 bg-slate-950 p-6 text-center shadow-2xl"
          >
            {/* Decorative ambient glow */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <Trophy className="h-3.5 w-3.5" />
              <span>Session Accomplished!</span>
            </div>

            {/* Growing Tree Centerpiece */}
            <div className="my-5 flex flex-col items-center justify-center">
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                className="flex h-24 w-24 items-end justify-center pb-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 shadow-inner overflow-hidden"
              >
                <SpriteFoliage
                  type={plantType}
                  height={plantType === 'flower' ? 46 : plantType === 'shrub' ? 56 : 74}
                />
              </motion.div>
              <span className="mt-3 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                +1 {plantLabel} Planted on Today&apos;s Calendar
              </span>
            </div>

            {/* Heading and details */}
            <h2 className="text-xl font-bold text-white">Congratulations! 🎉</h2>
            <p className="mt-1 text-xs text-muted">
              You completed <strong className="text-white">{durationMin} minutes</strong> of {label.toLowerCase()}. Your focus forest is growing!
            </p>

            {/* Action button */}
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400 active:scale-95"
              >
                <Check className="h-4 w-4" />
                <span>Great Job! Continue</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
