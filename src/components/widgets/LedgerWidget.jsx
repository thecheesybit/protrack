import { useRef, memo } from 'react'
import { Timer, CheckCircle2, Trophy, Heart, History } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useLedger } from '@/hooks/useLedger'
import { useVirtualList } from '@/hooks/useVirtualList'
import { WidgetFrame } from './WidgetFrame'

const KIND = {
  focus: { Icon: Timer, tone: 'text-accent', bg: 'bg-accent/15' },
  task: { Icon: CheckCircle2, tone: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  milestone: { Icon: Trophy, tone: 'text-amber-400', bg: 'bg-amber-500/15' },
  habit: { Icon: Heart, tone: 'text-rose-400', bg: 'bg-rose-500/15' },
}

function relativeTime(at) {
  try {
    const d = at?.toDate ? at.toDate() : at ? new Date(at) : null
    return d ? formatDistanceToNow(d, { addSuffix: true }) : 'just now'
  } catch {
    return ''
  }
}

const LedgerItem = memo(function LedgerItem({ entry, style }) {
  const meta = KIND[entry.kind] || KIND.milestone
  const { Icon } = meta
  return (
    <div
      style={style}
      className="flex items-start gap-2.5 rounded-xl border border-line/50 bg-surface-2/30 px-3 py-2"
    >
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{entry.title}</span>
        {entry.detail && <span className="block truncate text-[11px] text-muted">{entry.detail}</span>}
      </div>
      <span className="shrink-0 text-[10px] text-muted/70">{relativeTime(entry.at)}</span>
    </div>
  )
})

/**
 * Read-only ledger / version history — a lightweight log of completed focus
 * blocks, cleared tasks, and milestones. Virtualized for smooth 60fps scrolling
 * when entry counts grow.
 */
export function LedgerWidget({ widget, variant }) {
  const entries = useLedger()
  const containerRef = useRef(null)

  const { isVirtualized, virtualItems, totalHeight } = useVirtualList({
    items: entries,
    itemHeight: 56,
    overscan: 4,
    containerRef,
    threshold: 20,
  })

  return (
    <WidgetFrame widget={widget} variant={variant} subtitle={`${entries.length} recent achievements`}>
      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line/60 py-6 text-center">
          <History className="h-6 w-6 text-muted" />
          <span className="text-xs text-muted">Your achievements will appear here.</span>
          <span className="text-[11px] text-muted/70">Finish a focus block or complete a task.</span>
        </div>
      ) : isVirtualized ? (
        <div ref={containerRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1 relative">
          <div style={{ height: totalHeight, position: 'relative', width: '100%' }}>
            {virtualItems.map(({ item, offsetTop }) => (
              <LedgerItem
                key={item.id}
                entry={item}
                style={{ position: 'absolute', top: offsetTop, left: 0, right: 0 }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {entries.map((e) => (
            <LedgerItem key={e.id} entry={e} />
          ))}
        </div>
      )}
    </WidgetFrame>
  )
}
