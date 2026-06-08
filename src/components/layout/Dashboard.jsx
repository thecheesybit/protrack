import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { useFocusEngine } from '@/hooks/useFocusEngine'
import { useModeAccent } from '@/hooks/useModeAccent'
import { useConnectivity } from '@/hooks/useConnectivity'
import { useChronoTheme } from '@/hooks/useChronoTheme'
import { useDesktopIntegration } from '@/hooks/useDesktopIntegration'
import { useHabitReminders } from '@/hooks/useHabitReminders'
import { useDeadlines } from '@/hooks/useDeadlines'
import { AuroraBackground } from '@/components/common/AuroraBackground'
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
import { AIAssistant } from '@/components/ai/AIAssistant'
import { BackgroundHandsFree } from '@/components/ai/BackgroundHandsFree'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { HydrationReminder } from '@/components/wellness/HydrationReminder'
import { SupportModal } from '@/components/support/SupportModal'
import aiGif from '@/assets/ai.gif'
import { APP_VERSION } from '@/lib/version'
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

  // Global shortcuts: Esc unwinds overlays/maximize; ⌘/Ctrl+K opens the AI.
  // When focus is locked, suppress all shortcuts except focus-related ones.
  useEffect(() => {
    const onKey = (e) => {
      const st = useStore.getState()

      // When focus is locked, block almost everything
      if (st.focusLocked) {
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

  return (
    <div className="relative flex h-full flex-col">
      <AuroraBackground />
      <ZenOverlay />
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
              <DynamicBranding firstName={firstName} />
            </div>

            {/* Floating scope switcher — fixed on the far left, vertically centered */}
            <div className="fixed left-3 top-1/2 z-20 -translate-y-1/2">
              <ModeSwitcher vertical />
            </div>

            <main className="min-h-0 flex-1 pl-14">
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
      <AIAssistant />
      <BackgroundHandsFree />
      <SettingsPanel />
      <HydrationReminder />
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
      <BackgroundAudioPlayer />
    </div>
  )
}

const YT_PATTERN = /(?:youtube\.fr\/|youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i

function BackgroundAudioPlayer() {
  const status = useStore((s) => s.status)
  const focusAudioUrl = useStore((s) => s.settings?.focusAudioUrl || '')
  const muted = useStore((s) => s.muted)
  const volume = useStore((s) => s.volume)
  const focusLocked = useStore((s) => s.focusLocked)
  const focusVideoEnabled = useStore((s) => s.settings?.focusVideoEnabled !== false)
  const iframeRef = useRef(null)
  const audioRef = useRef(null)

  if (status !== 'running' || !focusAudioUrl || muted) return null

  const youtubeMatch = focusAudioUrl.match(YT_PATTERN)

  // When FocusLockScreen is showing the video iframe (which also carries audio),
  // this hidden player would duplicate playback — skip it.
  if (focusLocked && focusVideoEnabled && youtubeMatch) return null

  if (youtubeMatch) {
    const videoId = youtubeMatch[1]
    // mute=1: cross-origin iframes block unmuted autoplay independently of the
    // main window's autoplayPolicy. Starting muted guarantees playback; YTVolumeSync
    // sends unMute via the IFrame API once onReady fires.
    // For production (HTTPS), add origin; for Electron (file://), omit to avoid rejection.
    const isElectron = __IS_ELECTRON__
    const originParam = !isElectron && typeof window !== 'undefined'
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : ''
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&enablejsapi=1${originParam}`
    return (
      <YTVolumeSync iframeRef={iframeRef} volume={volume}>
        <iframe
          ref={iframeRef}
          src={embedUrl}
          sandbox="allow-scripts allow-same-origin allow-presentation"
          className="sr-only pointer-events-none"
          allow="autoplay"
          title="Background Audio Stream"
          style={{ width: 1, height: 1, border: 0 }}
        />
      </YTVolumeSync>
    )
  }

  return (
    <AudioVolumeSync audioRef={audioRef} volume={volume}>
      <audio
        ref={audioRef}
        src={focusAudioUrl}
        autoPlay
        loop
        className="sr-only"
      />
    </AudioVolumeSync>
  )
}

/** Syncs volume to YouTube iframe via the IFrame Player API postMessage protocol. */
function YTVolumeSync({ iframeRef, volume, children }) {
  const apiReadyRef = useRef(false)

  const postCommand = useCallback((func, args = []) => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        'https://www.youtube.com',
      )
    } catch {
      /* cross-origin until YT API initialises */
    }
  }, [iframeRef])

  const postVolume = useCallback((vol) => {
    postCommand('setVolume', [Math.round(vol * 100)])
    // unMute explicitly — embed starts muted (mute=1) for reliable autoplay;
    // this is the only way to restore audio without reloading the iframe.
    postCommand('unMute')
  }, [postCommand])

  // Listen for the YT API ready signal, then sync the current volume
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== 'https://www.youtube.com') return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data?.event === 'onReady') {
          apiReadyRef.current = true
          postVolume(volume)
        }
      } catch { /* not JSON */ }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [volume, postVolume])

  // On iframe load, register the listener with the YT IFrame API
  const handleLoad = () => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    try {
      iframe.contentWindow.postMessage(JSON.stringify({
        event: 'listening',
        id: 1,
        channel: 'widget',
      }), 'https://www.youtube.com')
    } catch { /* noop */ }
  }

  useEffect(() => {
    if (apiReadyRef.current) postVolume(volume)
  }, [volume, postVolume])

  return React.cloneElement(children, { onLoad: handleLoad })
}

/** Syncs volume to a regular <audio> element */
function AudioVolumeSync({ audioRef, volume, children }) {
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume, audioRef])
  return children
}

/**
 * Dynamic welcome branding component.
 * Displays "Welcome back, {firstName}", then deletes it after 3.5 seconds
 * and types out "PRO TRACK" letter-by-letter, which stays permanently.
 */
function DynamicBranding({ firstName }) {
  const welcomeText = `Welcome back, ${firstName}`
  const brandText = "PRO TRACK"

  const [text, setText] = useState(welcomeText)
  const [phase, setPhase] = useState('welcome') // 'welcome' | 'deleting' | 'typing' | 'done'

  useEffect(() => {
    if (phase === 'welcome') {
      const timer = setTimeout(() => {
        setPhase('deleting')
      }, 3500)
      return () => clearTimeout(timer)
    }

    if (phase === 'deleting') {
      if (text.length > 0) {
        const timer = setTimeout(() => {
          setText((prev) => prev.slice(0, -1))
        }, 30)
        return () => clearTimeout(timer)
      } else {
        setPhase('typing')
      }
    }

    if (phase === 'typing') {
      if (text.length < brandText.length) {
        const timer = setTimeout(() => {
          setText(brandText.slice(0, text.length + 1))
        }, 85)
        return () => clearTimeout(timer)
      } else {
        setPhase('done')
      }
    }
  }, [phase, text, firstName])

  const showWelcomeLayout = phase === 'welcome' || (phase === 'deleting' && text.length > 0 && !text.startsWith('PRO'))

  if (showWelcomeLayout) {
    const commaIndex = text.indexOf(',')
    const line1 = commaIndex !== -1 ? text.slice(0, commaIndex) : text
    const line2 = commaIndex !== -1 ? text.slice(commaIndex + 1).trim() : ''

    return (
      <div className="flex flex-col justify-center select-none">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider leading-none mb-1 flex items-center gap-1.5">
          {line1}
          {line1.toLowerCase().includes('welcome') && (
            <span className="rounded bg-accent/10 px-1 py-0.2 text-[9px] font-bold text-accent normal-case tracking-normal">
              v{APP_VERSION}
            </span>
          )}
        </p>
        <h1 className="text-base font-bold tracking-tight text-ink leading-none min-h-[1.25rem]">
          {line2}
        </h1>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-center select-none">
      <h1 className="text-base font-extrabold tracking-wide text-ink leading-none flex items-center gap-1.5 font-sans">
        {text}
        {phase === 'done' && (
          <span className="rounded bg-accent/10 px-1 py-0.2 text-[9px] font-bold text-accent normal-case tracking-normal">
            v{APP_VERSION}
          </span>
        )}
        {phase === 'typing' && (
          <span className="inline-block w-[2px] h-[1em] bg-accent animate-pulse" />
        )}
      </h1>
      <p className="text-[9px] font-medium text-muted uppercase tracking-widest leading-none mt-1 min-h-[9px]">
        {phase === 'done' ? 'Workspace' : ''}
      </p>
    </div>
  )
}
