import { motion } from 'framer-motion'
import { Maximize2, Minimize2 } from 'lucide-react'
import { getIcon } from '@/lib/icons'
import { useStore } from '@/store/useStore'
import { cn } from '@/utils/cn'

/**
 * Shared widget chrome with the focused-zoom morph (shared layoutId).
 * The HEADER toggles maximize/minimize so the BODY stays fully interactive.
 *
 * @param {{
 *  widget: object,
 *  variant?: 'grid'|'hero',
 *  subtitle?: string,
 *  headerActions?: import('react').ReactNode,
 *  children?: import('react').ReactNode,
 *  bodyClassName?: string,
 * }} props
 */
export function WidgetFrame({
  widget,
  variant = 'grid',
  subtitle,
  headerActions,
  children,
  bodyClassName,
}) {
  const Icon = getIcon(widget.icon)
  const toggleWidget = useStore((s) => s.toggleWidget)
  const isHero = variant === 'hero'

  return (
    <motion.div
      layout
      layoutId={`widget-${widget.id}`}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className={cn(
        'edge-light group relative flex flex-col overflow-hidden rounded-3xl border border-line/70 bg-surface/60 backdrop-blur-2xl transition-colors hover:border-accent/40',
        isHero ? 'h-full shadow-glass-lg' : 'h-full min-h-[180px] shadow-glass',
        widget.span,
      )}
    >
      <button
        onClick={() => toggleWidget(widget.id)}
        className="flex w-full items-center gap-3 px-4 pb-2 pt-4 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold leading-tight">{widget.title}</span>
          {subtitle && <span className="block truncate text-xs text-muted">{subtitle}</span>}
        </span>

        {headerActions && (
          <span onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
            {headerActions}
          </span>
        )}

        {isHero ? (
          <Minimize2 className="h-4 w-4 shrink-0 text-muted" />
        ) : (
          <Maximize2 className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </button>

      <div className={cn('flex min-h-0 flex-1 flex-col px-4 pb-4', bodyClassName)}>
        {children}
      </div>
    </motion.div>
  )
}
