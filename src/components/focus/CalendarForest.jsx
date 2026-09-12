import { memo, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ymd } from '@/lib/dates'
import { cn } from '@/utils/cn'
import { SpriteFoliage, getSessionFoliageSeed } from './ForestSprites'

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
 * The number of planted trees dynamically matches the exact count of
 * successful focus sessions completed on that day.
 */
export function DayGrove({
  sessions = [],
  dateStr,
  dayIndex: _dayIndex,
  isToday: _isToday = false,
  className,
}) {
  const [hoveredTree, setHoveredTree] = useState(null)
  const [hoveredIdx, setHoveredIdx] = useState(null)

  // Filter completed & successful sessions for this specific day, ordered chronologically
  const daySessions = useMemo(() => {
    return filterSuccessfulSessions(sessions, dateStr)
  }, [sessions, dateStr])

  const count = daySessions.length
  const _totalMin = useMemo(
    () => daySessions.reduce((acc, s) => acc + (s.durationMin || 0), 0),
    [daySessions],
  )

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center justify-end overflow-visible select-none',
        count === 0 && 'min-h-0',
        className,
      )}
      style={{ minHeight: count === 0 ? 0 : 90 }}
    >
      {/* ── Hover Tooltip Card ────────────────────────────────────── */}
      <AnimatePresence>
        {hoveredTree && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: -4, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-1 z-50 pointer-events-none whitespace-nowrap rounded-xl border border-white/20 bg-slate-950/90 px-2.5 py-1.5 shadow-2xl backdrop-blur-xl text-center"
          >
            <p className="text-[11px] font-bold text-emerald-400 leading-tight">
              {hoveredTree.title}
            </p>
            <p className="text-[9px] text-white/70 mt-0.5">
              {hoveredTree.detail}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Raster focus trees — one per successful session, none on an empty day ── */}
      <div
        className="pointer-events-auto relative flex w-full items-end justify-center px-1 pb-1 transition-opacity duration-200"
        onMouseLeave={() => {
          setHoveredTree(null)
          setHoveredIdx(null)
        }}
      >
        {count === 0 ? (
          /* Empty day: nothing on the baseline (owner: no sapling placeholders). */
          null
        ) : count === 1 ? (
          /* 1 Session: Centered flower, shrub, or tree */
          (() => {
            const s = daySessions[0]
            const pType = getPlantType(s)
            const h = pType === 'flower' ? 34 : pType === 'shrub' ? 50 : (s.durationMin >= 45 ? 90 : 84)
            return (
              <div className="relative flex items-end justify-center">
                <div
                  className="z-10 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  onMouseEnter={() => setHoveredTree(getTreeTooltip(s, 0, 1))}
                  onMouseLeave={() => setHoveredTree(null)}
                >
                  <SpriteFoliage
                    type={pType}
                    species="all"
                    variant={getSessionFoliageSeed(s, 0)}
                    height={h}
                    delay={0.05}
                  />
                </div>
              </div>
            )
          })()
        ) : (
          /* 2+ Sessions: Thriving Grove where EVERY session has its own flower/shrub/tree */
          <div className="relative flex items-end justify-center overflow-visible">
            {daySessions.map((s, idx) => {
              const pType = getPlantType(s)
              const speciesList = ['oak', 'pine', 'blossom', 'palm']
              const species =
                (s.durationMin || 0) >= 60
                  ? idx % 2 === 0
                    ? 'oak'
                    : 'pine'
                  : speciesList[idx % speciesList.length]

              let h
              if (pType === 'flower') {
                const fFactors = [0.94, 1.06, 0.96, 1.08]
                h = Math.round(34 * fFactors[idx % fFactors.length])
              } else if (pType === 'shrub') {
                const sFactors = [0.94, 1.06, 0.92, 1.04]
                h = Math.round(50 * sFactors[idx % sFactors.length])
              } else {
                const baseTreeH = Math.max(64, Math.min(92, Math.round(92 - Math.min(count, 12) * 2.2)))
                const tFactors = [0.94, 1.06, 0.92, 1.04, 0.98]
                h = Math.round(baseTreeH * tFactors[idx % tFactors.length])
              }

              const approxWidth = pType === 'flower' ? 24 : pType === 'shrub' ? 36 : Math.round(h * 0.62)
              const targetGroveWidth = Math.min(132, Math.max(74, 48 + count * 14))
              const overlapPx =
                count > 1
                  ? Math.max(4, Math.min(approxWidth - 6, Math.round((approxWidth * count - targetGroveWidth) / (count - 1))))
                  : 0

              const isBack = pType === 'tree' ? idx % 2 === 1 : false
              const baseZ =
                pType === 'flower'
                  ? 24 + (idx % 4)
                  : pType === 'shrub'
                  ? 18 + (idx % 4)
                  : isBack ? 10 + (idx % 3) : 14 + (idx % 3)

              return (
                <div
                  key={s.id || `${dateStr}-foliage-${idx}`}
                  className="cursor-pointer transition-all duration-150 hover:scale-115 active:scale-95 hover:drop-shadow-lg"
                  style={{
                    marginLeft: idx === 0 ? 0 : -overlapPx,
                    zIndex: hoveredIdx === idx ? 50 : baseZ,
                    transform: isBack ? 'translateY(-2px)' : 'translateY(0)',
                  }}
                  onMouseEnter={() => {
                    setHoveredIdx(idx)
                    setHoveredTree(getTreeTooltip(s, idx, count))
                  }}
                  onMouseLeave={() => {
                    setHoveredIdx(null)
                    setHoveredTree(null)
                  }}
                >
                  <SpriteFoliage
                    type={pType}
                    species={species}
                    variant={getSessionFoliageSeed(s, idx)}
                    height={h}
                    delay={Math.min(0.35, idx * 0.04)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Grassy Soil Baseline ─────────────────── */}
      <div className="relative h-1 w-full shrink-0 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500/20 blur-[0.5px]" />
      </div>
    </div>
  )
}
