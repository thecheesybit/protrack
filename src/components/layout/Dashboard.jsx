import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { useFocusEngine } from '@/hooks/useFocusEngine'
import { useModeAccent } from '@/hooks/useModeAccent'
import { useAutoHideChrome } from '@/hooks/useAutoHideChrome'
import { useConnectivity } from '@/hooks/useConnectivity'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Spinner } from '@/components/ui/Spinner'
import { Sparkles } from 'lucide-react'
import { TopBar } from './TopBar'
import { ModeSwitcher } from './ModeSwitcher'
import { BoardCanvas } from './BoardCanvas'
import { FocusPanel } from '@/components/focus/FocusPanel'
import { AIAssistant } from '@/components/ai/AIAssistant'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { HydrationReminder } from '@/components/wellness/HydrationReminder'

/**
 * The single unified dashboard — everything lives here. No nested routing.
 */
export function Dashboard() {
  const modesLoading = useStore((s) => s.modesLoading)
  const setAiOpen = useStore((s) => s.setAiOpen)
  const chromeHidden = useStore((s) => s.chromeHidden)
  const immersive = useStore((s) => s.status === 'running')
  useFocusEngine() // drives the Pomodoro tick, sound, notifications, and stats
  useModeAccent() // re-tints the whole UI to the active mode's accent color
  useAutoHideChrome() // top nav springs away when the cursor leaves the top edge
  useConnectivity() // elegant offline toast; writes queue + replay via persistence

  // Global shortcuts: Esc unwinds overlays/maximize; ⌘/Ctrl+K opens the AI.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        const st = useStore.getState()
        if (st.focusContext) st.closeFocus()
        else if (st.aiOpen) st.setAiOpen(false)
        else if (st.settingsOpen) st.setSettingsOpen(false)
        else if (st.maximizedWidgetId) st.restoreWidgets()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useStore.getState().setAiOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="relative flex h-full flex-col">
      <AuroraBackground />

      <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-5 sm:px-6 sm:py-6">
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

        <main className="min-h-0 flex-1 overflow-y-auto pb-20">
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

      <FocusPanel />
      <AIAssistant />
      <SettingsPanel />
      <HydrationReminder />
    </div>
  )
}
