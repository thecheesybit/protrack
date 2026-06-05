import { motion } from 'framer-motion'
import { Maximize2, Minimize2 } from 'lucide-react'
import { getIcon } from '@/lib/icons'
import { useStore } from '@/store/useStore'
import { cn } from '@/utils/cn'

/**
 * Shared widget chrome with the focused-zoom morph (shared layoutId).
 * The HEADER toggles maximize/minimize so the BODY stays fully interactive.
 * In the compact "rail" variant the whole frame is the toggle.
 *
 * @param {{
 *  widget: object,
 *  variant?: 'grid'|'hero'|'rail',
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
  const isRail = variant === 'rail'

  return (
    <motion.div
      layout
      layoutId={`widget-${widget.id}`}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-3xl border border-line/70 bg-surface/60 shadow-glass backdrop-blur-xl transition-colors hover:border-accent/30',
        widget.span,
        isHero && 'h-full min-h-[62vh]',
        !isHero && !isRail && 'min-h-[210px]',
      )}
    >
      <button
        onClick={() => toggleWidget(widget.id)}
        className={cn(
          'flex w-full items-center gap-3 px-4 text-left',
          isRail ? 'py-3' : 'pb-2 pt-4',
        )}
      >
        <span
          className={cn(
            'flex items-center justify-center rounded-xl bg-accent/15 text-accent',
            isRail ? 'h-9 w-9' : 'h-10 w-10',
          )}
        >
          <Icon className={isRail ? 'h-4 w-4' : 'h-5 w-5'} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold leading-tight">
            {widget.title}
          </span>
          {!isRail && subtitle && (
            <span className="block truncate text-xs text-muted">{subtitle}</span>
          )}
        </span>

        {!isRail && headerActions && (
          <span
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1"
          >
            {headerActions}
          </span>
        )}

        {!isRail &&
          (isHero ? (
            <Minimize2 className="h-4 w-4 shrink-0 text-muted" />
          ) : (
            <Maximize2 className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
          ))}
      </button>

      {!isRail && (
        <div className={cn('flex min-h-0 flex-1 flex-col px-4 pb-4', bodyClassName)}>
          {children}
        </div>
      )}
    </motion.div>
  )
}
