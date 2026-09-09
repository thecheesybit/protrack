import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  Clock,
  Calendar,
  MapPin,
  Play,
  Pin,
  PinOff,
  Sparkles,
  GraduationCap,
  ChevronRight,
  Info,
  X,
  BookOpen,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useSubjects } from '@/hooks/useSubjects'
import { useTimetable } from '@/hooks/useTimetable'
import { minutesToLabel, durationLabel, DAYS } from '@/lib/time'
import { cn } from '@/utils/cn'

const TYPE_LEGENDS = [
  { badge: 'L', label: 'Lecture', desc: 'Core theory & instruction', color: 'bg-sky-500/20 text-sky-400 border-sky-500/40' },
  { badge: 'Lab', label: 'Laboratory', desc: 'Hands-on practical & experiments', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
  { badge: 'T', label: 'Tutorial', desc: 'Small-group discussion & drills', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  { badge: 'S', label: 'Seminar', desc: 'Presentations & workshops', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  { badge: 'Rev', label: 'Revision', desc: 'Review & exam preparation', color: 'bg-rose-500/20 text-rose-400 border-rose-500/40' },
]

export function TimetableContextRail() {
  const activeModeId = useStore((s) => s.activeModeId)
  const modes = useStore((s) => s.modes)
  const clockCentered = useStore((s) => s.clockCentered)
  const hoveredItem = useStore((s) => s.hoveredTimetableItem)
  const hoveredSubjectId = useStore((s) => s.hoveredSubjectId)
  const setHoveredSubjectId = useStore((s) => s.setHoveredSubjectId)
  const isPinned = useStore((s) => s.timetableLegendsPinned)
  const setIsPinned = useStore((s) => s.setTimetableLegendsPinned)
  const setTimetableLegendsExpanded = useStore((s) => s.setTimetableLegendsExpanded)
  const bottomDockOpen = useStore((s) => s.bottomDockOpen)
  const setBottomDockOpen = useStore((s) => s.setBottomDockOpen)
  const modeRailOpen = useStore((s) => s.modeRailOpen)
  const setModeRailOpen = useStore((s) => s.setModeRailOpen)
  const scopeDropdownOpen = useStore((s) => s.scopeDropdownOpen)
  const timetableLegendsEnabled = useStore((s) => s.timetableLegendsEnabled)
  const toggleTimetableLegends = useStore((s) => s.toggleTimetableLegends)
  const startFocus = useStore((s) => s.startFocus)

  const [isSelfHovered, setIsSelfHovered] = useState(false)
  const [activeTab, setActiveTab] = useState('inspector') // 'inspector' | 'subjects' | 'types'
  const [lastInspectedItem, setLastInspectedItem] = useState(null)
  const [lingerRemaining, setLingerRemaining] = useState(0) // 0 = not lingering, 5..1 = seconds left
  const [manuallyClosed, setManuallyClosed] = useState(false)

  const lingerTimeoutRef = useRef(null)
  const countdownIntervalRef = useRef(null)
  const panelInactivityTimerRef = useRef(null)

  const { subjects = [] } = useSubjects(activeModeId)
  const { slots = [] } = useTimetable(activeModeId)

  const activeMode = useMemo(() => {
    if (activeModeId === 'all') return { name: 'All Scopes', accentColor: 'rgb(var(--accent))' }
    return (modes || []).find((m) => m.id === activeModeId) || { name: 'Current Mode', accentColor: 'rgb(var(--accent))' }
  }, [activeModeId, modes])

  // Count slots and total weekly minutes per subject
  const subjectStats = useMemo(() => {
    const map = new Map()
    for (const s of (slots || [])) {
      if (!s.subjectId) continue
      const current = map.get(s.subjectId) || { count: 0, totalMin: 0 }
      const dur = Math.max(0, (s.endMin || 0) - (s.startMin || 0))
      map.set(s.subjectId, { count: current.count + 1, totalMin: current.totalMin + dur })
    }
    return map
  }, [slots])

  // Clear all lingering timers
  const clearLingerTimers = useCallback(() => {
    if (lingerTimeoutRef.current) {
      clearTimeout(lingerTimeoutRef.current)
      lingerTimeoutRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    setLingerRemaining(0)
  }, [])

  // Manual Close pill (immediate collapse without waiting for 5s)
  const handleManualClose = useCallback((e) => {
    e?.stopPropagation()
    clearLingerTimers()
    if (panelInactivityTimerRef.current) {
      clearTimeout(panelInactivityTimerRef.current)
      panelInactivityTimerRef.current = null
    }
    setManuallyClosed(true)
    setIsSelfHovered(false)
    setLastInspectedItem(null)
    setIsPinned(false)
  }, [clearLingerTimers, setIsPinned])

  // 5s inactivity timer for interaction inside the panel
  const resetPanelActivity = useCallback(() => {
    if (panelInactivityTimerRef.current) {
      clearTimeout(panelInactivityTimerRef.current)
      panelInactivityTimerRef.current = null
    }
    // If inside panel and no slot currently hovered, close after 5s of zero mouse movement
    if (!hoveredItem && !isPinned) {
      panelInactivityTimerRef.current = setTimeout(() => {
        handleManualClose()
      }, 5000)
    }
  }, [hoveredItem, isPinned, handleManualClose])

  // Mutual exclusion & toggle: when toggled off, pill (mode rail), bottom dock, or scope dropdown opens, collapse legends immediately
  useEffect(() => {
    if (!timetableLegendsEnabled || modeRailOpen || bottomDockOpen || scopeDropdownOpen) {
      clearLingerTimers()
      if (panelInactivityTimerRef.current) {
        clearTimeout(panelInactivityTimerRef.current)
        panelInactivityTimerRef.current = null
      }
      setManuallyClosed(true)
      setIsSelfHovered(false)
      setLastInspectedItem(null)
      setIsPinned(false)
    }
  }, [timetableLegendsEnabled, modeRailOpen, bottomDockOpen, scopeDropdownOpen, clearLingerTimers, setIsPinned])

  // Manage 5-second linger grace period when mouse leaves a slot
  useEffect(() => {
    // While legends are toggled off or while selecting scope, legend CANNOT open
    if (!timetableLegendsEnabled || scopeDropdownOpen) return

    if (hoveredItem) {
      // Mutual exclusion: opening legend closes pill and bottom dock
      setModeRailOpen?.(false)
      setBottomDockOpen?.(false)
      setLastInspectedItem(hoveredItem)
      setManuallyClosed(false)
      setActiveTab('inspector')
      clearLingerTimers()
    } else if (lastInspectedItem && !isPinned && !isSelfHovered && !manuallyClosed && !bottomDockOpen && !modeRailOpen && !scopeDropdownOpen) {
      // Slot unhovered: start 5s linger countdown
      clearLingerTimers()
      setLingerRemaining(5)

      countdownIntervalRef.current = setInterval(() => {
        setLingerRemaining((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
            return 0
          }
          return prev - 1
        })
      }, 1000)

      lingerTimeoutRef.current = setTimeout(() => {
        clearLingerTimers()
        setLastInspectedItem(null)
      }, 5000)
    }
  }, [hoveredItem, isPinned, isSelfHovered, manuallyClosed, bottomDockOpen, modeRailOpen, scopeDropdownOpen, timetableLegendsEnabled, lastInspectedItem, clearLingerTimers, setBottomDockOpen, setModeRailOpen])

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearLingerTimers()
      if (panelInactivityTimerRef.current) {
        clearTimeout(panelInactivityTimerRef.current)
        panelInactivityTimerRef.current = null
      }
    }
  }, [clearLingerTimers])

  // Mouse enters rail itself
  const handleRailMouseEnter = useCallback(() => {
    if (!timetableLegendsEnabled || scopeDropdownOpen) return
    // Mutual exclusion: entering legend rail closes pill and bottom dock immediately
    setModeRailOpen?.(false)
    setBottomDockOpen?.(false)
    setIsSelfHovered(true)
    setManuallyClosed(false)
    clearLingerTimers()
    resetPanelActivity()
  }, [timetableLegendsEnabled, scopeDropdownOpen, clearLingerTimers, setBottomDockOpen, setModeRailOpen, resetPanelActivity])

  // Mouse leaves rail
  const handleRailMouseLeave = useCallback(() => {
    setIsSelfHovered(false)
    if (panelInactivityTimerRef.current) {
      clearTimeout(panelInactivityTimerRef.current)
      panelInactivityTimerRef.current = null
    }
    if (!isPinned && !hoveredItem && lastInspectedItem && !bottomDockOpen && !modeRailOpen && !scopeDropdownOpen) {
      clearLingerTimers()
      setLingerRemaining(5)

      countdownIntervalRef.current = setInterval(() => {
        setLingerRemaining((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
            return 0
          }
          return prev - 1
        })
      }, 1000)

      lingerTimeoutRef.current = setTimeout(() => {
        clearLingerTimers()
        setLastInspectedItem(null)
      }, 5000)
    }
  }, [isPinned, hoveredItem, lastInspectedItem, bottomDockOpen, modeRailOpen, scopeDropdownOpen, clearLingerTimers])

  // Mutual exclusion: cannot be expanded while toggled off, or while pill (mode rail), bottom dock, or scope dropdown is open
  const isBlocked = !timetableLegendsEnabled || scopeDropdownOpen || modeRailOpen || bottomDockOpen || manuallyClosed
  const isExpanded = !isBlocked && (isPinned || isSelfHovered || Boolean(hoveredItem) || lingerRemaining > 0)

  // Sync expanded state with Zustand so FlipClock coordinates cleanly
  useEffect(() => {
    setTimetableLegendsExpanded?.(isExpanded)
    return () => setTimetableLegendsExpanded?.(false)
  }, [isExpanded, setTimetableLegendsExpanded])

  // Keyboard shortcut Esc to close expanded panel
  useEffect(() => {
    if (!isExpanded) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleManualClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isExpanded, handleManualClose])

  // If centered desk clock (Ctrl+T) is active, hide completely
  if (clockCentered) return null

  // Active inspected item (current hover or held in 5s grace period)
  const displayedItem = hoveredItem || lastInspectedItem
  const itemData = displayedItem?.data
  const itemSubject = displayedItem?.subject
  const isSlot = displayedItem?.type === 'slot'
  const isEvent = displayedItem?.type === 'event'

  const rawTag = (typeof itemData?.tag === 'string'
    ? itemData.tag
    : (typeof itemData?.label === 'string' && ['lecture', 'lab', 'tutorial', 'seminar'].includes(itemData.label.toLowerCase()) ? itemData.label : '')
  ).trim()
  const lowerTag = rawTag.toLowerCase()
  let typeBadge = 'Session'
  if (lowerTag.includes('lecture') || lowerTag === 'l') typeBadge = 'Lecture'
  else if (lowerTag.includes('lab')) typeBadge = 'Lab'
  else if (lowerTag.includes('tutorial') || lowerTag === 't') typeBadge = 'Tutorial'
  else if (lowerTag.includes('seminar') || lowerTag === 's') typeBadge = 'Seminar'
  else if (isEvent) typeBadge = 'Event'

  const title = itemSubject?.name || itemData?.label || itemData?.title || 'Class Session'
  const customTopic = itemSubject && typeof itemData?.label === 'string' && itemData.label.toLowerCase() !== 'lecture' && itemData.label.trim() !== itemSubject.name.trim()
    ? itemData.label
    : null

  const timeRange = itemData?.startMin != null && itemData?.endMin != null
    ? `${minutesToLabel(itemData.startMin)} – ${minutesToLabel(itemData.endMin)}`
    : 'Scheduled'
  const duration = itemData?.startMin != null && itemData?.endMin != null
    ? durationLabel(itemData.startMin, itemData.endMin)
    : null

  const dayLabel = itemData?.dayOfWeek != null && DAYS[itemData.dayOfWeek] ? DAYS[itemData.dayOfWeek] : 'Weekly'

  const handleStartFocus = () => {
    if (!itemData) return
    startFocus({
      title: `${title}${customTopic ? ` - ${customTopic}` : ''}`,
      subjectId: itemSubject?.id || itemData.subjectId,
      color: itemSubject?.color || itemData.color || '#6366f1',
      slotId: itemData.id,
    })
  }

  return (
    <div
      data-testid="timetable-context-rail"
      onMouseEnter={handleRailMouseEnter}
      onMouseLeave={handleRailMouseLeave}
      onMouseMove={resetPanelActivity}
      className={cn(
        'absolute right-full mr-2.5 top-[92px] z-25 hidden lg:flex flex-col transition-all duration-300 pointer-events-auto',
        bottomDockOpen ? 'bottom-[88px]' : 'bottom-[196px]',
        scopeDropdownOpen && 'opacity-0 pointer-events-none translate-x-4',
        isExpanded ? 'w-[236px]' : 'w-10 items-end',
      )}
    >
      <AnimatePresence initial={false} mode="wait">
        {!isExpanded ? (
          /* ── Collapsed Peek Pill (Hover Trigger — anchored right against Timetable) ── */
          <motion.div
            key="collapsed-peek"
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (!timetableLegendsEnabled) {
                toggleTimetableLegends?.()
                return
              }
              if (scopeDropdownOpen) return
              setModeRailOpen?.(false)
              setBottomDockOpen?.(false)
              setManuallyClosed(false)
              setIsSelfHovered(true)
              clearLingerTimers()
            }}
            className={cn(
              "flex h-full w-9 flex-col items-center justify-between rounded-2xl border py-3 shadow-glass backdrop-blur-xl cursor-pointer transition-all duration-200 group select-none relative",
              !timetableLegendsEnabled
                ? "border-line/40 bg-surface/50 opacity-70 hover:opacity-100 hover:border-accent/50"
                : "border-line/70 bg-surface/80 hover:border-accent/60 hover:bg-surface/95"
            )}
            title={
              !timetableLegendsEnabled
                ? "Legends locked · Press L to turn on"
                : "Click or hover to view class details, custom names & subject legends (Press L to turn off)"
            }
          >
            {/* Ambient edge glow */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

            {/* When toggled off: says press L to turn on when hover on the legend pill specifically */}
            {!timetableLegendsEnabled && (
              <div className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 z-50 flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-line/90 bg-surface/95 px-3 py-1.5 text-xs font-semibold text-ink shadow-2xl backdrop-blur-2xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 -translate-x-1">
                <span className="text-muted text-[11px]">Legends locked ·</span>
                <span className="text-ink font-bold">Press</span>
                <kbd className="rounded bg-accent/25 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-accent ring-1 ring-accent/30 shadow-xs">
                  L
                </kbd>
                <span className="text-ink font-bold">to turn on</span>
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-surface-2 text-muted group-hover:text-accent group-hover:scale-105 transition-all">
                <Layers className="h-4 w-4" />
              </div>
              <span className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold uppercase tracking-widest text-muted group-hover:text-ink transition-colors">
                Legends & Details
              </span>
            </div>

            {/* Subject palette preview dots */}
            <div className="flex flex-col items-center gap-1.5 pb-1">
              {subjects.slice(0, 5).map((s) => (
                <span
                  key={s.id}
                  className="h-2 w-2 rounded-full ring-1 ring-white/20 shadow-xs"
                  style={{ backgroundColor: s.color || '#6366f1' }}
                  title={s.name}
                />
              ))}
              {subjects.length > 5 && (
                <span className="text-[8px] font-mono text-muted">+{subjects.length - 5}</span>
              )}
            </div>
          </motion.div>
        ) : (
          /* ── Expanded Full Glass Panel (Details & Legends) ── */
          <motion.div
            key="expanded-panel"
            initial={{ opacity: 0, scale: 0.96, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.96, x: 10 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="flex h-full w-full flex-col rounded-2xl border border-line/80 bg-surface/95 dark:bg-[#0d0f17]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl select-none overflow-hidden relative"
          >
            {/* Ambient top hairline accent */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-80" />

            {/* Header: Title, Pin Toggle, and Push Pill to Close */}
            <div className="flex items-center justify-between border-b border-line/50 pb-2 mb-2 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-accent/20 text-accent shrink-0">
                  <Sparkles className="h-3 w-3" />
                </span>
                <span className="text-[11px] font-bold text-ink truncate tracking-tight">
                  {displayedItem ? 'Event Inspector' : 'Legends & Details'}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Pin button */}
                <button
                  type="button"
                  onClick={() => setIsPinned(!isPinned)}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-lg border transition-colors cursor-pointer',
                    isPinned
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-line/60 bg-surface-2/60 text-muted hover:text-ink hover:border-accent/40',
                  )}
                  title={isPinned ? 'Unpin legends panel' : 'Keep legends panel pinned open'}
                  aria-label={isPinned ? 'Unpin panel' : 'Pin panel open'}
                >
                  {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                </button>

                {/* Push Pill to Close */}
                <button
                  type="button"
                  onClick={handleManualClose}
                  className="flex items-center gap-1 rounded-lg border border-line/60 bg-surface-2/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-400 transition-all cursor-pointer active:scale-95"
                  title="Close legends panel (or press Esc)"
                  aria-label="Close legends panel"
                >
                  <X className="h-3 w-3" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Close</span>
                </button>
              </div>
            </div>

            {/* 5-Second Linger Countdown Indicator (active when mouse left slot) */}
            {lingerRemaining > 0 && !isSelfHovered && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-accent/15 border border-accent/30 px-2 py-1 text-[9px] text-accent animate-pulse shrink-0">
                <span className="flex items-center gap-1 font-mono font-bold">
                  <Clock className="h-2.5 w-2.5" />
                  Closing in {lingerRemaining}s...
                </span>
                <span className="text-[8px] text-muted font-sans font-medium">Hover panel to keep open</span>
              </div>
            )}

            {/* Tactile Segmented Switcher */}
            <div className="mb-2 flex rounded-xl border border-line/60 bg-surface-2/50 p-0.5 text-[10px] font-bold shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('inspector')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 rounded-lg py-1 transition-all cursor-pointer',
                  activeTab === 'inspector'
                    ? 'bg-surface text-accent shadow-xs border border-line/40'
                    : 'text-muted hover:text-ink',
                )}
              >
                <Info className="h-2.5 w-2.5" />
                <span>Inspect</span>
                {displayedItem && <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('subjects')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 rounded-lg py-1 transition-all cursor-pointer',
                  activeTab === 'subjects'
                    ? 'bg-surface text-accent shadow-xs border border-line/40'
                    : 'text-muted hover:text-ink',
                )}
              >
                <GraduationCap className="h-2.5 w-2.5" />
                <span>Subjects</span>
                <span className="text-[8px] opacity-70 font-mono">({subjects.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('types')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 rounded-lg py-1 transition-all cursor-pointer',
                  activeTab === 'types'
                    ? 'bg-surface text-accent shadow-xs border border-line/40'
                    : 'text-muted hover:text-ink',
                )}
              >
                <Layers className="h-2.5 w-2.5" />
                <span>Types</span>
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-0.5 custom-scrollbar">
              {/* ── TAB 1: INSPECTOR ── */}
              {activeTab === 'inspector' && (
                <div className="space-y-2.5 animate-in fade-in duration-150">
                  {displayedItem && itemData ? (
                    <>
                      {/* Subject & Type Badge */}
                      <div
                        className="rounded-xl border p-2.5 space-y-1 relative overflow-hidden"
                        style={{
                          borderColor: `${itemSubject?.color || itemData.color || '#6366f1'}50`,
                          background: `linear-gradient(to bottom, ${itemSubject?.color || itemData.color || '#6366f1'}15, transparent)`,
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider font-mono shadow-xs border border-white/10"
                            style={{
                              backgroundColor: `${itemSubject?.color || itemData.color || '#6366f1'}35`,
                              color: itemSubject?.color || itemData.color || '#e0e7ff',
                            }}
                          >
                            [{typeBadge.charAt(0)}] {typeBadge}
                          </span>
                          {itemData.room && (
                            <span className="flex items-center gap-0.5 text-[9px] text-muted truncate">
                              <MapPin className="h-2.5 w-2.5 text-accent shrink-0" />
                              <span className="truncate">{itemData.room}</span>
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-ink leading-tight pt-0.5 break-words">
                          {title}
                        </h4>

                        {customTopic && (
                          <p className="text-[11px] font-medium text-accent leading-tight break-words flex items-center gap-1">
                            <span className="text-[9px]">✦</span>
                            <span>{customTopic}</span>
                          </p>
                        )}
                      </div>

                      {/* Timing Details */}
                      <div className="rounded-xl border border-line/60 bg-surface-2/40 p-2 space-y-1.5 text-[10px]">
                        <div className="flex items-center gap-1.5 text-ink/90 font-medium">
                          <Clock className="h-3 w-3 text-accent shrink-0" />
                          <span className="tabular-nums">{timeRange}</span>
                        </div>

                        <div className="flex items-center justify-between text-muted pt-0.5 border-t border-line/40">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted/80 shrink-0" />
                            <span>{dayLabel}</span>
                          </span>
                          {duration && <span className="font-semibold text-accent">{duration}</span>}
                        </div>
                      </div>

                      {/* Fast Focus Button */}
                      <button
                        type="button"
                        onClick={handleStartFocus}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-2.5 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-accent/90 hover:shadow-glow-sm transition-all cursor-pointer active:scale-98"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>Focus on this Class</span>
                      </button>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-line/60 p-4 text-center text-[10px] text-muted space-y-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 mx-auto text-accent">
                        <Info className="h-4 w-4" />
                      </div>
                      <p className="font-medium text-ink/80">No Class Inspected</p>
                      <p className="text-[9px] leading-relaxed">
                        Hover over any slot or event on the timetable grid to inspect details, schedule, and room.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: SUBJECTS ROSTER ── */}
              {activeTab === 'subjects' && (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
                    <span>Classes & Subjects</span>
                    <span className="font-mono text-accent">{subjects.length} active</span>
                  </div>

                  {subjects.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line/60 p-3 text-center text-[10px] text-muted space-y-1">
                      <GraduationCap className="h-4 w-4 mx-auto text-muted/60" />
                      <p>No subjects added yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {subjects.map((s) => {
                        const stat = subjectStats.get(s.id) || { count: 0, totalMin: 0 }
                        const isHighlighted = hoveredSubjectId === s.id
                        const hrs = Math.round((stat.totalMin / 60) * 10) / 10
                        const progressPercent = Math.min(100, Math.round((stat.totalMin / 600) * 100))

                        return (
                          <div
                            key={s.id}
                            onMouseEnter={() => setHoveredSubjectId(s.id)}
                            onMouseLeave={() => setHoveredSubjectId(null)}
                            className={cn(
                              'group flex flex-col gap-1 rounded-xl border p-2 text-left transition-all cursor-pointer',
                              isHighlighted
                                ? 'border-accent bg-accent/15 shadow-sm scale-[1.02]'
                                : 'border-line/50 bg-surface-2/30 hover:border-accent/40 hover:bg-surface-2/60',
                            )}
                            title={`${s.name} · ${stat.count} weekly session${stat.count !== 1 ? 's' : ''} (${hrs}h)`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/20"
                                  style={{ backgroundColor: s.color || '#6366f1' }}
                                />
                                <span className="text-[11px] font-semibold text-ink truncate leading-tight">
                                  {s.name}
                                </span>
                              </div>
                              <span className="text-[9px] font-mono text-accent shrink-0">
                                {hrs}h
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[9px] text-muted pl-4">
                              <span>{stat.count > 0 ? `${stat.count} weekly classes` : 'No slots set'}</span>
                              <ChevronRight className="h-3 w-3 text-muted/40 group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                            </div>

                            {/* Mini Study Load Progress */}
                            <div className="h-1 w-full bg-surface-3 rounded-full overflow-hidden mt-0.5">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${progressPercent}%`,
                                  backgroundColor: s.color || 'var(--accent)',
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 3: TYPE BADGES KEY ── */}
              {activeTab === 'types' && (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted block">
                    Class Type Legend
                  </span>
                  <div className="space-y-1.5 text-[10px]">
                    {TYPE_LEGENDS.map((t) => (
                      <div
                        key={t.badge}
                        className={cn(
                          'flex items-center justify-between gap-1.5 rounded-xl border px-2 py-1.5 transition-colors',
                          t.color,
                        )}
                        title={t.desc}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-extrabold text-[9px] px-1 py-0.5 rounded bg-black/20">
                            [{t.badge}]
                          </span>
                          <span className="truncate text-[10px] font-semibold">{t.label}</span>
                        </div>
                        <span className="text-[8px] text-muted/80 truncate">{t.desc}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-line/40 bg-surface-2/30 p-2 text-[9px] text-muted space-y-1 mt-2">
                    <p className="font-semibold text-ink/80 flex items-center gap-1">
                      <BookOpen className="h-3 w-3 text-accent" />
                      <span>Study Tip</span>
                    </p>
                    <p className="leading-relaxed">
                      Core theory is covered in Lectures. Dedicate Labs and Tutorials to active recall drills.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Hint */}
            <div className="mt-2 border-t border-line/40 pt-1.5 text-[9px] text-muted flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1 truncate">
                <Info className="h-2.5 w-2.5 text-accent shrink-0" />
                <span className="truncate">Esc or push Close to shrink</span>
              </span>
              <span className="font-mono text-[8px] text-muted/70">PRO TRACK</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
