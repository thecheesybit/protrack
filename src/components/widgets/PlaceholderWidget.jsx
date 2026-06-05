import { WidgetFrame } from './WidgetFrame'

/** Empty-state body for widgets that land in a later sprint. */
export function PlaceholderWidget({ widget, variant }) {
  return (
    <WidgetFrame widget={widget} variant={variant} subtitle={`Sprint ${widget.sprint}`}>
      <div className="flex flex-1 flex-col justify-end">
        <p className="text-sm text-muted">{widget.tagline}</p>
        {variant === 'hero' && (
          <div className="mt-6 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line/70 bg-surface-2/40">
            <span className="text-sm text-muted">
              Lands in Sprint {widget.sprint}.
            </span>
          </div>
        )}
      </div>
    </WidgetFrame>
  )
}
