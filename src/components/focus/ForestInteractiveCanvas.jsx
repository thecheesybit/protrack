import { useEffect, useRef, useState, useCallback, memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ZoomIn, ZoomOut, RotateCw, Play, Pause, Compass, Sparkles, Heart } from 'lucide-react'
import { ForestCanvasEngine } from './ForestCanvasEngine'
import { getVitalityStatus } from '@/lib/ecoVitality'
import { cn } from '@/utils/cn'

export const ForestInteractiveCanvas = memo(function ForestInteractiveCanvas({
  items = [],
  className,
  emptyState = null,
  showWildlife = true,
  showControls = true,
  onDoubleClick,
  isSanctuary = false,
  ecosystem = null,
  isHex = false,
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)

  const [hovered, setHovered] = useState(null)
  const [autoRotate, setAutoRotate] = useState(false)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0, button: 0 })

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const engine = new ForestCanvasEngine(canvas, {
      interactive: true,
      showWildlife,
      ecosystem,
      isHex: Boolean(isHex),
    })
    engine.onHoverChange = (item) => {
      setHovered(item ? item.tooltip || { title: item.session?.label || 'Focus Session' } : null)
    }
    engine.setItems(items)
    engineRef.current = engine

    return () => {
      engine.destroy()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWildlife, isHex])

  // Update ecosystem in engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setEcosystem(ecosystem)
    }
  }, [ecosystem])

  // Update items in engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setItems(items)
    }
  }, [items])

  // Resize handling with ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return undefined

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect && rect.width > 0 && rect.height > 0 && engineRef.current) {
        engineRef.current.setDimensions(Math.round(rect.width), Math.round(rect.height))
      }
    })

    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // Non-passive wheel listener attached directly to DOM to allow e.preventDefault()
  // and keep diorama centered while zooming smoothly
  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined

    const onWheel = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!engineRef.current) return
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87
      if (e.ctrlKey || e.metaKey) {
        // Ctrl + wheel zooms towards cursor (focal zoom for edges)
        const rect = el.getBoundingClientRect()
        const focalX = e.clientX - rect.left
        const focalY = e.clientY - rect.top
        engineRef.current.zoomBy(zoomFactor, focalX, focalY)
      } else {
        // Normal wheel zooms centered
        engineRef.current.zoomBy(zoomFactor)
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Pointer interactions (360° Drag Rotate & Pan)
  const handlePointerDown = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('[data-no-drag]')) return

    if (autoRotate && engineRef.current) {
      engineRef.current.camera.autoRotate = false
      setAutoRotate(false)
    }

    isDraggingRef.current = true
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      button: e.button,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
    }
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // ignore
    }
  }, [autoRotate])

  const handlePointerMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    if (isDraggingRef.current && engineRef.current) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      dragStartRef.current.x = e.clientX
      dragStartRef.current.y = e.clientY

      // Free Move (Pan): Ctrl + Right Click, Right-Click, Shift-Drag, or Ctrl-Drag
      const isPan =
        dragStartRef.current.button === 2 ||
        e.buttons === 2 ||
        dragStartRef.current.ctrl ||
        e.ctrlKey ||
        e.metaKey ||
        dragStartRef.current.shift ||
        e.shiftKey

      if (isPan) {
        engineRef.current.panBy(dx, dy)
      } else {
        // Natural diorama grab rotation (dragging left rotates left, right rotates right)
        engineRef.current.rotateBy(-dx * 0.009)
      }
    } else if (engineRef.current) {
      // Hover hit-testing
      engineRef.current.handlePointerMove(screenX, screenY)
    }
  }, [])

  const handlePointerUp = useCallback((e) => {
    isDraggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      // ignore
    }
  }, [])

  // Context menu prevent so right click can pan cleanly
  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
  }, [])

  // Double tap / double click
  const handleDoubleClick = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('[data-no-drag]')) return
    if (onDoubleClick) {
      onDoubleClick(e)
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('protrack:open-zen', { detail: { tab: 'forest' } }))
    }
  }, [onDoubleClick])

  // HUD Controls
  const handleZoomIn = () => engineRef.current?.zoomBy(1.25)
  const handleZoomOut = () => engineRef.current?.zoomBy(0.8)
  const handleRotate90 = () => engineRef.current?.rotateBy(-Math.PI / 2)
  const handleReset = () => engineRef.current?.resetView()
  const handleToggleAutoRotate = () => {
    if (engineRef.current) {
      engineRef.current.toggleAutoRotate()
      setAutoRotate((prev) => !prev)
    }
  }

  const isEmpty = items.length === 0

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full min-h-[220px] select-none overflow-hidden touch-none', className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      title="Drag to rotate 360° · Scroll to zoom · Ctrl + Right Click to move freely · Compass to reset"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block cursor-grab active:cursor-grabbing" />

      {/* Atmospheric Fireflies for standard/sanctuary mode */}
      <div className="pointer-events-none absolute left-[15%] top-[20%] h-1.5 w-1.5 rounded-full bg-amber-300/40 blur-[0.5px] animate-pulse" />
      <div
        className="pointer-events-none absolute right-[18%] top-[26%] h-2 w-2 rounded-full bg-emerald-300/30 blur-[0.5px] animate-pulse"
        style={{ animationDelay: '2s' }}
      />

      {/* Ecosystem HUD Badge (Succession Tier, Vitality & Season) */}
      {ecosystem && (
        <div
          data-no-drag="true"
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute top-3 left-3 z-40 flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-slate-950/80 p-1.5 backdrop-blur-md shadow-lg"
        >
          {/* Tier badge */}
          <div
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold"
            style={{
              backgroundColor: `${ecosystem.tier?.badgeColor || '#10b981'}25`,
              color: ecosystem.tier?.badgeColor || '#10b981',
            }}
          >
            <Sparkles className="h-3 w-3" />
            <span>Tier {ecosystem.tier?.level} · {ecosystem.tier?.name}</span>
          </div>

          {/* Vitality Pill */}
          {ecosystem.vitality !== undefined && (
            <div
              className="flex items-center gap-1 rounded-xl bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/80"
              title="Vitality is maintained by focus consistency. Complete a session today to immediately recover!"
            >
              <Heart className="h-3 w-3 text-rose-400 fill-rose-400/30" />
              <span>{Math.round(ecosystem.vitality * 100)}% · {getVitalityStatus(ecosystem.vitality).label}</span>
            </div>
          )}

          {/* Season / Ritu Pill */}
          {ecosystem.climate?.season?.name && (
            <div className="hidden sm:flex items-center gap-1 rounded-xl bg-white/5 px-2 py-1 text-[10px] font-medium text-white/60">
              <span>{ecosystem.climate.season.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Hover inspection tooltip */}
      <AnimatePresence>
        {hovered && (
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

      {/* Empty State message if grove is empty */}
      {isEmpty && emptyState && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center pointer-events-none">
          {emptyState}
        </div>
      )}

      {/* Floating HUD controls (Zoom, Rotate 90°, Compass Reset, Turntable) */}
      {showControls && !isEmpty && (
        <div
          data-no-drag="true"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 right-3 z-40 flex items-center gap-1 rounded-2xl border border-white/10 bg-slate-950/85 p-1 backdrop-blur-md shadow-lg select-none"
        >
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              handleZoomOut()
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 hover:bg-white/15 hover:text-white active:scale-95 cursor-pointer transition-all"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              handleZoomIn()
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 hover:bg-white/15 hover:text-white active:scale-95 cursor-pointer transition-all"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-white/10 mx-0.5" />
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              handleRotate90()
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 hover:bg-white/15 hover:text-white active:scale-95 cursor-pointer transition-all"
            title="Rotate 90°"
            aria-label="Rotate 90°"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              handleToggleAutoRotate()
            }}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl cursor-pointer transition-all active:scale-95',
              autoRotate ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/70 hover:bg-white/15 hover:text-white',
            )}
            title={autoRotate ? 'Stop Turntable' : 'Auto-Rotate Turntable'}
            aria-label="Turntable"
          >
            {autoRotate ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              handleReset()
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 hover:bg-white/15 hover:text-white active:scale-95 cursor-pointer transition-all"
            title="Reset View (Isometric)"
            aria-label="Reset View"
          >
            <Compass className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Floating hint for gesture discovery */}
      {isSanctuary && (
        <div className="pointer-events-none absolute bottom-3 left-4 z-30 hidden sm:flex items-center gap-2 text-[10px] text-white/40">
          <span>Drag to rotate 360° · Scroll to zoom · Ctrl + Right-click to move freely · Compass to reset</span>
        </div>
      )}
    </div>
  )
})
