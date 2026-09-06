import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react'
import { getIcon } from '@/lib/icons'
import { useStore } from '@/store/useStore'
import { cn } from '@/utils/cn'

function readCollapsed(widgetId) {
  try {
    return localStorage.getItem(`protrack:widget_collapsed:${widgetId}`) === '1'
  } catch {
    return false
  }
}
function writeCollapsed(widgetId, val) {
  try {
    localStorage.setItem(`protrack:widget_collapsed:${widgetId}`, val ? '1' : '0')
  } catch { /* private mode */ }
}

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

  const [collapsed, setCollapsed] = useState(() => !isHero && readCollapsed(widget.id))

  const toggleCollapse = useCallback((e) => {
    e.stopPropagation()
    setCollapsed((prev) => {
      const next = !prev
      writeCollapsed(widget.id, next)
      return next
    })
  }, [widget.id])

  return (
    <motion.div
      layout
      layoutId={`widget-${widget.id}`}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className={cn(
        'edge-light group relative flex flex-col overflow-hidden rounded-3xl border border-line/70 bg-surface/60 backdrop-blur-2xl transition-colors hover:border-accent/40',
        isHero
          ? 'h-full shadow-glass-lg'
          : collapsed
            ? 'self-start shadow-glass'
            : 'h-full shadow-glass',
      )}
    >
      <div className="flex w-full items-center gap-3 px-4 pb-2 pt-4">
        <button
          onClick={() => !isHero && !collapsed && toggleWidget(widget.id)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-accent/8 text-accent shadow-glow-sm ring-1 ring-accent/15">
            <Icon className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-xl font-semibold leading-tight tracking-tight">
              {widget.title}
            </span>
            {subtitle && (
              <span className="block truncate font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
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
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
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
              'flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-opacity hover:text-ink',
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
    </motion.div>
  )
}
