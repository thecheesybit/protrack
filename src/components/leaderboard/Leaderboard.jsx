import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, TreePine, Flame, ArrowLeft, Clock, Sprout, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { ForestTerrain } from '@/components/focus/ForestTerrain'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'

function formatMin(min) {
  const m = Math.max(0, Math.round(Number(min) || 0))
  const h = Math.floor(m / 60)
  const r = m % 60
  return h > 0 ? `${h}h ${r}m` : `${r}m`
}

/** Compact published forest snapshot ({t,s}[]) → ForestTerrain items. */
function snapshotToItems(forest) {
  return (forest || []).map((p, i) => ({
    key: `p${i}`,
    type: p.t,
    species: 'all',
    seed: Number(p.s) || i,
  }))
}

function Avatar({ entry }) {
  const initial = (entry.displayName || '?').trim().charAt(0).toUpperCase()
  if (entry.photoURL) {
    return (
      <img
        src={entry.photoURL}
        alt=""
        referrerPolicy="no-referrer"
        className="h-9 w-9 shrink-0 rounded-full border border-white/15 object-cover"
      />
    )
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-emerald-500/20 text-sm font-bold text-emerald-300">
      {initial}
    </div>
  )
}

const RANK_STYLES = ['text-amber-300', 'text-slate-300', 'text-orange-400']

/**
 * Public focus leaderboard — ranked Weekly / Monthly list. Tapping a forester
 * opens their forest sanctuary snapshot + stats. Rendered inside the dark
 * sanctuary overlay and the focus widget.
 */
export function Leaderboard() {
  const { user } = useAuth()
  const uid = user?.uid
  const optedOut = useStore((s) => s.settings?.leaderboardOptOut === true)
  const [period, setPeriod] = useState('monthly') // 'weekly' | 'monthly'
  const [selected, setSelected] = useState(null)
  const { entries, loading, error } = useLeaderboard(100)

  const minKey = period === 'weekly' ? 'weeklyMin' : 'monthlyMin'
  const treesKey = period === 'weekly' ? 'weeklyTrees' : 'monthlyTrees'
  const forestKey = period === 'weekly' ? 'weeklyForest' : 'monthlyForest'

  const ranked = useMemo(
    () => [...entries].sort((a, b) => (Number(b[minKey]) || 0) - (Number(a[minKey]) || 0)),
    [entries, minKey],
  )

  const PeriodToggle = (
    <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/40 p-1">
      {['weekly', 'monthly'].map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => setPeriod(p)}
          className={cn(
            'rounded-full px-3.5 py-1 text-xs font-semibold capitalize transition-all',
            period === p ? 'bg-emerald-500/25 text-emerald-200 shadow-glow-sm' : 'text-white/60 hover:text-white',
          )}
        >
          {p}
        </button>
      ))}
    </div>
  )

  // ── Detail: a single forester's forest snapshot ──
  if (selected) {
    const items = snapshotToItems(selected[forestKey])
    const isMe = selected.id === uid
    return (
      <motion.div
        key="lb-detail"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="flex w-full max-w-3xl flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <Avatar entry={selected} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {selected.displayName || 'Explorer'}
              {isMe && <span className="ml-1.5 text-[10px] font-semibold text-emerald-300">(You)</span>}
            </p>
            <p className="text-[11px] text-white/55 capitalize">{period} forest</p>
          </div>
          <div className="ml-auto">{PeriodToggle}</div>
        </div>

        <ForestTerrain
          items={items}
          maxCells={120}
          minHeightClass="min-h-[300px] sm:min-h-[46vh]"
          className="rounded-3xl"
          emptyState={
            <>
              <Sprout className="h-9 w-9 text-emerald-400" />
              <p className="text-sm font-semibold text-white/80">No plants this {period} yet.</p>
            </>
          }
        />

        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75">
            <Clock className="mr-1.5 inline h-3.5 w-3.5 text-sky-400" />
            {formatMin(selected[minKey])} focused
          </span>
          <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75">
            <TreePine className="mr-1.5 inline h-3.5 w-3.5 text-emerald-400" />
            {selected[treesKey] || 0} trees
          </span>
          <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75">
            <Flame className="mr-1.5 inline h-3.5 w-3.5 text-amber-400" />
            {selected.currentStreak || 0}d streak
          </span>
        </div>
      </motion.div>
    )
  }

  // ── List ──
  return (
    <motion.div
      key="lb-list"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex w-full max-w-2xl flex-col gap-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
          <Trophy className="h-3.5 w-3.5 text-amber-300" />
          Forest Leaderboard
        </div>
        <div className="ml-auto">{PeriodToggle}</div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/40 p-2 backdrop-blur-xl">
        {error ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Users className="h-8 w-8 text-white/30" />
            <p className="text-sm font-semibold text-white/80">The leaderboard is warming up.</p>
            <p className="max-w-sm text-xs text-white/50">
              It becomes available once the public leaderboard access rule is deployed.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : ranked.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Sprout className="h-8 w-8 text-emerald-400" />
            <p className="text-sm font-semibold text-white/80">No foresters on the board yet.</p>
            <p className="text-xs text-white/50">Finish a focus session — be the first to plant a public forest.</p>
          </div>
        ) : (
          <ul className="flex max-h-[52vh] flex-col gap-1 overflow-y-auto pr-1">
            {ranked.map((e, i) => {
              const isMe = e.id === uid
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(e)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all',
                      isMe
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-transparent bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]',
                    )}
                  >
                    <span
                      className={cn(
                        'w-6 shrink-0 text-center text-sm font-bold tabular-nums',
                        RANK_STYLES[i] || 'text-white/40',
                      )}
                    >
                      {i + 1}
                    </span>
                    <Avatar entry={e} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {e.displayName || 'Explorer'}
                        {isMe && <span className="ml-1.5 text-[10px] font-semibold text-emerald-300">(You)</span>}
                      </p>
                      <p className="flex items-center gap-2 text-[11px] text-white/55">
                        <span className="inline-flex items-center gap-1">
                          <TreePine className="h-3 w-3 text-emerald-400" />
                          {e[treesKey] || 0}
                        </span>
                        {(e.currentStreak || 0) > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Flame className="h-3 w-3 text-amber-400" />
                            {e.currentStreak}d
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-sm font-bold text-emerald-300 tabular-nums">
                      {formatMin(e[minKey])}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="text-center text-[10px] uppercase tracking-wider text-white/40">
        {optedOut ? (
          <>You're hidden from the board · enable in Settings → Privacy</>
        ) : (
          <>Your forest is public · manage in Settings → Privacy</>
        )}
      </p>
    </motion.div>
  )
}
