import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

/**
 * Shared KPI stat card (DESIGN_SYSTEM.md §5).
 *
 *  - `compact` (default): inline row for grid widgets — icon chip, Fraunces
 *    number, muted label.
 *  - `hero`: full-bleed category gradient with a large ghosted icon and a
 *    hover lift. For maximized/hero layouts only — shadows stay off flat
 *    inline elements per the elevation rule.
 *
 * @param {{
 *  icon: import('react').ReactNode,
 *  label: string,
 *  value: import('react').ReactNode,
 *  variant?: 'compact'|'hero',
 *  tone?: 'sky'|'violet'|'rose'|'amber',
 * }} props
 */
export function StatCard({ icon, label, value, variant = 'compact', tone = 'sky' }) {
  if (variant === 'hero') {
    return (
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
        className={cn(
          'relative flex min-h-[4.75rem] sm:min-h-[5.25rem] flex-col justify-between overflow-hidden rounded-2xl p-3 sm:p-3.5 text-white shadow-premium-sm transition-all hover:shadow-premium-md',
          HERO_TONES[tone] || HERO_TONES.sky,
        )}
      >
        <span className="pointer-events-none absolute -right-2 -top-2 opacity-25 [&>svg]:h-14 [&>svg]:w-14 sm:[&>svg]:h-16 sm:[&>svg]:w-16">
          {icon}
        </span>
        <span className="font-mono text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.1em] text-white/80">
          {label}
        </span>
        <span className="font-display text-2xl sm:text-3xl font-semibold leading-none tracking-tight">
          {value}
        </span>
      </motion.div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line/50 bg-surface-2/30 px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="font-display text-lg font-semibold leading-none tracking-tight">{value}</div>
        <div className="truncate text-[11px] text-muted">{label}</div>
      </div>
    </div>
  )
}

const HERO_TONES = {
  sky: 'bg-gradient-to-br from-sky-500 to-teal-500',
  violet: 'bg-gradient-to-br from-violet-600 to-indigo-500',
  rose: 'bg-gradient-to-br from-rose-500 to-amber-500',
  amber: 'bg-gradient-to-br from-amber-500 to-orange-600',
}
