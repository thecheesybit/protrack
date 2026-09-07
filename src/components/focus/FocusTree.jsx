import { memo } from 'react'
import { motion } from 'framer-motion'
import { ymd } from '@/lib/dates'
import { cn } from '@/utils/cn'

function toDate(ts) {
  if (!ts) return null
  if (typeof ts.toDate === 'function') return ts.toDate()
  return new Date(ts)
}

/**
 * High-quality SVG trees planted per completed focus session.
 */
export const FocusTree = memo(function FocusTree({
  variant = 'pine',
  durationMin = 25,
  size = 28,
  className,
  title,
}) {
  // Tree variety based on index or duration
  const v = variant || (durationMin >= 45 ? 'oak' : durationMin >= 25 ? 'pine' : 'sapling')

  if (v === 'oak') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={cn('shrink-0 drop-shadow-sm transition-transform hover:scale-125 cursor-pointer', className)}
      >
        <title>{title || `Oak Tree · ${durationMin}m Focus`}</title>
        {/* Trunk */}
        <path d="M14.5 22H17.5V30H14.5Z" fill="#78350f" rx="1" />
        <path d="M13 29C14 28 15 28 16 30C17 28 18 28 19 29" stroke="#542307" strokeWidth="1.2" strokeLinecap="round" />
        {/* Foliage */}
        <circle cx="16" cy="13" r="8.5" fill="url(#oak-grad-1)" />
        <circle cx="11.5" cy="15.5" r="5.5" fill="url(#oak-grad-2)" />
        <circle cx="20.5" cy="15.5" r="5.5" fill="url(#oak-grad-3)" />
        <circle cx="16" cy="9.5" r="5" fill="#34d399" opacity="0.4" />
        {/* Highlights */}
        <circle cx="13.5" cy="11.5" r="1.5" fill="#a7f3d0" opacity="0.6" />
        <circle cx="18.5" cy="11.5" r="1.5" fill="#a7f3d0" opacity="0.6" />
        <defs>
          <linearGradient id="oak-grad-1" x1="16" y1="4.5" x2="16" y2="21.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10b981" />
            <stop offset="1" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="oak-grad-2" x1="11.5" y1="10" x2="11.5" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#059669" />
            <stop offset="1" stopColor="#064e3b" />
          </linearGradient>
          <linearGradient id="oak-grad-3" x1="20.5" y1="10" x2="20.5" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10b981" />
            <stop offset="1" stopColor="#065f46" />
          </linearGradient>
        </defs>
      </svg>
    )
  }

  if (v === 'sapling') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={cn('shrink-0 drop-shadow-sm transition-transform hover:scale-125 cursor-pointer', className)}
      >
        <title>{title || `Sapling · ${durationMin}m Focus`}</title>
        {/* Stem */}
        <path d="M16 30V18C16 14 18 11 20 9" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" />
        {/* Leaves */}
        <path
          d="M20 9C17 9 14 12 15 15C18 16 21 14 20 9Z"
          fill="url(#sapling-grad-1)"
        />
        <path
          d="M16 18C12 17 10 14 11 11C14 10 17 13 16 18Z"
          fill="url(#sapling-grad-2)"
        />
        <defs>
          <linearGradient id="sapling-grad-1" x1="15" y1="9" x2="20" y2="15" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34d399" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="sapling-grad-2" x1="11" y1="11" x2="16" y2="18" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6ee7b7" />
            <stop offset="1" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
    )
  }

  // Default: Evergreen Pine Tree
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0 drop-shadow-sm transition-transform hover:scale-125 cursor-pointer', className)}
    >
      <title>{title || `Pine Tree · ${durationMin}m Focus`}</title>
      {/* Trunk */}
      <path d="M14.5 24H17.5V30H14.5Z" fill="#92400e" rx="0.8" />
      {/* Tier 3 (Bottom) */}
      <path d="M8 24C10 21 13 21 16 21C19 21 22 21 24 24L16 16L8 24Z" fill="url(#pine-grad-3)" />
      {/* Tier 2 (Middle) */}
      <path d="M10 18C12 16 14 16 16 16C18 16 20 16 22 18L16 10L10 18Z" fill="url(#pine-grad-2)" />
      {/* Tier 1 (Top) */}
      <path d="M12 12C13.5 10.5 15 10.5 16 10.5C17 10.5 18.5 10.5 20 12L16 4L12 12Z" fill="url(#pine-grad-1)" />
      {/* Snowy / light accent tips */}
      <circle cx="16" cy="5" r="1" fill="#ecfdf5" opacity="0.8" />
      <defs>
        <linearGradient id="pine-grad-1" x1="16" y1="4" x2="16" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="pine-grad-2" x1="16" y1="10" x2="16" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="pine-grad-3" x1="16" y1="16" x2="16" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#064e3b" />
        </linearGradient>
      </defs>
    </svg>
  )
})

/**
 * A horizontal row of planted trees representing completed focus sessions for a day.
 */
export function DayForestRow({
  sessions = [],
  dateStr,
  compact = false,
  className,
}) {
  const daySessions = sessions.filter((s) => {
    if (s.completed === false) return false
    const d = toDate(s.startedAt)
    return d && ymd(d) === dateStr
  })

  const totalMin = daySessions.reduce((acc, s) => acc + (s.durationMin || 0), 0)
  const count = daySessions.length

  const VARIANTS = ['pine', 'oak', 'pine', 'sapling', 'oak']

  return (
    <div
      className={cn(
        'group/forest relative flex items-center justify-center gap-1 border-t border-line/30 bg-surface-2/25 px-1 py-1 transition-colors hover:bg-surface-2/45',
        compact ? 'min-h-[26px]' : 'min-h-[34px]',
        className,
      )}
      title={
        count > 0
          ? `${count} tree${count > 1 ? 's' : ''} planted · ${totalMin} min focused`
          : 'No focus trees planted yet'
      }
    >
      {count === 0 ? (
        <div className="flex items-center gap-1 opacity-25">
          <span className="h-1 w-1 rounded-full bg-emerald-500/40" />
          <span className="h-0.5 w-6 rounded-full bg-line/60" />
          <span className="h-1 w-1 rounded-full bg-emerald-500/40" />
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-center gap-0.5">
          {daySessions.slice(0, 6).map((s, idx) => {
            const timeLabel = s.startedAt
              ? toDate(s.startedAt)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''
            return (
              <motion.div
                key={s.id || idx}
                initial={{ scale: 0, y: 4 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
              >
                <FocusTree
                  variant={VARIANTS[idx % VARIANTS.length]}
                  durationMin={s.durationMin || 25}
                  size={compact ? 18 : 24}
                  title={`🌲 ${s.durationMin || 25}m Focus session ${timeLabel ? `(${timeLabel})` : ''}`}
                />
              </motion.div>
            )
          })}
          {count > 6 && (
            <span className="ml-0.5 text-[9px] font-bold text-emerald-400">
              +{count - 6}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
