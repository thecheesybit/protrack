import { memo, useMemo, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, TreePine } from 'lucide-react'
import { ymd } from '@/lib/dates'
import { cn } from '@/utils/cn'
import { ForestTerrain, sessionsToForestItems } from './ForestTerrain'

export { SpriteTree, SpriteFoliage, getSessionFoliageSeed, formatFloraBreakdown } from './ForestSprites'

function toDate(ts) {
  if (!ts) return null
  try {
    if (typeof ts.toDate === 'function') return ts.toDate()
    const d = new Date(ts)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/**
 * Handcrafted vector Oak Tree with organic wooden trunk, branch fork,
 * and layered lush foliage canopy matching the user's hand-drawn sketch.
 */
export const IllustratedOak = memo(function IllustratedOak({
  height = 92,
  width = 64,
  className,
  delay = 0,
}) {
  return (
    <motion.svg
      width={width}
      height={height}
      viewBox="0 0 64 96"
      fill="none"
      initial={{ scale: 0, y: 16, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay,
      }}
      className={cn('shrink-0 drop-shadow-md origin-bottom select-none', className)}
    >
      <defs>
        {/* Trunk Wood Gradient */}
        <linearGradient id="oak-trunk-grad" x1="28" y1="40" x2="36" y2="94" gradientUnits="userSpaceOnUse">
          <stop stopColor="#854d0e" />
          <stop offset="0.6" stopColor="#713f12" />
          <stop offset="1" stopColor="#451a03" />
        </linearGradient>

        {/* Canopy Layer 1 (Dark depth) */}
        <linearGradient id="oak-leaf-dark" x1="32" y1="12" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#047857" />
          <stop offset="1" stopColor="#064e3b" />
        </linearGradient>

        {/* Canopy Layer 2 (Lush green) */}
        <linearGradient id="oak-leaf-mid" x1="32" y1="6" x2="32" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>

        {/* Canopy Layer 3 (Sunlit highlights) */}
        <linearGradient id="oak-leaf-light" x1="24" y1="4" x2="40" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* ── Roots & Base Flare ── */}
      <path
        d="M24 94C27 92 29 88 30 82L34 82C35 88 37 92 40 94C35 95 29 95 24 94Z"
        fill="#451a03"
      />

      {/* ── Organic Trunk & Branches ── */}
      <path
        d="M30 82C29 68 28 58 24 48C23 45 20 43 18 41C19 40 22 41 26 45C28 47 30 52 31 56C32 50 34 44 38 39C40 37 43 36 45 35C44 37 41 39 39 42C35 48 34 58 34 82Z"
        fill="url(#oak-trunk-grad)"
      />

      {/* Bark texture grooves */}
      <path d="M31 76C30.5 68 30 62 29 55" stroke="#451a03" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <path d="M33 78C33.5 70 34 64 35 58" stroke="#451a03" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />

      {/* ── Layered Foliage Canopy ── */}
      {/* Back shadows */}
      <path
        d="M22 56C14 55 10 47 12 40C10 33 15 25 23 25C26 18 34 16 40 20C47 18 53 23 54 30C58 36 56 45 49 50C48 56 40 58 34 57C29 58 25 58 22 56Z"
        fill="url(#oak-leaf-dark)"
        opacity="0.85"
      />

      {/* Main Mid-tones */}
      <path
        d="M20 50C13 49 10 42 12 36C10 29 15 22 22 22C25 15 33 13 39 17C46 15 52 20 53 27C57 33 55 42 48 46C46 51 38 53 32 52C27 52 23 52 20 50Z"
        fill="url(#oak-leaf-mid)"
      />

      {/* Sunlit Crown & Fluffy Volumes */}
      <circle cx="32" cy="24" r="14" fill="url(#oak-leaf-light)" opacity="0.75" />
      <circle cx="22" cy="34" r="10" fill="url(#oak-leaf-light)" opacity="0.6" />
      <circle cx="42" cy="33" r="10.5" fill="url(#oak-leaf-light)" opacity="0.65" />
      <circle cx="33" cy="17" r="9" fill="#6ee7b7" opacity="0.45" />

      {/* Soft highlight dots */}
      <circle cx="28" cy="18" r="2" fill="#ecfdf5" opacity="0.6" />
      <circle cx="37" cy="22" r="1.5" fill="#ecfdf5" opacity="0.5" />
      <circle cx="20" cy="31" r="1.5" fill="#ecfdf5" opacity="0.5" />
    </motion.svg>
  )
})

/**
 * Handcrafted vector Pine Tree (Evergreen Conifer).
 */
export const IllustratedPine = memo(function IllustratedPine({
  height = 96,
  width = 54,
  className,
  delay = 0,
}) {
  return (
    <motion.svg
      width={width}
      height={height}
      viewBox="0 0 54 96"
      fill="none"
      initial={{ scale: 0, y: 16, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 280,
        damping: 20,
        delay,
      }}
      className={cn('shrink-0 drop-shadow-md origin-bottom select-none', className)}
    >
      <defs>
        <linearGradient id="pine-trunk-grad" x1="25" y1="50" x2="29" y2="94" gradientUnits="userSpaceOnUse">
          <stop stopColor="#78350f" />
          <stop offset="1" stopColor="#451a03" />
        </linearGradient>
        <linearGradient id="pine-tier-1" x1="27" y1="8" x2="27" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="pine-tier-2" x1="27" y1="26" x2="27" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#064e3b" />
        </linearGradient>
        <linearGradient id="pine-tier-3" x1="27" y1="44" x2="27" y2="72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#047857" />
          <stop offset="1" stopColor="#022c22" />
        </linearGradient>
      </defs>

      {/* Trunk */}
      <path d="M25 66H29V94H25Z" fill="url(#pine-trunk-grad)" />
      <path d="M23 94C25 92 26 89 27 86C28 89 29 92 31 94Z" fill="#451a03" />

      {/* Bottom Tier 3 */}
      <path
        d="M10 70C15 63 20 64 27 64C34 64 39 63 44 70C40 60 36 53 32 47L27 49L22 47C18 53 14 60 10 70Z"
        fill="url(#pine-tier-3)"
      />

      {/* Middle Tier 2 */}
      <path
        d="M14 52C18 46 22 47 27 47C32 47 36 46 40 52C37 43 33 37 30 31L27 33L24 31C21 37 17 43 14 52Z"
        fill="url(#pine-tier-2)"
      />

      {/* Top Tier 1 */}
      <path
        d="M18 34C21 29 24 30 27 30C30 30 33 29 36 34C33 24 30 16 27 8C24 16 21 24 18 34Z"
        fill="url(#pine-tier-1)"
      />

      {/* Highlight tips */}
      <path d="M27 8L29 14L27 16L25 14Z" fill="#a7f3d0" opacity="0.6" />
      <path d="M21 32C24 30 27 30 30 32" stroke="#a7f3d0" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <path d="M17 50C22 47 28 47 34 50" stroke="#a7f3d0" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
    </motion.svg>
  )
})

/**
 * Handcrafted vector Flowering Blossom Tree.
 */
export const IllustratedBlossom = memo(function IllustratedBlossom({
  height = 90,
  width = 62,
  className,
  delay = 0,
}) {
  return (
    <motion.svg
      width={width}
      height={height}
      viewBox="0 0 62 90"
      fill="none"
      initial={{ scale: 0, y: 16, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay,
      }}
      className={cn('shrink-0 drop-shadow-md origin-bottom select-none', className)}
    >
      <defs>
        <linearGradient id="blossom-trunk-grad" x1="29" y1="40" x2="33" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6b3410" />
          <stop offset="1" stopColor="#381a04" />
        </linearGradient>
        <linearGradient id="blossom-petal-1" x1="31" y1="10" x2="31" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f472b6" />
          <stop offset="1" stopColor="#db2777" />
        </linearGradient>
        <linearGradient id="blossom-petal-2" x1="31" y1="6" x2="31" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbcfe8" />
          <stop offset="1" stopColor="#f472b6" />
        </linearGradient>
      </defs>

      {/* Trunk with twisting branches */}
      <path
        d="M28 88C29 74 27 62 23 52C20 48 16 46 13 45C16 44 20 46 24 49C26 52 28 58 29 62C30 56 33 48 39 42C43 38 47 37 50 36C47 38 43 40 40 44C35 50 34 62 33 88Z"
        fill="url(#blossom-trunk-grad)"
      />

      {/* Blossom Cloud Canopy */}
      <circle cx="31" cy="28" r="16" fill="url(#blossom-petal-1)" opacity="0.9" />
      <circle cx="20" cy="36" r="11" fill="url(#blossom-petal-1)" opacity="0.85" />
      <circle cx="43" cy="35" r="11.5" fill="url(#blossom-petal-1)" opacity="0.85" />
      <circle cx="31" cy="20" r="11" fill="url(#blossom-petal-2)" />
      <circle cx="23" cy="26" r="8" fill="url(#blossom-petal-2)" opacity="0.9" />
      <circle cx="39" cy="25" r="8" fill="url(#blossom-petal-2)" opacity="0.9" />

      {/* Delicate Flower Petal Details */}
      <circle cx="26" cy="18" r="2.2" fill="#fff" opacity="0.8" />
      <circle cx="37" cy="19" r="1.8" fill="#fff" opacity="0.7" />
      <circle cx="31" cy="30" r="2" fill="#fff" opacity="0.75" />
      <circle cx="17" cy="34" r="1.5" fill="#fdf2f8" opacity="0.8" />
      <circle cx="45" cy="32" r="1.5" fill="#fdf2f8" opacity="0.8" />
    </motion.svg>
  )
})

/**
 * Handcrafted vector Foliage Bush / Shrub (matching the user's sketch).
 */
export const IllustratedBush = memo(function IllustratedBush({
  width = 46,
  height = 28,
  className,
  delay = 0,
}) {
  return (
    <motion.svg
      width={width}
      height={height}
      viewBox="0 0 46 28"
      fill="none"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 22,
        delay,
      }}
      className={cn('shrink-0 drop-shadow-sm origin-bottom select-none', className)}
    >
      <defs>
        <linearGradient id="bush-grad-dark" x1="23" y1="6" x2="23" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#064e3b" />
        </linearGradient>
        <linearGradient id="bush-grad-light" x1="23" y1="2" x2="23" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* Main clustered lobes */}
      <path
        d="M6 28C3 25 2 20 5 16C3 12 7 8 12 9C15 5 21 4 25 7C29 4 36 6 38 11C43 11 46 16 44 21C46 25 43 28 39 28Z"
        fill="url(#bush-grad-dark)"
      />
      {/* Front sunlit lobes */}
      <circle cx="15" cy="16" r="8" fill="url(#bush-grad-light)" />
      <circle cx="26" cy="14" r="9" fill="url(#bush-grad-light)" />
      <circle cx="35" cy="17" r="7.5" fill="url(#bush-grad-light)" />
      <circle cx="8" cy="20" r="5.5" fill="url(#bush-grad-light)" opacity="0.9" />

      {/* Leaf highlight accents */}
      <circle cx="23" cy="11" r="1.5" fill="#ecfdf5" opacity="0.7" />
      <circle cx="32" cy="14" r="1.2" fill="#ecfdf5" opacity="0.6" />
      <circle cx="14" cy="14" r="1.2" fill="#ecfdf5" opacity="0.6" />
    </motion.svg>
  )
})

/**
 * Resolves the botanical type for a session:
 * - Under 10 minutes: flower
 * - 10 to 15 minutes: shrub
 * - 15+ minutes: tree
 */
export function getPlantType(s) {
  if (s?.plantType && ['flower', 'shrub', 'tree'].includes(s.plantType)) {
    return s.plantType
  }
  const dur = Number(s?.durationMin) || 25
  if (dur < 10) return 'flower'
  if (dur <= 15) return 'shrub'
  return 'tree'
}

/**
 * Helper to build rich, informative tooltips for planted focus foliage.
 */
export function getTreeTooltip(s, idx, total) {
  const dur = s.durationMin || 25
  const plantType = getPlantType(s)
  const plantLabel = plantType === 'flower' ? 'Flower' : plantType === 'shrub' ? 'Shrub' : 'Tree'
  const title = `${dur}m ${dur >= 50 ? 'Deep Focus' : 'Focus'}`
  const d = toDate(s.startedAt || s.createdAt)
  const timeStr = d && !isNaN(d.getTime())
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null
  const label = s.label || s.title || (s.modeId ? `${s.modeId} session` : null)
  let detail = label
    ? `${label} · ${plantLabel} ${idx + 1} of ${total}`
    : `${plantLabel} ${idx + 1} of ${total}`
  if (timeStr) {
    detail += ` (${timeStr})`
  }
  return { title, detail }
}

/**
 * Filter completed & successful sessions for a specific day, ordered chronologically.
 */
export function filterSuccessfulSessions(sessions = [], dateStr) {
  return (sessions || [])
    .filter((s) => {
      if (s.completed === false) return false
      if (s.failedReason) return false
      if (s.durationMin !== undefined && s.durationMin <= 0) return false
      const rawTs = s.startedAt || s.createdAt
      const d = toDate(rawTs)
      return d && !isNaN(d.getTime()) && ymd(d) === dateStr
    })
    .sort((a, b) => {
      const ta = toDate(a.startedAt || a.createdAt)?.getTime() || 0
      const tb = toDate(b.startedAt || b.createdAt)?.getTime() || 0
      return ta - tb
    })
}

/**
 * Renders the organic forest grove for a single calendar day column,
 * placed directly at the bottom baseline of the calendar grid.
 *
 * Interactivity:
 * - Magnifies smoothly on hover (scale 1.65x with spring physics) so trees,
 *   foliage, and stratified soil are clearly visible.
 * - Displays an Executive Status Briefing card rather than micro ball-by-ball commentary.
 */
export function DayGrove({
  sessions = [],
  dateStr,
  dayIndex = 0,
  isToday = false,
  className,
  variant = 'compact',
}) {
  const [isHovered, setIsHovered] = useState(false)
  const hoverTimerRef = useRef(null)

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 120) // 120ms hysteresis prevents edge flutter
  }

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    }
  }, [])

  const daySessions = useMemo(() => filterSuccessfulSessions(sessions, dateStr), [sessions, dateStr])
  const items = useMemo(() => sessionsToForestItems(daySessions), [daySessions])
  const count = items.length

  const executiveMetrics = useMemo(() => {
    const totalMinutes = daySessions.reduce((sum, s) => sum + (Number(s.durationMin) || 0), 0)
    const hours = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    const timeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

    let trees = 0
    let shrubs = 0
    let flowers = 0
    for (const item of items) {
      if (item.type === 'tree') trees++
      else if (item.type === 'shrub') shrubs++
      else if (item.type === 'flower') flowers++
    }

    let rank
    if (totalMinutes >= 180) {
      rank = { tierName: 'Peak Canopy', badgeColor: '#10b981', tagline: 'Mastery tier daily focus' }
    } else if (totalMinutes >= 120) {
      rank = { tierName: 'Thriving Grove', badgeColor: '#34d399', tagline: 'Deep consistent flow state' }
    } else if (totalMinutes >= 60) {
      rank = { tierName: 'Woodland', badgeColor: '#38bdf8', tagline: 'Solid structured daily progress' }
    } else if (totalMinutes >= 25) {
      rank = { tierName: 'Pioneer Saplings', badgeColor: '#fbbf24', tagline: 'Good foundation established' }
    } else {
      rank = { tierName: 'Early Roots', badgeColor: '#a78bfa', tagline: 'Daily habit initiated' }
    }

    const longest = [...daySessions].sort((a, b) => (Number(b.durationMin) || 0) - (Number(a.durationMin) || 0))[0]
    const longestDur = Number(longest?.durationMin) || 0
    const longestLabel = longest?.label || longest?.title || null

    let takeaway
    if (longestDur >= 40 && longestLabel) {
      takeaway = `Longest sprint: ${longestDur}m on ${longestLabel}.`
    } else {
      takeaway = `${count} completed session${count > 1 ? 's' : ''} powering today's grove.`
    }

    let dateLabel = dateStr || ''
    try {
      if (dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number)
        const dObj = new Date(y, m - 1, d)
        dateLabel = dObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      }
    } catch {
      dateLabel = dateStr || ''
    }

    return {
      totalMin: totalMinutes,
      timeFormatted,
      floraCounts: { trees, shrubs, flowers },
      rank,
      takeaway,
      dateLabel,
    }
  }, [daySessions, items, count, dateStr])

  // Large Hero Variant for Single-Day Timetable Agenda
  if (variant === 'hero') {
    if (count === 0) {
      return (
        <div
          className={cn(
            'relative w-full rounded-2xl border border-emerald-500/20 bg-slate-950/60 backdrop-blur-md shadow-glass overflow-hidden flex flex-col select-none',
            className,
          )}
        >
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-2">
              <TreePine className="h-4 w-4 text-emerald-400/60" />
              <h4 className="text-xs font-bold text-white/80 tracking-tight">
                {executiveMetrics?.dateLabel || dateStr}'s Forest Grove
              </h4>
              {isToday && (
                <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-400">
                  TODAY
                </span>
              )}
            </div>
            <span className="text-[10px] text-white/40 font-mono">Pristine Ground</span>
          </div>
          <div className="relative h-[260px] sm:h-[300px] w-full flex flex-col items-center justify-center p-6 text-center">
            <ForestTerrain
              items={[]}
              compact={false}
              isHex={false}
              showWildlife={false}
              minHeightClass="h-full w-full"
              className="h-full w-full rounded-none border-0 bg-transparent"
              emptyState={
                <div className="flex flex-col items-center gap-2">
                  <TreePine className="h-8 w-8 text-emerald-500/40" />
                  <p className="text-xs font-semibold text-white/80">No specimens rooted yet for this day</p>
                  <p className="text-[11px] text-white/45 max-w-xs">
                    Complete a focus session to cultivate a flourishing grove of trees, shrubs, and flowers.
                  </p>
                </div>
              }
            />
          </div>
        </div>
      )
    }

    return (
      <div
        className={cn(
          'relative w-full rounded-2xl border border-emerald-500/25 bg-slate-950/80 backdrop-blur-md shadow-glass overflow-hidden flex flex-col select-none',
          className,
        )}
      >
        {/* Hero Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-black/50">
          <div className="flex items-center gap-2">
            <TreePine className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white tracking-tight">
              {executiveMetrics.dateLabel}'s Forest Grove
            </h4>
            {isToday && (
              <span className="rounded-full bg-emerald-500/25 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-400">
                TODAY
              </span>
            )}
            {executiveMetrics.rank && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold shadow-sm"
                style={{
                  backgroundColor: `${executiveMetrics.rank.badgeColor}22`,
                  color: executiveMetrics.rank.badgeColor,
                  border: `1px solid ${executiveMetrics.rank.badgeColor}44`,
                }}
              >
                {executiveMetrics.rank.tierName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono font-bold text-white/95">
              {executiveMetrics.timeFormatted}
            </span>
            <span className="text-[11px] font-mono text-emerald-300">
              {executiveMetrics.floraCounts.trees} 🌲 · {executiveMetrics.floraCounts.shrubs} 🌿 · {executiveMetrics.floraCounts.flowers} 🌸
            </span>
          </div>
        </div>

        {/* Large Rotatable 2.5D Isometric Diorama Canvas */}
        <div className="relative h-[290px] sm:h-[330px] w-full">
          <ForestTerrain
            items={items}
            compact={false}
            isHex={false}
            showWildlife={true}
            disableTooltips={false}
            minHeightClass="h-full w-full"
            className="h-full w-full rounded-none border-0"
          />
        </div>

        {/* Executive Takeaway Footer */}
        <div className="px-3.5 py-2 bg-black/40 border-t border-white/5 flex items-center justify-between text-[10px] text-white/65">
          <span className="italic truncate max-w-[70%]">"{executiveMetrics.takeaway}"</span>
          <span className="text-[9px] text-white/40 uppercase tracking-wider shrink-0 font-medium">
            Drag to rotate 360° · Scroll to zoom
          </span>
        </div>
      </div>
    )
  }

  // Default Compact Variant (For Week Calendar Columns)
  if (count === 0 || !executiveMetrics) {
    return null
  }

  // Prevent horizontal clipping on outer columns (Monday or Sunday)
  const popupAlignClass =
    dayIndex === 0
      ? 'left-0 translate-x-0'
      : dayIndex === 6
      ? 'right-0 translate-x-0'
      : 'left-1/2 -translate-x-1/2'

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'pointer-events-auto absolute inset-x-0 bottom-0 flex w-full flex-col items-center justify-end overflow-visible select-none',
        isHovered ? 'z-[70]' : 'z-20',
        className,
      )}
      style={{ height: '74px' }}
    >
      {/* Expanded invisible hit-test canopy area when hovered to prevent mouseleave boundary jitter */}
      {isHovered && (
        <div
          className="absolute -top-24 inset-x-0 bottom-0 pointer-events-auto z-0"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}

      {/* ── Scaled-Up Interactive Diorama on Hover (Silky 60FPS Hardware Accelerated) ── */}
      <motion.div
        animate={{
          scale: isHovered ? 1.6 : 1,
          y: isHovered ? -14 : 0,
        }}
        transition={{
          duration: 0.24,
          ease: [0.16, 1, 0.3, 1], // Fluid deceleration curve: zero oscillation, zero jitter, instantaneous response
        }}
        style={{
          willChange: 'transform',
          filter: isHovered ? 'drop-shadow(0 12px 24px rgba(0,0,0,0.85))' : 'none',
          transition: 'filter 0.22s ease',
        }}
        className="origin-bottom cursor-pointer relative flex flex-col items-center justify-end w-full h-full transform-gpu"
      >
        <ForestTerrain
          items={items}
          compact={true}
          disableTooltips={true}
          showWildlife={false}
          minHeightClass="h-full w-full"
        />
      </motion.div>

      {/* ── Executive Status Briefing Card (No Ball-by-Ball Commentary) ── */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={cn(
              'pointer-events-none absolute bottom-[104px] z-[80] w-[260px] select-none rounded-2xl border border-emerald-500/35 bg-slate-950/95 p-3 text-white shadow-[0_20px_48px_rgba(0,0,0,0.95)] backdrop-blur-2xl',
              popupAlignClass,
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-white tracking-tight">{executiveMetrics.dateLabel}</h4>
                  {isToday && (
                    <span className="rounded-full bg-emerald-500/25 px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-400">
                      TODAY
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-white/50">{executiveMetrics.rank?.tagline}</p>
              </div>
              {executiveMetrics.rank && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm shrink-0"
                  style={{
                    backgroundColor: `${executiveMetrics.rank.badgeColor}22`,
                    color: executiveMetrics.rank.badgeColor,
                    border: `1px solid ${executiveMetrics.rank.badgeColor}44`,
                  }}
                >
                  {executiveMetrics.rank.tierName}
                </span>
              )}
            </div>

            {/* Executive KPI Row */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="rounded-xl border border-white/5 bg-white/[0.04] p-2">
                <div className="flex items-center gap-1 text-[9.5px] text-white/50">
                  <Clock className="h-3 w-3 text-sky-400" />
                  <span>Total Focus</span>
                </div>
                <div className="text-sm font-extrabold text-white mt-0.5 tracking-tight font-mono">
                  {executiveMetrics.timeFormatted}
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.04] p-2">
                <div className="flex items-center gap-1 text-[9.5px] text-white/50">
                  <TreePine className="h-3 w-3 text-emerald-400" />
                  <span>Canopy Grown</span>
                </div>
                <div className="text-sm font-extrabold text-emerald-300 mt-0.5 tracking-tight font-mono">
                  {count} {count === 1 ? 'Plant' : 'Plants'}
                </div>
              </div>
            </div>

            {/* Flora Breakdown & Executive Takeaway */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10px]">
                <span className="text-emerald-300/80 font-medium">Flora Breakdown</span>
                <span className="font-bold text-emerald-300 font-mono">
                  {executiveMetrics.floraCounts.trees} 🌲 · {executiveMetrics.floraCounts.shrubs} 🌿 · {executiveMetrics.floraCounts.flowers} 🌸
                </span>
              </div>

              {executiveMetrics.takeaway && (
                <p className="text-[10px] leading-relaxed text-white/70 italic px-0.5">
                  "{executiveMetrics.takeaway}"
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
