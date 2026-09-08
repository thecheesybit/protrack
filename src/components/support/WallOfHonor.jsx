import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, Globe } from 'lucide-react'
import { useWall } from '@/hooks/useWall'
import { cn } from '@/utils/cn'

function amountLabel(p) {
  return p.currency === 'USD' ? `$${p.amount}` : `₹${p.amount}`
}

function regionLabel(region) {
  return region === 'US' ? 'United States' : 'India'
}

/**
 * Aesthetic, dignified Wall of Honor.
 * Celebrates contributors with editorial typography, refined monograms, and quiet luxury polish.
 */
export function WallOfHonor() {
  const entries = useWall()
  const [openId, setOpenId] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'top' | 'IN' | 'US'

  const filteredEntries = useMemo(() => {
    return entries.filter((p) => {
      if (filter === 'top') {
        const isUsd = p.currency === 'USD'
        return isUsd ? p.amount >= 20 : p.amount >= 500
      }
      if (filter === 'IN') return p.region === 'IN'
      if (filter === 'US') return p.region === 'US'
      return true
    })
  }, [entries, filter])

  return (
    <div className="space-y-4">
      {/* Refined Filter Pills — Zero Emojis */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {[
          { id: 'all', label: `All Patrons (${entries.length})` },
          { id: 'top', label: 'Top Contributors' },
          { id: 'IN', label: 'India' },
          { id: 'US', label: 'United States' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer',
              filter === tab.id
                ? 'bg-ink text-surface font-semibold shadow-sm'
                : 'border border-line/60 bg-surface-2/30 text-muted hover:border-line hover:text-ink hover:bg-surface-2/60',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid of Patron Cards */}
      <motion.div layout className="columns-1 gap-3.5 sm:columns-2 [&>*]:mb-3.5">
        <AnimatePresence>
          {filteredEntries.map((p) => {
            const open = openId === p.id
            const isUsd = p.currency === 'USD'
            const isTopTier = isUsd ? p.amount >= 25 : p.amount >= 500

            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                onClick={() => setOpenId(open ? null : p.id)}
                className={cn(
                  'group block w-full break-inside-avoid rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer select-none',
                  isTopTier
                    ? 'border-amber-500/25 bg-gradient-to-br from-amber-500/5 via-surface-2/25 to-surface-2/10 hover:border-amber-500/45 shadow-sm'
                    : 'border-line/60 bg-surface-2/20 hover:border-line hover:bg-surface-2/35 shadow-sm',
                  open && 'ring-1 ring-accent/30',
                )}
              >
                {/* Top Row: Monogram, Name, Location & Amount */}
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-xs font-semibold uppercase transition-transform group-hover:scale-105',
                      isTopTier
                        ? 'border border-amber-500/30 bg-amber-500/15 text-amber-400'
                        : 'border border-line/60 bg-surface-2 text-ink',
                    )}
                  >
                    {p.name?.[0] || '?'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-display text-sm font-semibold text-ink tracking-tight">
                        {p.name}
                      </span>
                      {isTopTier && (
                        <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted">
                      <Globe className="h-2.5 w-2.5 opacity-60" />
                      <span>{regionLabel(p.region)}</span>
                    </div>
                  </div>

                  <span
                    className={cn(
                      'shrink-0 rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold tracking-tight',
                      isTopTier
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                        : 'border-line/60 bg-surface/60 text-ink/80',
                    )}
                  >
                    {amountLabel(p)}
                  </span>
                </div>

                {/* Testimony */}
                <p
                  className={cn(
                    'mt-3 text-xs leading-relaxed text-ink/80 font-normal transition-all',
                    open ? '' : 'line-clamp-2',
                  )}
                >
                  "{p.testimony}"
                </p>

                {/* Feature Request Note (Shown when open, or subtle when collapsed) */}
                {p.featureRequest && (
                  <div className="mt-2.5 border-t border-line/30 pt-2 flex items-baseline gap-1.5 text-[11px] text-muted">
                    <span className="font-mono text-[9px] uppercase font-semibold text-accent tracking-wider shrink-0">
                      Wants next:
                    </span>
                    <span className="text-ink/80 font-medium truncate">{p.featureRequest}</span>
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
