import { AnimatePresence, motion } from 'framer-motion'
import {
  Timer,
  Coffee,
  Droplet,
  CloudOff,
  Cloud,
  TrendingUp,
  CheckCircle2,
  Info,
  Clock,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useIslandCycle } from '@/hooks/useIslandCycle'
import { isDesktop } from '@/desktop/isDesktop'

// Semantic icon + tone per event kind — Lucide only, never emoji.
const KIND = {
  focus: { Icon: Timer, tone: 'text-accent' },
  break: { Icon: Coffee, tone: 'text-amber-400' },
  water: { Icon: Droplet, tone: 'text-sky-400' },
  'sync-offline': { Icon: CloudOff, tone: 'text-slate-400' },
  'sync-online': { Icon: Cloud, tone: 'text-emerald-400' },
  progress: { Icon: TrendingUp, tone: 'text-accent' },
  success: { Icon: CheckCircle2, tone: 'text-emerald-400' },
  info: { Icon: Info, tone: 'text-accent' },
  deadline: { Icon: Clock, tone: 'text-amber-400' },
}

const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }

/**
 * Universal Dynamic Island — a single floating, morphing notifier anchored to
 * the top center. It expands in on an event, smoothly resizes between events of
 * different widths (Framer `layout`), and contracts away when the queue drains.
 * Click to dismiss. Mounted once in the Dashboard.
 */
export function DynamicIsland() {
  useIslandCycle()
  const active = useStore((s) => s.islandActive)
  const dismissIsland = useStore((s) => s.dismissIsland)

  const meta = active ? KIND[active.kind] || KIND.info : null
  const Icon = meta?.Icon

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
      style={{ top: isDesktop ? 44 : 14 }}
    >
      <AnimatePresence>
        {active && (
          <motion.button
            key="island"
            type="button"
            layout
            onClick={() => dismissIsland(active.id)}
            initial={{ y: -28, opacity: 0, scale: 0.85 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -18, opacity: 0, scale: 0.92 }}
            transition={spring}
            aria-live="polite"
            className="edge-light pointer-events-auto flex max-w-[min(92vw,30rem)] items-center gap-3 rounded-full border border-line/70 bg-surface/70 px-4 py-2.5 text-left shadow-glass-lg backdrop-blur-2xl"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 ${meta.tone}`}
            >
              <Icon className="h-4 w-4" />
            </span>

            <AnimatePresence mode="wait">
              <motion.span
                key={active.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="min-w-0"
              >
                <span className="block truncate text-sm font-semibold text-ink">
                  {active.title}
                </span>
                {active.detail && (
                  <span className="block truncate text-xs text-muted">{active.detail}</span>
                )}
              </motion.span>
            </AnimatePresence>

            {typeof active.progress === 'number' && (
              <span className="ml-1 flex shrink-0 items-center gap-2">
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                  <motion.span
                    className="block h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, Math.min(100, active.progress))}%` }}
                    transition={spring}
                  />
                </span>
                <span className="text-xs font-semibold tabular-nums text-muted">
                  {Math.round(active.progress)}%
                </span>
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
