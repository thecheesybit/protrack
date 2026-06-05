import { motion } from 'framer-motion'
import { Maximize2, Minimize2 } from 'lucide-react'
import { getIcon } from '@/lib/icons'
import { useStore } from '@/store/useStore'
import { cn } from '@/utils/cn'

/**
 * A single board widget. The shared `layoutId` lets Framer Motion morph it
 * smoothly between grid, hero (maximized), and rail (minimized) positions —
 * this single primitive delivers the "focused-zoom / accordion" UX.
 *
 * @param {{ widget: object, variant?: 'grid'|'hero'|'rail' }} props
 */
export function WidgetShell({ widget, variant = 'grid' }) {
  const Icon = getIcon(widget.icon)
  const toggleWidget = useStore((s) => s.toggleWidget)

  const isHero = variant === 'hero'
  const isRail = variant === 'rail'

  return (
    <motion.button
      layout
      layoutId={`widget-${widget.id}`}
      onClick={() => toggleWidget(widget.id)}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      whileHover={isRail ? { scale: 1.02 } : { y: -2 }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-3xl border border-line/70 bg-surface/60 p-5 text-left shadow-glass backdrop-blur-xl transition-colors',
        'hover:border-accent/40',
        widget.span,
        isHero && 'h-full min-h-[60vh]',
        isRail && 'min-h-0 flex-row items-center gap-3 p-3.5',
        !isHero && !isRail && 'min-h-[180px]',
      )}
    >
      {/* Header */}
      <motion.div layout="position" className="flex w-full items-center gap-3">
        <span
          className={cn(
            'flex items-center justify-center rounded-xl bg-accent/15 text-accent',
            isRail ? 'h-9 w-9' : 'h-10 w-10',
          )}
        >
          <Icon className={isRail ? 'h-4 w-4' : 'h-5 w-5'} />
        </span>

        <span className="flex-1">
          <span className="block font-semibold leading-tight">
            {widget.title}
          </span>
          {!isRail && (
            <span className="text-xs text-muted">Sprint {widget.sprint}</span>
          )}
        </span>

        {!isRail && (
          <span className="text-muted opacity-0 transition-opacity group-hover:opacity-100">
            {isHero ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </span>
        )}
      </motion.div>

      {/* Body (hidden in the compact rail) */}
      {!isRail && (
        <motion.div
          layout="position"
          className={cn(
            'mt-4 flex flex-1 flex-col',
            isHero ? 'justify-start' : 'justify-end',
          )}
        >
          <p className={cn('text-muted', isHero ? 'text-base' : 'text-sm')}>
            {widget.tagline}
          </p>

          {isHero && (
            <div className="mt-6 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line/70 bg-surface-2/40">
              <span className="text-sm text-muted">
                Lands in Sprint {widget.sprint} — placeholder for now.
              </span>
            </div>
          )}
        </motion.div>
      )}
    </motion.button>
  )
}
