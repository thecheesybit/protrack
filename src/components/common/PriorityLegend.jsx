import { PRIORITIES } from '@/lib/priority'

/**
 * Compact legend strip — 4 colored dots with labels — so users can read the
 * priority colors on tasks/todos without hovering each one.
 */
export function PriorityLegend({ className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted ${className}`}
      aria-label="Priority legend"
    >
      <span className="font-medium uppercase tracking-wider">Priority:</span>
      {PRIORITIES.map((p) => (
        <span key={p.key} className="inline-flex items-center gap-1">
          <span
            className={`h-1.5 w-1.5 rounded-full ring-1.5 ${p.dot} ${p.ring}`}
            style={{ boxShadow: `0 0 0 2px ${p.color}22` }}
          />
          <span>{p.label}</span>
        </span>
      ))}
    </div>
  )
}
