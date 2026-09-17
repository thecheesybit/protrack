import { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ZoomIn, ZoomOut, Compass, Sparkles, X, Droplets, Mountain, Calendar, Clock, Eye } from 'lucide-react'
import { deriveWorldHexes, hexToPixel } from '@/lib/forestWorld'
import { cn } from '@/utils/cn'

/**
 * ForestWorldMap
 * Honeycomb Continent of month-hexes tiling the user's focus journey across time.
 * Pure derivation, 0 Firestore queries, 60fps canvas pan/zoom.
 */
export const ForestWorldMap = memo(function ForestWorldMap({
  sessions = [],
  currentStreak = 0,
  className,
  onInspectMonth = null,
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  const [selectedHex, setSelectedHex] = useState(null)
  const [hoveredHex, setHoveredHex] = useState(null)
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const hasMovedRef = useRef(false)

  // Derive world continent hexes from sessions
  const worldHexes = useMemo(() => {
    return deriveWorldHexes(sessions, {
      now: new Date(),
      currentStreak,
    })
  }, [sessions, currentStreak])

  // Canvas dimensions
  const dimsRef = useRef({ width: 0, height: 0, dpr: 1 })

  // Keep camera centered on current month when loaded
  const hasCenteredRef = useRef(false)

  // Draw loop
  const drawContinent = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height, dpr } = dimsRef.current
    if (width <= 0 || height <= 0) return

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const baseR = 85 * zoom
    const sinPitch = 0.5236 // ~30° isometric pitch

    const cx = width / 2 + pan.x
    const cy = height / 2 + pan.y

    const hoveredKey = hoveredHex?.key
    const selectedKey = selectedHex?.key

    // Draw connection bridges between adjacent hexes
    ctx.save()
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)'
    ctx.lineWidth = Math.max(1, 2 * zoom)
    ctx.setLineDash([4 * zoom, 6 * zoom])
    for (let i = 1; i < worldHexes.length; i++) {
      const prev = worldHexes[i - 1]
      const curr = worldHexes[i]
      const p1 = hexToPixel(prev.q, prev.r, baseR, sinPitch)
      const p2 = hexToPixel(curr.q, curr.r, baseR, sinPitch)
      ctx.beginPath()
      ctx.moveTo(cx + p1.px, cy + p1.py)
      ctx.lineTo(cx + p2.px, cy + p2.py)
      ctx.stroke()
    }
    ctx.restore()

    // Render each month hex tile
    for (const hex of worldHexes) {
      const { px, py } = hexToPixel(hex.q, hex.r, baseR, sinPitch)
      const hx = cx + px
      const hy = cy + py

      // Frustum culling
      if (hx < -baseR * 2 || hx > width + baseR * 2 || hy < -baseR * 2 || hy > height + baseR * 2) {
        continue
      }

      const isHovered = hex.key === hoveredKey
      const isSelected = hex.key === selectedKey
      const isCurrent = hex.isCurrent
      const isDormant = hex.isDormant
      const tierLvl = hex.ecosystem?.tier?.level ?? hex.ecosystem?.tier?.tier ?? 0
      const vitality = hex.ecosystem?.vitality ?? 1
      const soilDepth = Math.max(12, baseR * 0.22)

      // Hex corners in screen coordinates (pointy-topped)
      const corners = []
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + Math.PI / 6
        corners.push({
          x: hx + Math.cos(angle) * baseR,
          y: hy + Math.sin(angle) * baseR * sinPitch,
        })
      }

      // ── Contact Shadow ──
      ctx.beginPath()
      ctx.ellipse(hx, hy + soilDepth + 3, baseR * 1.05, baseR * sinPitch * 1.05, 0, 0, Math.PI * 2)
      ctx.fillStyle = isCurrent ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 0, 0, 0.45)'
      ctx.fill()

      // ── Extruded 3D Soil Walls (Visible South-Facing Faces) ──
      const wallFaces = [
        { c0: corners[3], c1: corners[2], shade: 0.35 }, // West flank
        { c0: corners[2], c1: corners[1], shade: 0.52 }, // South-west prow
        { c0: corners[1], c1: corners[0], shade: 0.70 }, // South-east prow
        { c0: corners[0], c1: corners[5], shade: 0.42 }, // East flank
      ]

      for (const face of wallFaces) {
        const { c0, c1, shade } = face
        const hDepth = soilDepth * 0.45

        // Top Humus Layer
        ctx.beginPath()
        ctx.moveTo(c0.x, c0.y)
        ctx.lineTo(c1.x, c1.y)
        ctx.lineTo(c1.x, c1.y + hDepth)
        ctx.lineTo(c0.x, c0.y + hDepth)
        ctx.closePath()
        ctx.fillStyle = `rgb(${Math.round(55 * shade)}, ${Math.round(36 * shade)}, ${Math.round(20 * shade)})`
        ctx.fill()

        // Bottom Subsoil Layer
        ctx.beginPath()
        ctx.moveTo(c0.x, c0.y + hDepth)
        ctx.lineTo(c1.x, c1.y + hDepth)
        ctx.lineTo(c1.x, c1.y + soilDepth)
        ctx.lineTo(c0.x, c0.y + soilDepth)
        ctx.closePath()
        ctx.fillStyle = `rgb(${Math.round(38 * shade)}, ${Math.round(22 * shade)}, ${Math.round(12 * shade)})`
        ctx.fill()
      }

      // ── Top Face (Grass / Earth Bed) ──
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(corners[0].x, corners[0].y)
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y)
      }
      ctx.closePath()

      // Base terrain gradient by tier & vitality
      const grassGrad = ctx.createLinearGradient(hx, hy - baseR * sinPitch, hx, hy + baseR * sinPitch)
      if (isDormant) {
        grassGrad.addColorStop(0, '#42372d')
        grassGrad.addColorStop(1, '#251f18')
      } else if (vitality < 0.4) {
        grassGrad.addColorStop(0, '#5a542b')
        grassGrad.addColorStop(1, '#333016')
      } else if (tierLvl === 0 || tierLvl === 1) {
        grassGrad.addColorStop(0, '#86efac')
        grassGrad.addColorStop(1, '#22c55e')
      } else if (tierLvl === 2) {
        grassGrad.addColorStop(0, '#4ade80')
        grassGrad.addColorStop(1, '#16a34a')
      } else if (tierLvl === 3) {
        grassGrad.addColorStop(0, '#34d399')
        grassGrad.addColorStop(1, '#059669')
      } else if (tierLvl === 4) {
        grassGrad.addColorStop(0, '#2dd4bf')
        grassGrad.addColorStop(1, '#0d9488')
      } else {
        grassGrad.addColorStop(0, '#38bdf8')
        grassGrad.addColorStop(1, '#0284c7')
      }

      ctx.fillStyle = grassGrad
      ctx.fill()

      // Rim outline
      ctx.strokeStyle = isDormant ? 'rgba(120, 113, 108, 0.4)' : 'rgba(255, 255, 255, 0.25)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Clip inside top face for miniature diorama elements
      ctx.clip()

      // ── Miniature Hydrology Feature ──
      const hydro = hex.ecosystem?.hydrology?.type || 'none'
      if (hydro === 'puddle') {
        ctx.beginPath()
        ctx.ellipse(hx + baseR * 0.18, hy + baseR * sinPitch * 0.12, baseR * 0.18, baseR * 0.12 * sinPitch, 0.2, 0, Math.PI * 2)
        ctx.fillStyle = '#38bdf8'
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(hx + baseR * 0.15, hy + baseR * sinPitch * 0.1, baseR * 0.06, baseR * 0.03 * sinPitch, 0.2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
        ctx.fill()
      } else if (hydro === 'pond') {
        ctx.beginPath()
        ctx.ellipse(hx - baseR * 0.1, hy + baseR * sinPitch * 0.08, baseR * 0.3, baseR * 0.2 * sinPitch, -0.15, 0, Math.PI * 2)
        const wGrad = ctx.createLinearGradient(hx - baseR * 0.2, hy, hx + baseR * 0.2, hy)
        wGrad.addColorStop(0, '#22d3ee')
        wGrad.addColorStop(1, '#0284c7')
        ctx.fillStyle = wGrad
        ctx.fill()
        // Mini lily pad
        ctx.beginPath()
        ctx.arc(hx - baseR * 0.18, hy + baseR * sinPitch * 0.1, Math.max(1.5, 2.5 * zoom), 0, Math.PI * 2)
        ctx.fillStyle = '#4ade80'
        ctx.fill()
      } else if (hydro === 'stream') {
        ctx.beginPath()
        ctx.moveTo(hx - baseR * 0.45, hy - baseR * sinPitch * 0.25)
        ctx.bezierCurveTo(hx - baseR * 0.1, hy - baseR * sinPitch * 0.05, hx + baseR * 0.1, hy + baseR * sinPitch * 0.1, hx + baseR * 0.45, hy + baseR * sinPitch * 0.3)
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = Math.max(2, 3.5 * zoom)
        ctx.stroke()
        ctx.strokeStyle = '#e0f2fe'
        ctx.lineWidth = Math.max(0.8, 1.2 * zoom)
        ctx.stroke()
      } else if (hydro === 'river') {
        ctx.beginPath()
        ctx.moveTo(hx - baseR * 0.55, hy - baseR * sinPitch * 0.2)
        ctx.bezierCurveTo(hx - baseR * 0.1, hy, hx + baseR * 0.1, hy + baseR * sinPitch * 0.15, hx + baseR * 0.55, hy + baseR * sinPitch * 0.35)
        ctx.strokeStyle = '#0284c7'
        ctx.lineWidth = Math.max(4, 7 * zoom)
        ctx.stroke()
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = Math.max(2.5, 4 * zoom)
        ctx.stroke()
        ctx.strokeStyle = '#f0f9ff'
        ctx.lineWidth = Math.max(1, 1.2 * zoom)
        ctx.stroke()
      } else if (hydro === 'waterfall' || hydro === 'lake') {
        ctx.beginPath()
        ctx.ellipse(hx, hy + baseR * sinPitch * 0.06, baseR * 0.36, baseR * 0.24 * sinPitch, 0, 0, Math.PI * 2)
        ctx.fillStyle = '#06b6d4'
        ctx.fill()
        ctx.strokeStyle = '#a5f3fc'
        ctx.lineWidth = Math.max(1, 1.5 * zoom)
        ctx.stroke()
      }

      // ── Miniature 2.5D Flora or Dormant Substrate ──
      if (isDormant) {
        // Draw stones and pebbles on dormant earth
        const pebbles = [
          { dx: -0.22, dy: -0.12, r: 2.6 },
          { dx: 0.18, dy: 0.2, r: 3.2 },
          { dx: -0.12, dy: 0.24, r: 2.1 },
          { dx: 0.26, dy: -0.16, r: 2.8 },
        ]
        for (const p of pebbles) {
          const px = hx + p.dx * baseR
          const py = hy + p.dy * baseR * sinPitch
          ctx.beginPath()
          ctx.ellipse(px, py, p.r * zoom, p.r * 0.6 * sinPitch * zoom, 0.3, 0, Math.PI * 2)
          ctx.fillStyle = '#78716c'
          ctx.fill()
          ctx.strokeStyle = '#44403c'
          ctx.lineWidth = 0.8
          ctx.stroke()
        }
      } else {
        // Seeded deterministic positions for plants
        let seed = (hex.year * 12 + hex.month) * 997 + 101
        const nextRand = () => {
          seed = (seed * 1664525 + 1013904223) % 4294967296
          return seed / 4294967296
        }

        const rawItems = hex.miniItems?.length > 0
          ? hex.miniItems
          : Array.from({ length: Math.min(14, Math.max(3, hex.sessionCount || 4)) }, (_, idx) => ({
              type: idx % 3 === 0 ? 'tree' : idx % 3 === 1 ? 'shrub' : 'flower',
              seed: idx * 7,
            }))

        const plants = []
        const isAutumn = hex.ecosystem?.climate?.season?.name === 'Autumn' || hex.ecosystem?.climate?.season?.name === 'Sharad'

        for (let i = 0; i < rawItems.length; i++) {
          const item = rawItems[i]
          const ang = nextRand() * Math.PI * 2
          const dist = (0.2 + nextRand() * 0.48) * baseR
          const px = hx + Math.cos(ang) * dist
          const py = hy + Math.sin(ang) * dist * sinPitch

          plants.push({
            type: item.type || 'tree',
            px,
            py,
          })
        }

        // CRITICAL 2.5D DEPTH SORTING: back to front
        plants.sort((a, b) => a.py - b.py)

        for (let i = 0; i < plants.length; i++) {
          const { type, px, py } = plants[i]

          if (type === 'tree') {
            const th = Math.max(7, 13 * zoom)
            const tw = Math.max(6, 10 * zoom)

            // Shadow
            ctx.beginPath()
            ctx.ellipse(px, py, tw * 0.38, tw * 0.18 * sinPitch, 0, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
            ctx.fill()

            // Trunk
            ctx.fillStyle = '#451a03'
            ctx.fillRect(px - Math.max(0.5, 0.8 * zoom), py - th * 0.38, Math.max(1, 1.6 * zoom), th * 0.38)

            // Foliage layers
            const foliageBase = isAutumn ? '#b45309' : (vitality < 0.4 ? '#4d4f24' : '#15803d')
            const foliageMid = isAutumn ? '#d97706' : (vitality < 0.4 ? '#686b31' : '#22c55e')
            const foliageTop = isAutumn ? '#f59e0b' : (vitality < 0.4 ? '#8f9443' : '#4ade80')

            ctx.beginPath()
            ctx.arc(px, py - th * 0.42, tw * 0.42, 0, Math.PI * 2)
            ctx.fillStyle = foliageBase
            ctx.fill()

            ctx.beginPath()
            ctx.arc(px, py - th * 0.68, tw * 0.32, 0, Math.PI * 2)
            ctx.fillStyle = foliageMid
            ctx.fill()

            ctx.beginPath()
            ctx.arc(px - tw * 0.08, py - th * 0.74, tw * 0.15, 0, Math.PI * 2)
            ctx.fillStyle = foliageTop
            ctx.fill()
          } else if (type === 'shrub') {
            const sh = Math.max(4, 7.5 * zoom)
            const sw = Math.max(5, 8.5 * zoom)

            ctx.beginPath()
            ctx.ellipse(px, py, sw * 0.32, sw * 0.16 * sinPitch, 0, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
            ctx.fill()

            ctx.beginPath()
            ctx.arc(px, py - sh * 0.45, sw * 0.38, 0, Math.PI * 2)
            ctx.fillStyle = vitality < 0.4 ? '#4d4f24' : '#16a34a'
            ctx.fill()

            ctx.beginPath()
            ctx.arc(px - sw * 0.08, py - sh * 0.55, sw * 0.2, 0, Math.PI * 2)
            ctx.fillStyle = vitality < 0.4 ? '#686b31' : '#4ade80'
            ctx.fill()
          } else {
            // Flower
            ctx.beginPath()
            ctx.moveTo(px, py)
            ctx.lineTo(px, py - 3 * zoom)
            ctx.strokeStyle = '#22c55e'
            ctx.lineWidth = Math.max(0.6, 1 * zoom)
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(px, py - 3.5 * zoom, Math.max(1, 1.5 * zoom), 0, Math.PI * 2)
            ctx.fillStyle = (i % 3 === 0) ? '#f43f5e' : (i % 3 === 1) ? '#fbbf24' : '#ec4899'
            ctx.fill()
          }
        }
      }

      ctx.restore() // End clip

      // ── Hexagon Border Outline ──
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(corners[0].x, corners[0].y)
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y)
      }
      ctx.closePath()

      if (isCurrent) {
        ctx.strokeStyle = '#34d399'
        ctx.lineWidth = isHovered || isSelected ? 3.5 : 2.5
        ctx.shadowColor = '#10b981'
        ctx.shadowBlur = 14
      } else if (isSelected || isHovered) {
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 2.5
        ctx.shadowColor = '#f59e0b'
        ctx.shadowBlur = 10
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
        ctx.lineWidth = 1
      }
      ctx.stroke()
      ctx.restore()

      // ── Active Month Pulsating Aura ──
      if (isCurrent) {
        const pulse = (Date.now() % 2400) / 2400
        const pulseR = baseR * (1.02 + pulse * 0.12)
        ctx.save()
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 + Math.PI / 6
          const ax = hx + Math.cos(angle) * pulseR
          const ay = hy + Math.sin(angle) * pulseR * sinPitch
          if (i === 0) ctx.moveTo(ax, ay)
          else ctx.lineTo(ax, ay)
        }
        ctx.closePath()
        ctx.strokeStyle = `rgba(16, 185, 129, ${0.45 * (1 - pulse)})`
        ctx.lineWidth = 1.8 * zoom
        ctx.stroke()
        ctx.restore()
      }

      // ── Floating Glassmorphic Label Pill ──
      const pillW = Math.max(66, 76 * zoom)
      const pillH = Math.max(24, 28 * zoom)
      const pillX = hx - pillW / 2
      const pillY = hy - baseR * sinPitch * 0.72

      ctx.save()
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(pillX, pillY, pillW, pillH, 6 * zoom)
      } else {
        ctx.rect(pillX, pillY, pillW, pillH)
      }
      ctx.fillStyle = 'rgba(6, 12, 8, 0.84)'
      ctx.fill()
      ctx.strokeStyle = isCurrent ? 'rgba(52, 211, 153, 0.45)' : 'rgba(255, 255, 255, 0.16)'
      ctx.lineWidth = 0.9
      ctx.stroke()

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const monthDate = new Date(hex.year, hex.month, 1)
      const monthName = monthDate.toLocaleDateString([], { month: 'short' })
      const yr = String(hex.year).slice(2)

      // Title line
      ctx.fillStyle = isDormant ? '#94a3b8' : '#ffffff'
      ctx.font = `bold ${Math.max(8, Math.round(9.5 * zoom))}px sans-serif`
      const titleText = isCurrent ? `● ${monthName} '${yr}` : `${monthName} '${yr}`
      ctx.fillText(titleText, hx, pillY + pillH * 0.33)

      // Subtitle line
      if (isDormant) {
        ctx.fillStyle = '#78716c'
        ctx.font = `${Math.max(7, Math.round(8 * zoom))}px sans-serif`
        ctx.fillText('Dormant', hx, pillY + pillH * 0.72)
      } else {
        ctx.fillStyle = hex.ecosystem?.tier?.badgeColor || '#34d399'
        ctx.font = `bold ${Math.max(7, Math.round(8 * zoom))}px sans-serif`
        ctx.fillText(`${hex.totalHours}h · T${tierLvl}`, hx, pillY + pillH * 0.72)
      }
      ctx.restore()
    }

    ctx.restore()
  }, [worldHexes, zoom, pan, hoveredHex, selectedHex])

  // Initial resize and resize observer
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return undefined

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect && rect.width > 0 && rect.height > 0) {
        const dpr = window.devicePixelRatio || 1
        dimsRef.current = { width: rect.width, height: rect.height, dpr }
        canvas.width = Math.round(rect.width * dpr)
        canvas.height = Math.round(rect.height * dpr)
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`

        if (!hasCenteredRef.current && worldHexes.length > 0) {
          // Center on latest / current hex
          const latest = worldHexes[worldHexes.length - 1]
          const { px, py } = hexToPixel(latest.q, latest.r, 85, 0.5236)
          setPan({ x: -px, y: -py })
          hasCenteredRef.current = true
        }

        drawContinent()
      }
    })

    ro.observe(container)
    return () => ro.disconnect()
  }, [drawContinent, worldHexes])

  // Re-draw on state changes & continuous 60fps loop for active pulse
  useEffect(() => {
    let animId
    const loop = () => {
      drawContinent()
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [drawContinent])

  // Hit test hex under cursor
  const findHexAtPoint = useCallback(
    (clientX, clientY) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const mx = clientX - rect.left
      const my = clientY - rect.top

      const { width, height } = dimsRef.current
      const baseR = 85 * zoom
      const sinPitch = 0.5236
      const cx = width / 2 + pan.x
      const cy = height / 2 + pan.y

      let closest = null
      let minDistSq = Infinity

      for (const hex of worldHexes) {
        const { px, py } = hexToPixel(hex.q, hex.r, baseR, sinPitch)
        const hx = cx + px
        const hy = cy + py
        const dx = mx - hx
        const dy = (my - hy) / sinPitch
        const distSq = dx * dx + dy * dy

        if (distSq < (baseR * 0.95) ** 2 && distSq < minDistSq) {
          minDistSq = distSq
          closest = hex
        }
      }

      return closest
    },
    [worldHexes, zoom, pan],
  )

  // Drag Pan & Click Handling
  const handlePointerDown = (e) => {
    if (e.target.closest('button') || e.target.closest('[data-no-drag]')) return
    isDraggingRef.current = true
    hasMovedRef.current = false
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handlePointerMove = (e) => {
    if (isDraggingRef.current) {
      const dx = Math.abs(e.clientX - (dragStartRef.current.x + pan.x))
      const dy = Math.abs(e.clientY - (dragStartRef.current.y + pan.y))
      if (dx > 3 || dy > 3) hasMovedRef.current = true

      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      })
    } else {
      const hex = findHexAtPoint(e.clientX, e.clientY)
      if (hex?.key !== hoveredHex?.key) {
        setHoveredHex(hex)
      }
    }
  }

  const handlePointerUp = (e) => {
    if (isDraggingRef.current && !hasMovedRef.current) {
      // Clicked without dragging
      const hex = findHexAtPoint(e.clientX, e.clientY)
      setSelectedHex(hex)
    }
    isDraggingRef.current = false
  }

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined

    const onWheel = (e) => {
      e.preventDefault()
      e.stopPropagation()
      const factor = e.deltaY < 0 ? 1.12 : 0.89
      setZoom((z) => Math.max(0.4, Math.min(2.8, z * factor)))
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handleResetCenter = () => {
    if (worldHexes.length > 0) {
      const latest = worldHexes[worldHexes.length - 1]
      const { px, py } = hexToPixel(latest.q, latest.r, 85, 0.5236)
      setPan({ x: -px, y: -py })
      setZoom(1.0)
    } else {
      setPan({ x: 0, y: 0 })
      setZoom(1.0)
    }
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn(
        'relative flex h-full w-full select-none overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-[#060c08] via-[#0b140d] to-[#040805]',
        className,
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Top Header Badge */}
      <div className="pointer-events-none absolute top-4 left-4 z-30 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-950/80 px-3.5 py-1.5 backdrop-blur-md shadow-lg">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-bold text-white tracking-wide">Honeycomb Continent</span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
            {worldHexes.length} {worldHexes.length === 1 ? 'Month Hex' : 'Month Hexes'}
          </span>
        </div>
      </div>

      {/* Navigation Controls */}
      <div
        data-no-drag
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 right-4 z-40 flex items-center gap-1 rounded-2xl border border-white/10 bg-slate-950/85 p-1 backdrop-blur-md shadow-lg"
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.4, z * 0.85))}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 hover:bg-white/15 hover:text-white transition-all cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.8, z * 1.15))}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 hover:bg-white/15 hover:text-white transition-all cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <div className="h-4 w-px bg-white/10 mx-0.5" />
        <button
          type="button"
          onClick={handleResetCenter}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 hover:bg-white/15 hover:text-white transition-all cursor-pointer"
          title="Center on Active Month"
        >
          <Compass className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom instructions */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-30 hidden sm:flex items-center gap-2 text-[10px] text-white/40">
        <span>Click any month-hex to inspect · Drag to explore continent · Scroll to zoom</span>
      </div>

      {/* Month Inspector Modal / Card */}
      <AnimatePresence>
        {selectedHex && (
          <motion.div
            key={selectedHex.key}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.2 }}
            data-no-drag
            onClick={(e) => e.stopPropagation()}
            className="absolute top-16 right-4 z-50 w-80 max-w-[calc(100vw-32px)] rounded-3xl border border-white/15 bg-slate-950/95 p-5 text-white backdrop-blur-xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-bold text-white">
                    {new Date(selectedHex.year, selectedHex.month, 1).toLocaleDateString([], {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h3>
                  {selectedHex.isCurrent && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      Active
                    </span>
                  )}
                  {selectedHex.isDormant && (
                    <span className="rounded-full bg-stone-800 px-2 py-0.5 text-[10px] font-medium text-stone-300">
                      Dormant
                    </span>
                  )}
                  {!selectedHex.isCurrent && !selectedHex.isDormant && selectedHex.isSealed && (
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                      Sealed
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  Hex #{selectedHex.index + 1} of your continent
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHex(null)}
                className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Succession Tier Badge */}
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-white/60">Succession Tier</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: `${selectedHex.ecosystem?.tier?.badgeColor || '#10b981'}25`,
                    color: selectedHex.ecosystem?.tier?.badgeColor || '#10b981',
                  }}
                >
                  Tier {selectedHex.ecosystem?.tier?.level} · {selectedHex.ecosystem?.tier?.name}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-white/70 italic">
                "{selectedHex.ecosystem?.tier?.description}"
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-2xl border border-white/5 bg-white/5 p-2.5">
                <div className="flex items-center gap-1.5 text-white/50 text-[10px]">
                  <Clock className="h-3 w-3 text-sky-400" />
                  <span>Focus Time</span>
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {selectedHex.totalHours} hrs
                </div>
                <div className="text-[10px] text-white/40">{selectedHex.sessionCount} sessions</div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/5 p-2.5">
                <div className="flex items-center gap-1.5 text-white/50 text-[10px]">
                  <Calendar className="h-3 w-3 text-emerald-400" />
                  <span>Consistency</span>
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {selectedHex.activeDaysCount} days
                </div>
                <div className="text-[10px] text-white/40">
                  {Math.round((selectedHex.ecosystem?.vitality || 1) * 100)}% vitality
                </div>
              </div>
            </div>

            {/* Environmental Features */}
            <div className="mb-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Droplets className="h-3.5 w-3.5 text-sky-400" />
                  Hydrology
                </span>
                <span className="text-[11px] font-medium text-white/90 capitalize">
                  {selectedHex.ecosystem?.hydrology?.type || 'None'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-white/70">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Mountain className="h-3.5 w-3.5 text-amber-400" />
                  Geomorphology
                </span>
                <span className="text-[11px] font-medium text-white/90 capitalize">
                  {selectedHex.ecosystem?.geomorphology?.type?.replace('_', ' ') || 'Flat'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-white/70">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  Season / Ritu
                </span>
                <span className="text-[11px] font-medium text-emerald-300">
                  {selectedHex.ecosystem?.climate?.season?.name || 'Temperate'}
                </span>
              </div>
            </div>

            {/* Inspect 3D Action Button */}
            {onInspectMonth && (
              <button
                type="button"
                onClick={() => {
                  onInspectMonth(selectedHex)
                  setSelectedHex(null)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/50 bg-emerald-500/25 px-4 py-2.5 text-xs font-bold text-emerald-200 transition-all hover:bg-emerald-500/35 active:scale-95 cursor-pointer shadow-glow-sm"
              >
                <Eye className="h-4 w-4" />
                <span>Enter 3D Hex Diorama</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})
