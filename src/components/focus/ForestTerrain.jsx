import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SpriteFoliage, getSessionFoliageSeed } from './ForestSprites'
import { getPlantType } from './CalendarForest'
import { computeIsoLayout } from '@/lib/forestLayout'
import { ForestInteractiveCanvas } from './ForestInteractiveCanvas'
import { cn } from '@/utils/cn'

/**
 * A proper 2.5D isometric forest ecosystem matching the Forest app reference.
 *
 * Renders an isometric terrain block (grass top face with subtle grid tiles,
 * two shaded soil side faces, jagged grass fringe, ground contact shadows) with
 * plants arranged in an orderly isometric lattice (depth-sorted back-to-front).
 *
 * Supports standard responsive plots (FocusWidget, MonthlyForest, ZenOverlay)
 * and a low-profile compact mode for calendar day cells (TimetableGrid, TodayAgenda).
 */

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

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
 * Maps completed focus sessions → renderable forest items (oldest first, so the
 * eldest plantings sit at the back and the newest grow toward the viewer).
 */
export function sessionsToForestItems(sessions = []) {
  return (sessions || [])
    .filter((s) => s && s.completed !== false && !s.failedReason && (Number(s.durationMin) || 0) > 0)
    .map((s, i) => {
      const type = getPlantType(s)
      const dur = Number(s.durationMin) || 25
      const d = toDate(s.startedAt || s.createdAt)
      const timeStr = d
        ? d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : null
      const label = s.label || s.title || (s.modeId ? `${s.modeId} session` : 'Focus Session')
      const plantLabel = type === 'flower' ? 'Flower' : type === 'shrub' ? 'Shrub' : 'Tree'

      return {
        key: s.id || `sess-${i}`,
        type,
        species: 'all',
        seed: getSessionFoliageSeed(s, i),
        session: s,
        tooltip: {
          title: label,
          detail: timeStr ? `${dur}m ${plantLabel} · ${timeStr}` : `${dur}m ${plantLabel}`,
        },
      }
    })
}

/** Isometric ground block drawn in pixel space. */
function IsoGround({ w, h, geo, grid = 1 }) {
  const { cx, Ty, My, By, Lx, Rx, D, PW, PH, compact } = geo
  const gid = useMemo(() => `ft-${Math.random().toString(36).slice(2, 8)}`, [])

  // Floor ground shadow beneath the block
  const shadowRx = PW * 0.46
  const shadowRy = Math.max(6, PH * 0.22)
  const shadowCy = By + D + (compact ? 2 : 6)

  // Isometric grid lines on the grass face (like the Forest app reference)
  const gridLines = useMemo(() => {
    if (grid <= 1 || compact) return []
    const lines = []
    // Lines along col direction (back-right to front-left)
    for (let c = 1; c < grid; c++) {
      const u = c / grid
      const x1 = cx + u * (PW / 2)
      const y1 = Ty + u * (PH / 2)
      const x2 = cx + (u - 1) * (PW / 2)
      const y2 = Ty + (u + 1) * (PH / 2)
      lines.push(`M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`)
    }
    // Lines along row direction (back-left to front-right)
    for (let r = 1; r < grid; r++) {
      const v = r / grid
      const x1 = cx - v * (PW / 2)
      const y1 = Ty + v * (PH / 2)
      const x2 = cx + (1 - v) * (PW / 2)
      const y2 = Ty + (1 + v) * (PH / 2)
      lines.push(`M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`)
    }
    return lines
  }, [grid, compact, cx, Ty, PH, PW])

  // Grass fringe: jagged teeth hanging over the two front soil edges
  const { fringe, fringeShadow } = useMemo(() => {
    const teeth = []
    const shadowTeeth = []
    const steps = compact ? 8 : 16
    const toothDepth = compact ? 4 : 8

    for (let i = 0; i < steps; i++) {
      // Left front edge: L(Lx,My) → B(cx,By)
      const t0 = i / steps
      const t1 = (i + 1) / steps
      const tMid = (t0 + t1) / 2
      const lx0 = Lx + (cx - Lx) * t0
      const ly0 = My + (By - My) * t0
      const lx1 = Lx + (cx - Lx) * t1
      const ly1 = My + (By - My) * t1
      const tipLx = Lx + (cx - Lx) * tMid
      const tipLy = My + (By - My) * tMid + toothDepth

      teeth.push(`M ${lx0.toFixed(1)} ${ly0.toFixed(1)} L ${lx1.toFixed(1)} ${ly1.toFixed(1)} L ${tipLx.toFixed(1)} ${tipLy.toFixed(1)} Z`)
      shadowTeeth.push(`M ${lx0.toFixed(1)} ${(ly0 + 2).toFixed(1)} L ${lx1.toFixed(1)} ${(ly1 + 2).toFixed(1)} L ${tipLx.toFixed(1)} ${(tipLy + 2).toFixed(1)} Z`)

      // Right front edge: B(cx,By) → R(Rx,My)
      const rx0 = cx + (Rx - cx) * t0
      const ry0 = By + (My - By) * t0
      const rx1 = cx + (Rx - cx) * t1
      const ry1 = By + (My - By) * t1
      const tipRx = cx + (Rx - cx) * tMid
      const tipRy = By + (My - By) * tMid + toothDepth

      teeth.push(`M ${rx0.toFixed(1)} ${ry0.toFixed(1)} L ${rx1.toFixed(1)} ${ry1.toFixed(1)} L ${tipRx.toFixed(1)} ${tipRy.toFixed(1)} Z`)
      shadowTeeth.push(`M ${rx0.toFixed(1)} ${(ry0 + 2).toFixed(1)} L ${rx1.toFixed(1)} ${(ry1 + 2).toFixed(1)} L ${tipRx.toFixed(1)} ${(tipRy + 2).toFixed(1)} Z`)
    }
    return { fringe: teeth.join(' '), fringeShadow: shadowTeeth.join(' ') }
  }, [Lx, Rx, cx, My, By, compact])

  // Soil horizontal strata lines
  const strata = useMemo(() => {
    if (compact || D < 14) return []
    const lines = []
    const offsets = [0.35, 0.68]
    for (const off of offsets) {
      const dy = D * off
      // Left soil strata
      lines.push(`M ${Lx.toFixed(1)} ${(My + dy).toFixed(1)} Q ${(Lx * 0.5 + cx * 0.5).toFixed(1)} ${(My * 0.5 + By * 0.5 + dy + 1).toFixed(1)} ${cx.toFixed(1)} ${(By + dy).toFixed(1)}`)
      // Right soil strata
      lines.push(`M ${cx.toFixed(1)} ${(By + dy).toFixed(1)} Q ${(cx * 0.5 + Rx * 0.5).toFixed(1)} ${(By * 0.5 + My * 0.5 + dy - 1).toFixed(1)} ${Rx.toFixed(1)} ${(My + dy).toFixed(1)}`)
    }
    return lines
  }, [Lx, Rx, cx, My, By, D, compact])

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <defs>
        {/* Soft floor shadow under the block */}
        <radialGradient id={`${gid}-floorShadow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.32" />
          <stop offset="75%" stopColor="#000000" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* Grass top face gradient (rich sunlit meadow) */}
        <linearGradient id={`${gid}-grass`} x1={cx} y1={Ty} x2={cx} y2={By} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8ee64d" />
          <stop offset="45%" stopColor="#62c536" />
          <stop offset="100%" stopColor="#419e27" />
        </linearGradient>

        {/* Left soil face (shadowed face) */}
        <linearGradient id={`${gid}-soilL`} x1={Lx} y1={My} x2={cx} y2={By + D} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#563b22" />
          <stop offset="60%" stopColor="#3d2714" />
          <stop offset="100%" stopColor="#28180a" />
        </linearGradient>

        {/* Right soil face (lit face) */}
        <linearGradient id={`${gid}-soilR`} x1={cx} y1={By} x2={Rx} y2={By + D} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#694a2c" />
          <stop offset="60%" stopColor="#4a311b" />
          <stop offset="100%" stopColor="#311e0e" />
        </linearGradient>

        {/* Subtle radial sheen on the grass */}
        <radialGradient id={`${gid}-glow`} cx="45%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Floor contact shadow under the island */}
      <ellipse cx={cx} cy={shadowCy} rx={shadowRx} ry={shadowRy} fill={`url(#${gid}-floorShadow)`} />

      {/* Left soil face */}
      <path
        d={`M ${Lx} ${My} L ${cx} ${By} L ${cx} ${By + D} L ${Lx} ${My + D} Z`}
        fill={`url(#${gid}-soilL)`}
      />

      {/* Right soil face */}
      <path
        d={`M ${cx} ${By} L ${Rx} ${My} L ${Rx} ${My + D} L ${cx} ${By + D} Z`}
        fill={`url(#${gid}-soilR)`}
      />

      {/* Soil strata textures */}
      {strata.map((d, idx) => (
        <path key={idx} d={d} fill="none" stroke="#221206" strokeWidth="1" strokeOpacity="0.32" />
      ))}

      {/* Soil center ridge seam */}
      <line x1={cx} y1={By} x2={cx} y2={By + D} stroke="#211306" strokeWidth="1.2" strokeOpacity="0.45" />

      {/* Grass top face */}
      <path
        d={`M ${cx} ${Ty} L ${Rx} ${My} L ${cx} ${By} L ${Lx} ${My} Z`}
        fill={`url(#${gid}-grass)`}
      />

      {/* Isometric tile grid lines */}
      {gridLines.map((d, idx) => (
        <path key={idx} d={d} fill="none" stroke="#ffffff" strokeWidth="0.75" strokeOpacity="0.16" />
      ))}

      {/* Inner sunlit sheen on the grass */}
      <path
        d={`M ${cx} ${Ty} L ${Rx} ${My} L ${cx} ${By} L ${Lx} ${My} Z`}
        fill={`url(#${gid}-glow)`}
      />

      {/* Grass fringe drop shadow on soil */}
      <path d={fringeShadow} fill="#1d1107" opacity="0.35" />

      {/* Grass fringe overhang */}
      <path d={fringe} fill="#4da92c" opacity="0.98" />
    </svg>
  )
}

function CompactSvgTerrain({
  items = [],
  maxCells = 120,
  className,
  minHeightClass = 'min-h-[240px]',
  emptyState = null,
  disableTooltips = false,
}) {
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setSize({ w: Math.round(r.width), h: Math.round(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layout = useMemo(() => computeIsoLayout(items.length, { maxCells }), [items.length, maxCells])
  const grid = layout.grid || 1

  const geo = useMemo(() => {
    const { w, h } = size
    if (w < 30 || h < 30) return null

    // Low profile: minimal soil depth, tight headroom, fills cell cleanly.
    const D = clamp(h * 0.12, 5, 12)
    const bottomPad = 2
    const HEADROOM_RATIO = 0.42
    const maxPhByWidth = (w - 6) * 0.48
    const maxPhByHeight = (h - D - bottomPad) / (1 + HEADROOM_RATIO)
    const PH = clamp(Math.min(maxPhByWidth, maxPhByHeight), 16, 110)
    const PW = PH * 2
    const cx = w / 2
    const used = PH * (1 + HEADROOM_RATIO) + D + bottomPad
    const extraTop = Math.max(0, (h - used) / 2)
    const Ty = PH * HEADROOM_RATIO + extraTop
    const By = Ty + PH
    const My = Ty + PH / 2
    const Lx = cx - PW / 2
    const Rx = cx + PW / 2
    return { w, h, cx, Ty, My, By, Lx, Rx, D, PW, PH, compact: true }
  }, [size])

  const baseTree = useMemo(() => {
    if (!geo) return 0
    return clamp(geo.PH * 0.52, 14, 38)
  }, [geo])

  const isEmpty = items.length === 0

  return (
    <div
      ref={ref}
      className={cn('relative w-full select-none overflow-visible bg-transparent', minHeightClass, className)}
    >
      {geo && <IsoGround w={geo.w} h={geo.h} geo={geo} grid={grid} />}

      {/* Hover inspection tooltip */}
      <AnimatePresence>
        {!disableTooltips && hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2 whitespace-nowrap rounded-xl border border-emerald-500/30 bg-slate-950/92 px-3 py-1.5 text-center shadow-2xl backdrop-blur-xl"
          >
            <p className="text-xs font-bold text-emerald-400">{hovered.title}</p>
            {hovered.detail && <p className="mt-0.5 text-[10px] text-white/70">{hovered.detail}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {isEmpty ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center">
          {emptyState}
        </div>
      ) : (
        geo &&
        layout.cells.map((cell) => {
          const item = items[cell.index]
          if (!item) return null

          // Inset the planting lattice inside the grass diamond so a clean grass
          // border shows on all 4 sides (matching the Forest app reference).
          const INSET_X = 0.86
          const INSET_Y = 0.86
          const screenX = geo.cx + (cell.x - 0.5) * geo.PW * INSET_X
          const screenY = geo.Ty + (0.07 + cell.y * INSET_Y) * geo.PH

          const h =
            item.type === 'flower'
              ? baseTree * 0.44 * cell.scale
              : item.type === 'shrub'
              ? baseTree * 0.58 * cell.scale
              : baseTree * cell.scale

          const shadowW = h * (item.type === 'tree' ? 0.52 : 0.68)
          const shadowH = Math.max(2.5, shadowW * 0.22)

          return (
            <div
              key={item.key}
              className={cn(
                'absolute select-none',
                disableTooltips
                  ? 'pointer-events-none'
                  : 'transition-transform duration-150 cursor-pointer hover:z-[60] hover:-translate-y-1 hover:scale-110',
              )}
              style={{
                left: `${screenX}px`,
                top: `${screenY}px`,
                transform: 'translate(-50%, -100%)',
                zIndex: 20 + cell.z,
              }}
              onMouseEnter={() => {
                if (!disableTooltips) {
                  setHovered(item.tooltip || { title: item.session?.label || item.session?.title || 'Focus session' })
                }
              }}
              onMouseLeave={() => {
                if (!disableTooltips) {
                  setHovered(null)
                }
              }}
            >
              {/* Contact ground shadow under plant base */}
              <div
                className="pointer-events-none absolute left-1/2 rounded-[50%] bg-black/55 blur-[1.5px]"
                style={{
                  width: `${shadowW}px`,
                  height: `${shadowH}px`,
                  bottom: '-2px',
                  transform: 'translateX(-50%)',
                }}
              />
              <SpriteFoliage
                type={item.type}
                species={item.species || 'all'}
                variant={item.seed}
                height={Math.round(h)}
                delay={Math.min(0.4, cell.index * 0.015)}
                interactive={!disableTooltips}
              />
            </div>
          )
        })
      )}
    </div>
  )
}

export function ForestTerrain({
  items = [],
  maxCells = 120,
  className,
  minHeightClass = 'min-h-[240px]',
  emptyState = null,
  compact = false,
  showWildlife = true,
  isSanctuary = false,
  ecosystem = null,
  isHex = false,
  onDoubleClick,
  disableTooltips = false,
}) {
  if (compact) {
    return (
      <CompactSvgTerrain
        items={items}
        maxCells={maxCells}
        className={className}
        minHeightClass={minHeightClass}
        emptyState={emptyState}
        disableTooltips={disableTooltips}
      />
    )
  }

  return (
    <ForestInteractiveCanvas
      items={items}
      emptyState={emptyState}
      showWildlife={showWildlife}
      ecosystem={ecosystem}
      isHex={isHex}
      className={cn(
        'rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-[#0b130e] via-[#101a10] to-[#0a0f0a]',
        minHeightClass,
        className,
      )}
      onDoubleClick={onDoubleClick}
      isSanctuary={isSanctuary}
    />
  )
}
