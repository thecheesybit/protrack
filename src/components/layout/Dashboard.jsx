import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { useFocusEngine } from '@/hooks/useFocusEngine'
import { useModeAccent } from '@/hooks/useModeAccent'
import { useAutoHideChrome } from '@/hooks/useAutoHideChrome'
import { useConnectivity } from '@/hooks/useConnectivity'
import { useChronoTheme } from '@/hooks/useChronoTheme'
import { useDesktopIntegration } from '@/hooks/useDesktopIntegration'
import { useHabitReminders } from '@/hooks/useHabitReminders'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { FlipClock } from '@/components/common/FlipClock'
import { ZenOverlay } from '@/components/common/ZenOverlay'
import { DynamicIsland } from '@/components/island/DynamicIsland'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Spinner } from '@/components/ui/Spinner'
import { Sparkles } from 'lucide-react'
import { TopBar } from './TopBar'
import { ModeSwitcher } from './ModeSwitcher'
import { BoardCanvas } from './BoardCanvas'
import { FocusPanel } from '@/components/focus/FocusPanel'
import { FocusMiniOverlay } from '@/components/focus/FocusMiniOverlay'
import { FocusLockScreen } from '@/components/focus/FocusLockScreen'
import { AIAssistant } from '@/components/ai/AIAssistant'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { HydrationReminder } from '@/components/wellness/HydrationReminder'
import { SupportModal } from '@/components/support/SupportModal'
import { cn } from '@/utils/cn'

/**
 * The single unified dashboard — everything lives here. No nested routing.
 */
export function Dashboard() {
  const modesLoading = useStore((s) => s.modesLoading)
  const setAiOpen = useStore((s) => s.setAiOpen)
  const supportOpen = useStore((s) => s.supportOpen)
  const setSupportOpen = useStore((s) => s.setSupportOpen)
  const chromeHidden = useStore((s) => s.chromeHidden)
  const fullscreen = useStore((s) => s.fullscreen)
  const focusLocked = useStore((s) => s.focusLocked)
  const immersive = useStore((s) => s.status === 'running')
  useFocusEngine() // drives the Pomodoro tick, sound, notifications, and stats
  useModeAccent() // re-tints the whole UI to the active mode's accent color
  useAutoHideChrome() // top nav springs away when the cursor leaves the top edge
  useConnectivity() // sync status surfaced via the Dynamic Island; writes replay on reconnect
  useChronoTheme() // time-of-day palette/shadow modulation (data-chrono band)
  useDesktopIntegration() // desktop-only: hardware-fingerprint binding + global hotkeys
  useHabitReminders() // schedules per-interval reminder notifications for habits

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
            fullscreen ? "max-w-7xl px-6 py-6" : "max-w-7xl px-4 py-5 sm:px-6 sm:py-6"
          )}>
            {/* Ambient chrome — collapses (height + fade) when the cursor leaves
                the top edge; snappier during a Pomodoro for deep focus. */}
            <motion.div
              initial={false}
              animate={{ height: chromeHidden ? 0 : 'auto', opacity: chromeHidden ? 0 : 1 }}
              transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-5 pb-5">
                <TopBar />
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  <ModeSwitcher />
                </motion.div>
              </div>
            </motion.div>

            <main className={cn(
              "min-h-0 flex-1 overflow-y-auto",
              fullscreen ? "pb-6" : "pb-20"
            )}>
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
            onClick={() => setAiOpen(true)}
            animate={{
              scale: immersive ? 0.82 : 1,
              opacity: immersive ? 0.45 : 1,
            }}
            whileHover={{ scale: immersive ? 0.95 : 1.05, opacity: 1 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-glow"
            aria-label="Open AI companion"
          >
            <Sparkles className="h-6 w-6" />
          </motion.button>
        </>
      )}

      <FocusPanel />
      <FocusMiniOverlay />
      <AIAssistant />
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
  const iframeRef = useRef(null)
  const audioRef = useRef(null)

  if (status !== 'running' || !focusAudioUrl || muted) return null

  const youtubeMatch = focusAudioUrl.match(YT_PATTERN)

  if (youtubeMatch) {
    const videoId = youtubeMatch[1]
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
    return (
      <YTVolumeSync iframeRef={iframeRef} volume={volume}>
        <iframe
          ref={iframeRef}
          src={embedUrl}
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

  const postVolume = (vol) => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    try {
      iframe.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'setVolume',
        args: [Math.round(vol * 100)],
      }), 'https://www.youtube.com')
    } catch {
      /* cross-origin until YT API initialises */
    }
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume])

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
