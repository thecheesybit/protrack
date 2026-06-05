import { LayoutGroup } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { WIDGETS } from '@/components/widgets/widgetRegistry'
import { WidgetShell } from '@/components/widgets/WidgetShell'

/**
 * The single unified board. When a widget is maximized it morphs into a hero
 * pane while siblings collapse into a compact rail — all via shared-layout
 * animation (no route changes, no remounts the user can perceive).
 */
export function BoardCanvas() {
  const maximizedWidgetId = useStore((s) => s.maximizedWidgetId)
  const maximized = WIDGETS.find((w) => w.id === maximizedWidgetId)
  const others = WIDGETS.filter((w) => w.id !== maximizedWidgetId)

  return (
    <LayoutGroup>
      {maximized ? (
        <div className="flex h-full flex-col gap-4 lg:flex-row">
          {/* Compact rail of the non-focused widgets */}
          <div className="flex shrink-0 gap-3 overflow-x-auto lg:w-60 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
            {others.map((w) => (
              <div key={w.id} className="min-w-[200px] lg:min-w-0">
                <WidgetShell widget={w} variant="rail" />
              </div>
            ))}
          </div>

          {/* Focused hero pane */}
          <div className="min-h-0 flex-1">
            <WidgetShell widget={maximized} variant="hero" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WIDGETS.map((w) => (
            <WidgetShell key={w.id} widget={w} variant="grid" />
          ))}
        </div>
      )}
    </LayoutGroup>
  )
}
