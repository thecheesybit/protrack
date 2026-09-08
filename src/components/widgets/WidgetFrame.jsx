import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react'
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
  const toggleWidgetCollapsed = useStore((s) => s.toggleWidgetCollapsed)
  const isHero = variant === 'hero'

  // Collapse state is board-level (uiSlice) so BoardCanvas can auto-promote a
  // dock widget into a minimized slot. Hero view is never collapsed.
  const collapsed = useStore((s) => !isHero && Boolean(s.collapsedWidgets[widget.id]))

  const toggleCollapse = useCallback((e) => {
    e.stopPropagation()
    toggleWidgetCollapsed(widget.id)
  }, [widget.id, toggleWidgetCollapsed])

  return (
    <div
      className={cn(
        'edge-light group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-surface/70 backdrop-blur-2xl transition-colors duration-200 hover:border-accent/40',
        isHero
          ? 'h-full shadow-glass-lg'
          : collapsed
            ? 'self-start shadow-glass'
            : 'h-full shadow-glass',
      )}
    >
      <div className="flex w-full items-center gap-3 px-4 pb-2 pt-3.5">
        <button
          onClick={() => !isHero && !collapsed && toggleWidget(widget.id)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/25 to-accent/10 text-accent shadow-glow-sm ring-1 ring-accent/20 transition-transform group-hover:scale-105">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-lg font-semibold leading-tight tracking-tight text-ink">
              {widget.title}
            </span>
            {subtitle && (
              <span className="block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted/80">
                {subtitle}
              </span>
            )}
          </span>
        </button>

        {headerActions && !collapsed && (
          <span onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
            {headerActions}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {!isHero && (
            <button
              onClick={toggleCollapse}
              className="flex h-7 w-7 items-center justify-center rounded-xl text-muted opacity-0 transition-all hover:bg-white/5 hover:text-ink group-hover:opacity-100"
              aria-label={collapsed ? 'Expand widget' : 'Minimize widget'}
              title={collapsed ? 'Expand' : 'Minimize'}
            >
              {collapsed
                ? <ChevronDown className="h-4 w-4" />
                : <ChevronUp className="h-4 w-4" />
              }
            </button>
          )}
          <button
            onClick={() => isHero ? toggleWidget(widget.id) : (!collapsed && toggleWidget(widget.id))}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-xl text-muted transition-all hover:bg-white/5 hover:text-ink',
              isHero ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
            aria-label={isHero ? 'Minimize widget' : 'Maximize widget'}
          >
            {isHero
              ? <Minimize2 className="h-4 w-4" />
              : <Maximize2 className="h-4 w-4" />
            }
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className={cn('flex min-h-0 flex-1 flex-col overflow-auto px-4 pb-4', bodyClassName)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
