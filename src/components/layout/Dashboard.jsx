import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { useFocusEngine } from '@/hooks/useFocusEngine'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Spinner } from '@/components/ui/Spinner'
import { Sparkles } from 'lucide-react'
import { TopBar } from './TopBar'
import { ModeSwitcher } from './ModeSwitcher'
import { BoardCanvas } from './BoardCanvas'
import { FocusPanel } from '@/components/focus/FocusPanel'
import { AIAssistant } from '@/components/ai/AIAssistant'
import { SettingsPanel } from '@/components/settings/SettingsPanel'

/**
 * The single unified dashboard — everything lives here. No nested routing.
 */
export function Dashboard() {
  const modesLoading = useStore((s) => s.modesLoading)
  const setAiOpen = useStore((s) => s.setAiOpen)
  useFocusEngine() // drives the Pomodoro tick, sound, notifications, and stats

  return (
    <div className="relative flex h-full flex-col">
      <AuroraBackground />

      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <TopBar />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <ModeSwitcher />
        </motion.div>

        <main className="min-h-0 flex-1 overflow-y-auto pb-2">
          {modesLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            <BoardCanvas />
          )}
        </main>
      </div>

      {/* Floating AI companion */}
      <button
        onClick={() => setAiOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-glow transition-transform hover:scale-105 active:scale-95"
        aria-label="Open AI companion"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      <FocusPanel />
      <AIAssistant />
      <SettingsPanel />
    </div>
  )
}
