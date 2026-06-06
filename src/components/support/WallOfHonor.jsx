import { useState } from 'react'
import { motion } from 'framer-motion'
import { Quote, Sparkles } from 'lucide-react'
import { useWall } from '@/hooks/useWall'

function amountLabel(p) {
  return p.currency === 'USD' ? `$${p.amount}` : `₹${p.amount}`
}

function regionLabel(region) {
  return region === 'US' ? 'USA' : 'India'
}

/**
 * The global Wall of Honor. Cards are compact by default (anti-clutter); click
 * one to morph it open (Framer layout) revealing the full story + feature
 * request, while neighbours gracefully dim. Live verified patrons are merged
 * with the local seed set.
 */
export function WallOfHonor() {
  const entries = useWall()
  const [openId, setOpenId] = useState(null)

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-accent" /> Wall of Honor
        <span className="ml-auto text-xs font-normal text-muted">{entries.length} supporters</span>
      </div>

      <motion.div layout className="columns-1 gap-3 sm:columns-2 [&>*]:mb-3">
        {entries.map((p) => {
          const open = openId === p.id
          const dimmed = openId && !open
          return (
            <motion.button
              key={p.id}
              layout
              type="button"
              onClick={() => setOpenId(open ? null : p.id)}
              animate={{ opacity: dimmed ? 0.4 : 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="block w-full break-inside-avoid rounded-2xl border border-line/60 bg-surface-2/30 p-3.5 text-left transition-colors hover:border-accent/40"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                  {p.name?.[0] || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="text-[11px] text-muted">{regionLabel(p.region)}</div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                  {amountLabel(p)}
                </span>
              </div>

              <p className={`mt-2 text-xs leading-relaxed text-muted ${open ? '' : 'line-clamp-2'}`}>
                <Quote className="mr-1 inline h-3 w-3 text-muted/60" />
                {p.testimony}
              </p>

              {open && p.featureRequest && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 rounded-lg bg-accent/10 px-2.5 py-1.5 text-[11px] text-accent"
                >
                  Wants next: {p.featureRequest}
                </motion.p>
              )}
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}
