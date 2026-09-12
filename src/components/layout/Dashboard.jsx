import React, { useState, useEffect, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { useFocusEngine } from '@/hooks/useFocusEngine'
import { useConnectivity } from '@/hooks/useConnectivity'
import { useChronoTheme } from '@/hooks/useChronoTheme'
import { useDesktopIntegration } from '@/hooks/useDesktopIntegration'
import { useHabitReminders } from '@/hooks/useHabitReminders'
import { useDeadlines } from '@/hooks/useDeadlines'
import { useNoteReminders } from '@/hooks/useNoteReminders'
import { useCheckIns } from '@/hooks/useCheckIns'
import { useCalendarSync } from '@/hooks/useCalendarSync'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { TimeHud } from '@/components/common/TimeHud'
import { FlipClock } from '@/components/common/FlipClock'
import { ZenOverlay } from '@/components/common/ZenOverlay'
import { DynamicIsland } from '@/components/island/DynamicIsland'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Spinner } from '@/components/ui/Spinner'
import { Sparkles, Layers, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { Logo } from '@/components/common/Logo'
import { getIcon } from '@/lib/icons'
import { updateActiveMode } from '@/services/userService'
import { ModeSwitcher } from './ModeSwitcher'
import { BoardCanvas } from './BoardCanvas'
import { FocusPanel } from '@/components/focus/FocusPanel'
import { FocusMiniOverlay } from '@/components/focus/FocusMiniOverlay'
import { FocusLockScreen } from '@/components/focus/FocusLockScreen'
import { PipFocusWindow } from '@/components/focus/PipFocusWindow'
import { PipAppView } from '@/components/focus/PipAppView'
import { SessionCompleteModal } from '@/components/focus/SessionCompleteModal'
import { HydrationReminder } from '@/components/wellness/HydrationReminder'
import { CenterPrompt } from '@/components/prompt/CenterPrompt'
import { HelpModal } from '@/components/common/HelpModal'
import { WhatsNewModal } from '@/components/common/WhatsNewModal'
import { useHourlyChime } from '@/hooks/useHourlyChime'
import { useAlarmWatcher } from '@/hooks/useAlarmWatcher'
import { AlarmModal } from '@/components/alarm/AlarmModal'
import { AlarmRingingBanner } from '@/components/alarm/AlarmRingingBanner'
import { WeatherPlaygroundModal } from '@/components/common/weather/WeatherPlaygroundModal'
import {
  INDIAN_SEASONS,
  getSeasonOverride,
  setSeasonOverride,
  getCurrentSeason,
} from '@/lib/indianClimate'
import { HelpCircle } from 'lucide-react'

const SettingsPanel = React.lazy(() =>
  import('@/components/settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel }))
)
const AIAssistant = React.lazy(() =>
  import('@/components/ai/AIAssistant').then((m) => ({ default: m.AIAssistant }))
)
const BackgroundHandsFree = React.lazy(() =>
  import('@/components/ai/BackgroundHandsFree').then((m) => ({ default: m.BackgroundHandsFree }))
)
const SupportModal = React.lazy(() =>
  import('@/components/support/SupportModal').then((m) => ({ default: m.SupportModal }))
)
import aiGif from '@/assets/ai.gif'
import { APP_VERSION } from '@/lib/version'
import { exitPip } from '@/lib/pip'
import { cn } from '@/utils/cn'

/**
 * The single unified dashboard — everything lives here. No nested routing.
 */
export function Dashboard() {
  const { user } = useAuth()
  const modesLoading = useStore((s) => s.modesLoading)
  const setAiOpen = useStore((s) => s.setAiOpen)
  const supportOpen = useStore((s) => s.supportOpen)
  const setSupportOpen = useStore((s) => s.setSupportOpen)
  const fullscreen = useStore((s) => s.fullscreen)
  const focusLocked = useStore((s) => s.focusLocked)
  const pipActive = useStore((s) => s.pipActive)
  const immersive = useStore((s) => s.status === 'running')
  const firstName = (user?.displayName || 'Explorer').split(' ')[0]
  const handsFreeActive = useStore((s) => s.handsFreeActive)
  const setHandsFreeActive = useStore((s) => s.setHandsFreeActive)
  const handsFreeStatus = useStore((s) => s.handsFreeStatus)
  const handsFreeFeedback = useStore((s) => s.handsFreeFeedback)
  const clockCentered = useStore((s) => s.clockCentered)
  const alarmModalOpen = useStore((s) => s.alarmModalOpen)
  const setAlarmModalOpen = useStore((s) => s.setAlarmModalOpen)
  const scopeDropdownOpen = useStore((s) => s.scopeDropdownOpen)
  const [helpOpen, setHelpOpen] = useState(false)
  const [weatherPlaygroundOpen, setWeatherPlaygroundOpen] = useState(false)
  const helpOpenRef = useRef(helpOpen)
  useEffect(() => {
    helpOpenRef.current = helpOpen
  }, [helpOpen])
  // Mirrored into a ref for the same reason as helpOpenRef above: the global
  // keydown listener below is attached once ([] deps) so it can't see fresh
  // state directly — without this, Escape could never close the Weather
  // Playground modal (the check would always read the initial `false`).
  const weatherPlaygroundOpenRef = useRef(weatherPlaygroundOpen)
  useEffect(() => {
    weatherPlaygroundOpenRef.current = weatherPlaygroundOpen
  }, [weatherPlaygroundOpen])

  const clickCountRef = useRef(0)
  const clickTimerRef = useRef(null)

  const handleAiButtonClick = () => {
    clickCountRef.current += 1
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)

    clickTimerRef.current = setTimeout(() => {
      if (clickCountRef.current === 1) {
        if (handsFreeActive) {
          setHandsFreeActive(false)
        } else {
          setAiOpen(true)
        }
      } else if (clickCountRef.current >= 2) {
        if (handsFreeActive) {
          setHandsFreeActive(false)
        } else {
          setAiOpen(false)
          setHandsFreeActive(true)
        }
      }
      clickCountRef.current = 0
    }, 250)
  }

  useFocusEngine() // drives the Pomodoro tick, sound, notifications, and stats
  useConnectivity() // sync status surfaced via the Dynamic Island; writes replay on reconnect
  useChronoTheme() // time-of-day palette/shadow modulation (data-chrono band)
  useDesktopIntegration() // desktop-only: hardware-fingerprint binding + global hotkeys
  useHabitReminders() // schedules per-interval reminder notifications for habits
  useDeadlines()     // fires island notifications for overdue/due-today todos
  useNoteReminders() // fires reminders for notes with a deadline (2 days ahead)
  useCheckIns()      // offers the occasional daily check-in question (lib/checkin)
  useCalendarSync()  // two-way Google Calendar sync while the app is open (P2)
  useHourlyChime()   // rings temple bell on every :00 and pushes mindful island pill
  useAlarmWatcher()  // monitors scheduled alarms and triggers audio + visual overlay

  // In-app keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const st = useStore.getState()
      const isTyping =
        e.target &&
        (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.tagName === 'SELECT' ||
          Boolean(e.target.isContentEditable))

      // When focus is locked, block almost everything
      if (st.focusLocked) {
        if (st.pipActive && e.key === 'Escape') {
          exitPip()
          return
        }
        // Allow Escape only to trigger the quit confirmation (handled by FocusWidget)
        if (e.key === 'Escape') return
        // Block Ctrl+K, F, and other navigation shortcuts
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault()
          return
        }
        if (e.key.toLowerCase() === 'f' && !isTyping) {
          e.preventDefault()
          return
        }
        return
      }

      // ── Escape: dismiss overlays, help modal, panels, maximized widgets ──
      if (e.key === 'Escape') {
        if (helpOpenRef.current) {
          setHelpOpen(false)
          return
        }
        if (weatherPlaygroundOpenRef.current) setWeatherPlaygroundOpen(false)
        else if (st.alarmModalOpen) st.setAlarmModalOpen(false)
        else if (st.clockCentered) st.setClockCentered(false)
        else if (st.focusContext) st.closeFocus()
        else if (st.whatsNewOpen) st.setWhatsNewOpen(false)
        else if (st.aiOpen) st.setAiOpen(false)
        else if (st.settingsOpen) st.setSettingsOpen(false)
        else if (st.supportOpen) st.setSupportOpen(false)
        else if (st.maximizedWidgetId) st.restoreWidgets()
        else if (st.fullscreen) window.protrack?.window?.toggleFullScreen?.()
        return
      }

      // ── Ctrl / Cmd + , : Open or close Settings ──
      if ((e.metaKey || e.ctrlKey) && (e.key === ',' || e.key === '<')) {
        e.preventDefault()
        st.setSettingsOpen((prev) => !prev)
        return
      }

      // ── Ctrl / Cmd + M : Toggle Audio Mute ──
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        st.toggleMute?.()
        return
      }

      // ── Ctrl / Cmd + B : Toggle Workspaces Bottom Dock ──
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('protrack:toggle-bottom-dock'))
        return
      }

      // ── Alt + T : Cycle Seasonal Theme ──
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        const seasons = ['vasant', 'grishma', 'varsha', 'sharad', 'hemant', 'shishir']
        const current = getSeasonOverride() || getCurrentSeason()?.id || 'vasant'
        const nextIdx = (seasons.indexOf(current) + 1) % seasons.length
        const nextSeason = seasons[nextIdx]
        setSeasonOverride(nextSeason)
        const sObj = INDIAN_SEASONS.find((s) => s.id === nextSeason)
        toast.success(`Theme cycled to ${sObj?.sanskritName} (${sObj?.hindiName})`, { icon: '🌸' })
        return
      }

      // ── Alt + W : Weather Sandbox & Atmospheric Playground ──
      if (e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        setWeatherPlaygroundOpen((prev) => !prev)
        return
      }

      // ── Alt + A : Set Alarm / Reminder (works in Normal Mode and Centered Desk Clock Mode) ──
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        st.setAlarmModalOpen((prev) => !prev)
        return
      }

      // ── ? : toggle shortcuts modal open AND close ──
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault()
        setHelpOpen((prev) => !prev)
        return
      }

      // ── Ctrl / Cmd + T : Center clock (Zen mode) ──
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        if (isTyping) return
        e.preventDefault()
        st.toggleClockCentered()
        return
      }

      // ── Ctrl / Cmd + K : Open AI companion ──
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        st.setAiOpen(true)
        return
      }

      // Single-letter or Alt-prefixed shortcuts (suppressed while typing)
      if (isTyping && !e.altKey) return
      if (e.metaKey || e.ctrlKey) return

      const k = e.key.toLowerCase()

      // ── F : Fullscreen ──
      if (k === 'f' && !e.altKey) {
        if (st.fullscreen || st.status === 'idle') {
          e.preventDefault()
          window.protrack?.window?.toggleFullScreen?.()
        }
        return
      }

      // ── T : Add To-Do (opens/maximizes todos and focuses task input) ──
      if (k === 't') {
        e.preventDefault()
        if (st.maximizedWidgetId && st.maximizedWidgetId !== 'todos') {
          st.maximizeWidget('todos')
        } else if (!st.maximizedWidgetId) {
          const input = document.querySelector('[data-todo-input="true"]')
          if (!input) {
            st.openModule('todos')
          }
        }
        setTimeout(() => {
          const input = document.querySelector('[data-todo-input="true"]')
          if (input) {
            input.focus()
            input.select?.()
          }
        }, 50)
        return
      }

      // ── C : Calendar & Timetable ──
      if (k === 'c') {
        e.preventDefault()
        st.toggleWidget('timetable')
        return
      }

      // ── D : Deep Focus ──
      if (k === 'd') {
        e.preventDefault()
        st.toggleWidget('focus')
        return
      }

      // ── N : Notes ──
      if (k === 'n') {
        e.preventDefault()
        st.toggleWidget('notes')
        return
      }

      // ── S : Subjects ──
      if (k === 's') {
        e.preventDefault()
        st.toggleWidget('subjects')
        return
      }

      // ── E / X : Scorecard ──
      if (k === 'e' || k === 'x') {
        e.preventDefault()
        st.toggleWidget('scorecard')
        return
      }

      // ── M : Maximize / Restore (/ Maxm) ──
      if (k === 'm') {
        e.preventDefault()
        if (st.maximizedWidgetId) {
          st.restoreWidgets()
        } else {
          st.maximizeWidget(st.activeWidgetId || 'timetable')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // In desktop Electron, entering PiP morphs the single native window down to a
  // small always-on-top square at the screen corner (electron/main.js `pip:enter`).
  // Render only the dedicated PiP view + the scene-audio player.
  // The scene <iframe> lives in <FocusSceneVideo/> at the workspace root — it
  // stays mounted through this branch, so entering/leaving PiP never reloads it.
  if (typeof window !== 'undefined' && window.protrack?.isDesktop && pipActive) {
    return (
      <div className="relative h-screen w-screen overflow-hidden select-none bg-slate-950 font-sans text-white antialiased">
        <PipAppView />
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      <AuroraBackground />
      <ZenOverlay />
      <TimeHud />
      <FlipClock />
      <DynamicIsland />

      {/* Focus Lock Screen — full-viewport overlay when session is active */}
      <FocusLockScreen />

      {/* Normal dashboard content — hidden when focus is locked */}
      {!focusLocked && (
        <>
          <div className={cn(
            "flex h-full w-full flex-col transition-all duration-300",
            fullscreen ? "px-5 py-3.5" : "px-3.5 py-3 sm:px-4 lg:px-5"
          )}>
            {/* User Profile / Welcome Section & Selected Scope — fixed on the top left */}
            <div className={cn(
              "fixed left-3.5 top-3.5 z-20 flex flex-col gap-1.5 select-none transition-opacity duration-300",
              clockCentered && "opacity-30 pointer-events-none"
            )}>
              <div className="flex items-center gap-3">
                <Logo className="h-10 w-10 shrink-0 drop-shadow-sm" />
                <DynamicBranding firstName={firstName} displayName={user?.displayName} />
              </div>
              <div className="pl-[52px]">
                <SelectedScopeIndicator />
              </div>
            </div>

            {/* Floating scope switcher — fixed on the far left, vertically centered */}
            <div className={cn(
              "fixed left-3 top-1/2 z-20 -translate-y-1/2 transition-all duration-300",
              clockCentered && "opacity-20 pointer-events-none",
              scopeDropdownOpen && "opacity-0 pointer-events-none -translate-x-12 scale-95"
            )}>
              <ModeSwitcher vertical />
            </div>

            {/* Main workspace containers A (Timetable, To-dos, Bottom Dock) — disappears on Ctrl+T */}
            <main
              className={cn(
                "min-h-0 flex-1 pl-16 sm:pl-64 lg:pl-[272px] pr-8 sm:pr-14 lg:pr-[6%] transition-all duration-500 ease-out",
                clockCentered && "pointer-events-none opacity-0 scale-[0.97]"
              )}
            >
              {modesLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : (
                <ErrorBoundary>
                  <BoardCanvas />
                </ErrorBoundary>
              )}
            </main>
          </div>

          {/* Floating AI companion — recedes into a minimal trigger during focus or clock mode */}
          <motion.button
            onClick={handleAiButtonClick}
            animate={{
              scale: clockCentered ? 0.7 : (immersive ? 0.82 : 1),
              opacity: clockCentered ? 0 : (immersive ? 0.45 : 1),
              pointerEvents: clockCentered ? 'none' : 'auto',
            }}
            whileHover={{ scale: immersive ? 0.95 : 1.05, opacity: 1 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={cn(
              "fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center shadow-glow overflow-hidden transition-all duration-300",
              handsFreeActive
                ? "rounded-full border-2 border-red-500 bg-surface-2"
                : "rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white"
            )}
            title="AI Companion (Double-click to start Hands-Free)"
            aria-label={handsFreeActive ? "Hands-free loop running" : "Open AI companion"}
          >
            {handsFreeActive ? (
              <img
                src={aiGif}
                alt="Hands-Free Active"
                className="h-full w-full object-cover select-none pointer-events-none rounded-full"
              />
            ) : (
              <Sparkles className="h-6 w-6" />
            )}
          </motion.button>

          {/* Transparent hands-free bubble above the button */}
          <AnimatePresence>
            {handsFreeActive && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="fixed bottom-24 right-6 z-30 w-80 max-w-sm rounded-2xl border border-line bg-surface/85 shadow-glass backdrop-blur-md p-3.5 flex flex-col gap-1.5 text-left"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                    <span className={cn(
                      "h-2 w-2 rounded-full",
                      handsFreeStatus === 'listening' ? "bg-red-500 animate-pulse shadow-glow-sm" :
                      handsFreeStatus === 'thinking' ? "bg-amber-400 animate-ping" :
                      handsFreeStatus === 'speaking' ? "bg-accent animate-bounce" : "bg-muted"
                    )} />
                    Hands-Free: {handsFreeStatus}
                  </span>
                  <span className="text-[9px] text-muted font-semibold">Double-click to exit</span>
                </div>
                
                {handsFreeFeedback ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-muted line-clamp-1 italic">
                      User: "{handsFreeFeedback.userText}"
                    </p>
                    <p className="text-[11px] font-semibold text-accent leading-relaxed">
                      {handsFreeFeedback.replyText}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted leading-relaxed">
                    Continuous voice loop active. Speak commands (e.g. "Add todo to study").
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <FocusPanel />
      <FocusMiniOverlay />
      <PipFocusWindow />
      <SessionCompleteModal />
      <HydrationReminder />
      <CenterPrompt />

      {/* Shortcuts / commands — transparent ? button, clear of the window's
          title-bar controls (sits below them). */}
      {!focusLocked && !clockCentered && (
        <button
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          title="Shortcuts & commands ( ? )"
          aria-label="Open shortcuts and commands"
          className={cn(
            'fixed right-3.5 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-line/50 bg-surface/40 text-muted backdrop-blur-md transition-colors hover:border-accent/50 hover:text-ink',
            typeof window !== 'undefined' && window.protrack?.isDesktop && !fullscreen ? 'top-12' : 'top-4',
          )}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      )}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <WhatsNewModal />
      <AlarmModal open={alarmModalOpen} onClose={() => setAlarmModalOpen(false)} />
      <AlarmRingingBanner />
      <WeatherPlaygroundModal open={weatherPlaygroundOpen} onClose={() => setWeatherPlaygroundOpen(false)} />

      <Suspense fallback={null}>
        <AIAssistant />
        {handsFreeActive && <BackgroundHandsFree />}
        <SettingsPanel />
        {supportOpen && <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />}
      </Suspense>
    </div>
  )
}


/**
 * Dynamic branding component.
 * Displays "PRO TRACK Workspace" with version badge initially.
 * After a pause (3.5s), it deletes "PRO TRACK" character-by-character
 * like a typewriter, and types out "{userName} Workspace", staying permanently.
 */
function DynamicBranding({ firstName, displayName }) {
  const brandText = "PRO TRACK"
  const userText = displayName?.trim() || firstName || "Explorer"

  const [text, setText] = useState(brandText)
  const [phase, setPhase] = useState('brand') // 'brand' | 'deleting' | 'typing' | 'done'

  useEffect(() => {
    if (phase === 'brand') {
      const timer = setTimeout(() => {
        setPhase('deleting')
      }, 3500)
      return () => clearTimeout(timer)
    }

    if (phase === 'deleting') {
      if (text.length > 0) {
        const timer = setTimeout(() => {
          setText((prev) => prev.slice(0, -1))
        }, 40)
        return () => clearTimeout(timer)
      } else {
        setPhase('typing')
      }
    }

    if (phase === 'typing') {
      if (text.length < userText.length) {
        const timer = setTimeout(() => {
          setText(userText.slice(0, text.length + 1))
        }, 80)
        return () => clearTimeout(timer)
      } else {
        setPhase('done')
      }
    }
  }, [phase, text, userText])

  const replay = () => {
    if (phase === 'done') {
      setText(brandText)
      setPhase('brand')
    }
  }

  return (
    <div
      onClick={replay}
      className="flex flex-col justify-center select-none cursor-default"
      title={phase === 'done' ? 'Click to replay branding animation' : undefined}
    >
      <h1 className="text-lg font-bold tracking-wide text-ink leading-none flex items-center gap-2 font-display">
        {text}
        {(phase === 'brand' || phase === 'done') && (
          <span className="rounded-md border border-accent/40 bg-accent/20 px-2 py-0.5 font-mono text-[11px] font-bold text-accent tracking-wide shadow-sm">
            v{APP_VERSION}
          </span>
        )}
        {(phase === 'deleting' || phase === 'typing') && (
          <span className="inline-block w-[2px] h-[1em] bg-accent animate-pulse" />
        )}
      </h1>
      <p className="text-[10px] font-semibold text-muted uppercase tracking-widest leading-none mt-1 min-h-[10px]">
        Workspace
      </p>
    </div>
  )
}

/**
 * Prominently displays the currently selected execution scope (mode)
 * on the dashboard with a live indicator, mode accent tint, and quick switcher dropdown.
 */
function SelectedScopeIndicator() {
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const setActiveModeId = useStore((s) => s.setActiveModeId)
  const { user } = useAuth()
  const dropdownOpen = useStore((s) => s.scopeDropdownOpen)
  const setDropdownOpen = useStore((s) => s.setScopeDropdownOpen)
  const dropdownRef = useRef(null)

  const activeMode = modes.find((m) => m.id === activeModeId) || 
    (activeModeId === 'all' ? { id: 'all', name: 'All Scopes', icon: 'Layers', accentColor: '#6366f1' } : null)

  const scopeName = activeMode ? activeMode.name : 'No Scope'
  const accentColor = activeMode?.accentColor || 'rgb(var(--accent))'
  const Icon = activeMode ? getIcon(activeMode.icon) : Layers

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen, setDropdownOpen])

  const handleSelectScope = async (mode) => {
    setDropdownOpen(false)
    if (mode.id === activeModeId) return
    if (user?.uid) {
      try {
        await updateActiveMode(user.uid, mode.id)
      } catch (err) {
        console.warn('[scope] update active mode failed:', err)
      }
    }
    setActiveModeId(mode.id)
    toast.success(`Switched scope to ${mode.name}`, { icon: '🎯' })
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Scope Pill */}
      <button
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-2xl border border-line/70 bg-surface/85 px-3 py-1.5 shadow-glass backdrop-blur-xl transition-all duration-200 hover:scale-[1.02] hover:border-accent/50 hover:bg-surface group cursor-pointer text-left select-none"
        title={`Current Scope: ${scopeName} · Click to switch`}
        aria-label={`Current execution scope: ${scopeName}`}
      >
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 shadow-sm"
          style={{ backgroundColor: `${accentColor}26`, color: accentColor }}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col min-w-0 pr-0.5">
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted/80 leading-none">
              Selected Scope
            </span>
          </div>
          <span
            className="text-xs font-bold leading-tight truncate max-w-[140px]"
            style={{ color: accentColor }}
          >
            {scopeName}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted/70 transition-transform duration-200 group-hover:text-ink',
            dropdownOpen && 'rotate-180 text-accent'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 z-50 w-56 rounded-2xl border border-line/70 bg-surface/95 p-1.5 shadow-glass backdrop-blur-2xl"
          >
            <div className="px-2.5 py-1.5 border-b border-line/40 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Switch Execution Scope
              </span>
            </div>

            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-0.5">
              <button
                type="button"
                onClick={() => handleSelectScope({ id: 'all', name: 'All Scopes' })}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all text-left w-full',
                  activeModeId === 'all'
                    ? 'bg-accent/15 text-accent font-bold'
                    : 'text-ink/80 hover:bg-surface-2 hover:text-ink'
                )}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Layers className="h-3 w-3" />
                </div>
                <span className="truncate flex-1">All Scopes</span>
                {activeModeId === 'all' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </button>

              {modes.map((mode) => {
                const ModeIcon = getIcon(mode.icon)
                const isCurrent = mode.id === activeModeId
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleSelectScope(mode)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all text-left w-full',
                      isCurrent
                        ? 'bg-accent/15 text-accent font-bold'
                        : 'text-ink/80 hover:bg-surface-2 hover:text-ink'
                    )}
                  >
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `${mode.accentColor || '#6366f1'}20`,
                        color: mode.accentColor || '#6366f1',
                      }}
                    >
                      <ModeIcon className="h-3 w-3" />
                    </div>
                    <span className="truncate flex-1">{mode.name}</span>
                    {isCurrent && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: mode.accentColor || 'var(--accent)' }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
