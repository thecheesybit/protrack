import { LayoutGroup, AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { getIcon } from '@/lib/icons'
import { WIDGETS } from '@/components/widgets/widgetRegistry'
import { getWidgetComponent } from '@/components/widgets/widgetComponents'

function Widget({ widget, variant }) {
  const Component = getWidgetComponent(widget.id)
  return <Component widget={widget} variant={variant} />
}

/** Minimal off-board trigger — the widget's content lives off-screen; tap to focus it. */
function DockChip({ widget, onClick }) {
  const Icon = getIcon(widget.icon)
  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -16, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -16, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onClick={onClick}
      title={widget.title}
      className="group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-line/60 bg-surface/60 text-muted backdrop-blur-xl transition-colors hover:border-accent/50 hover:text-ink"
    >
      <Icon className="h-5 w-5" />
      {/* Title flyout on hover */}
      <span className="pointer-events-none absolute left-14 z-20 whitespace-nowrap rounded-lg border border-line/60 bg-surface px-2 py-1 text-xs opacity-0 shadow-glass transition-opacity group-hover:opacity-100">
        {widget.title}
      </span>
    </motion.button>
  )
}

/**
 * The single unified board. Engaging a widget morphs it into a hero pane (shared
 * layoutId) while every neighbor slides off-screen into a minimalist trigger
 * dock — the accordion "focused-zoom" mechanic, no routing, no perceived remount.
 */
export function BoardCanvas() {
  const maximizedWidgetId = useStore((s) => s.maximizedWidgetId)
  const maximizeWidget = useStore((s) => s.maximizeWidget)
  const maximized = WIDGETS.find((w) => w.id === maximizedWidgetId)
  const others = WIDGETS.filter((w) => w.id !== maximizedWidgetId)

  return (
    <LayoutGroup>
      {maximized ? (
        <div className="flex h-full gap-3">
          {/* Off-screen neighbors → vertical trigger dock */}
          <div className="flex shrink-0 flex-col gap-2">
            <AnimatePresence>
              {others.map((w) => (
                <DockChip key={w.id} widget={w} onClick={() => maximizeWidget(w.id)} />
              ))}
            </AnimatePresence>
          </div>

          {/* Focused hero */}
          <motion.div layout className="min-h-0 flex-1">
            <Widget widget={maximized} variant="hero" />
          </motion.div>
        </div>
      ) : (
        <div className="grid min-h-full grid-cols-1 gap-4 [grid-auto-rows:minmax(180px,1fr)] sm:grid-cols-2 lg:grid-cols-3">
          {WIDGETS.map((w) => (
            <Widget key={w.id} widget={w} variant="grid" />
          ))}
        </div>
      )}
    </LayoutGroup>
  )
}
