import React, { useState, useEffect, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { useFocusEngine } from '@/hooks/useFocusEngine'
import { useModeAccent } from '@/hooks/useModeAccent'
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
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Logo } from '@/components/common/Logo'
import { ModeSwitcher } from './ModeSwitcher'
import { BoardCanvas } from './BoardCanvas'
import { FocusPanel } from '@/components/focus/FocusPanel'
import { FocusMiniOverlay } from '@/components/focus/FocusMiniOverlay'
import { FocusLockScreen } from '@/components/focus/FocusLockScreen'
import { PipFocusWindow } from '@/components/focus/PipFocusWindow'
import { FloatingFocusPip } from '@/components/focus/FloatingFocusPip'
import { PipAppView } from '@/components/focus/PipAppView'
import { SessionCompleteModal } from '@/components/focus/SessionCompleteModal'
import { HydrationReminder } from '@/components/wellness/HydrationReminder'
import { CenterPrompt } from '@/components/prompt/CenterPrompt'

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
import { DEFAULT_FOCUS_SCENE, youtubeId, buildSceneEmbedUrl } from '@/lib/focusScenes'
import { exitPip } from '@/lib/pip'
import { useYouTubeVolume } from '@/hooks/useYouTubeVolume'
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
  useModeAccent() // re-tints the whole UI to the active mode's accent color
  useConnectivity() // sync status surfaced via the Dynamic Island; writes replay on reconnect
  useChronoTheme() // time-of-day palette/shadow modulation (data-chrono band)
  useDesktopIntegration() // desktop-only: hardware-fingerprint binding + global hotkeys
  useHabitReminders() // schedules per-interval reminder notifications for habits
  useDeadlines()     // fires island notifications for overdue/due-today todos
  useNoteReminders() // fires reminders for notes with a deadline (2 days ahead)
  useCheckIns()      // offers the occasional daily check-in question (lib/checkin)
  useCalendarSync()  // two-way Google Calendar sync while the app is open (P2)

  // Global shortcuts: Esc unwinds overlays/maximize; ⌘/Ctrl+K opens the AI.
  // When focus is locked, suppress all shortcuts except focus-related ones.
  useEffect(() => {
    const onKey = (e) => {
      const st = useStore.getState()

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
        if (e.key.toLowerCase() === 'f' && !e.target.tagName.match(/INPUT|TEXTAREA/) && !e.target.isContentEditable) {
          e.preventDefault()
          return
        }
        return
      }

      if (e.key === 'Escape') {
        if (st.focusContext) st.closeFocus()
        else if (st.aiOpen) st.setAiOpen(false)
        else if (st.settingsOpen) st.setSettingsOpen(false)
        else if (st.supportOpen) st.setSupportOpen(false)
        else if (st.maximizedWidgetId) st.restoreWidgets()
        else if (st.fullscreen) window.protrack?.window?.toggleFullScreen?.()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useStore.getState().setAiOpen(true)
      }
      if (e.key.toLowerCase() === 'f') {
        if (st.fullscreen || st.status === 'idle') {
          if (
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.isContentEditable
          ) {
            return
          }
          e.preventDefault()
          window.protrack?.window?.toggleFullScreen?.()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // In desktop Electron, entering PiP morphs the native window down to a 300x380
  // always-on-top box at the screen corner. Render the dedicated PiP view directly.
  if (typeof window !== 'undefined' && window.protrack?.isDesktop && pipActive) {
    return (
      <div className="relative h-screen w-screen overflow-hidden select-none bg-slate-950 font-sans text-white antialiased">
        <PipAppView />
        <BackgroundAudioPlayer />
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
            "mx-auto flex h-full w-full flex-col transition-all duration-300",
            fullscreen ? "max-w-7xl px-6 py-4" : "max-w-7xl px-4 py-4 sm:px-6"
          )}>
            {/* User Profile / Welcome Section — fixed on the top left */}
            <div className="fixed left-3.5 top-3.5 z-20 flex items-center gap-3 select-none">
              <Logo className="h-10 w-10 shrink-0 drop-shadow-sm" />
              <DynamicBranding firstName={firstName} displayName={user?.displayName} />
            </div>

            {/* Floating scope switcher — fixed on the far left, vertically centered */}
            <div className="fixed left-3 top-1/2 z-20 -translate-y-1/2">
              <ModeSwitcher vertical />
            </div>

            <main className="min-h-0 flex-1 pl-16">
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

          {/* Floating AI companion — recedes into a minimal trigger during focus */}
          <motion.button
            onClick={handleAiButtonClick}
            animate={{
              scale: immersive ? 0.82 : 1,
              opacity: immersive ? 0.45 : 1,
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
      <FloatingFocusPip />
      <SessionCompleteModal />
      <HydrationReminder />
      <CenterPrompt />
      <BackgroundAudioPlayer />

      <Suspense fallback={null}>
        <AIAssistant />
        {handsFreeActive && <BackgroundHandsFree />}
        <SettingsPanel />
        {supportOpen && <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />}
      </Suspense>
    </div>
  )
}

function BackgroundAudioPlayer() {
  const status = useStore((s) => s.status)
  const userFocusAudioUrl = useStore((s) => s.settings?.focusAudioUrl || '')
  const volume = useStore((s) => s.volume)
  const muted = useStore((s) => s.muted)
  const focusLocked = useStore((s) => s.focusLocked)
  const pipActive = useStore((s) => s.pipActive)
  const focusVideoEnabled = useStore((s) => s.settings?.focusVideoEnabled !== false)
  const iframeRef = useRef(null)
  const audioRef = useRef(null)

  const onIframeLoad = useYouTubeVolume(iframeRef, volume, muted)

  // Use default scene if no user preference is set
  const focusAudioUrl = userFocusAudioUrl || DEFAULT_FOCUS_SCENE.url

  // Audio plays only while session is actively running, scene is enabled and unmuted
  if (status !== 'running' || !focusAudioUrl || muted || !focusVideoEnabled) return null

  const videoId = youtubeId(focusAudioUrl)

  // When FocusLockScreen is actively showing the video iframe (which also carries audio),
  // this hidden player would duplicate playback — skip it. When in PiP mode, FocusLockScreen
  // is unmounted, so this player keeps the scene audio playing seamlessly.
  if (focusLocked && !pipActive && focusVideoEnabled && videoId) return null

  if (videoId) {
    const embedUrl = buildSceneEmbedUrl(videoId)
    return (
      <iframe
        key={videoId}
        ref={iframeRef}
        src={embedUrl}
        onLoad={onIframeLoad}
        className="sr-only pointer-events-none"
        allow="autoplay"
        title="Background Audio Stream"
        style={{ width: 1, height: 1, border: 0 }}
      />
    )
  }

  return (
    <audio
      ref={(el) => {
        audioRef.current = el
        if (el) el.volume = volume ?? 0.5
      }}
      src={focusAudioUrl}
      autoPlay
      loop
      className="sr-only"
    />
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
