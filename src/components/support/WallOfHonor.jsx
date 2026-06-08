import { useState } from 'react'
import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'
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
    <motion.div layout className="columns-1 gap-3.5 sm:columns-2 [&>*]:mb-3.5">
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
            className="block w-full break-inside-avoid rounded-2xl border border-line bg-surface-2/15 p-4 text-left transition-all duration-200 hover:bg-surface-2/30 hover:border-accent/30 hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/15 text-xs font-bold text-accent">
                {p.name?.[0] || '?'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-ink tracking-wide">{p.name}</div>
                <div className="text-[10px] font-bold text-muted/70 uppercase tracking-wider mt-0.5">{regionLabel(p.region)}</div>
              </div>
              <span className="shrink-0 rounded-lg bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
                {amountLabel(p)}
              </span>
            </div>

            <p className={`mt-2.5 text-xs leading-relaxed text-muted font-medium ${open ? '' : 'line-clamp-2'}`}>
              <Quote className="mr-1.5 inline h-3 w-3 text-muted/40 fill-muted/10" />
              {p.testimony}
            </p>

            {open && p.featureRequest && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2.5 rounded-xl bg-accent/10 border border-accent/15 px-3 py-2 text-[11px] font-medium text-accent leading-relaxed"
              >
                Wants next: {p.featureRequest}
              </motion.div>
            )}
          </motion.button>
        )
      })}
    </motion.div>
  )
}
