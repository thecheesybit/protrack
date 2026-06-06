import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { useFocusEngine } from '@/hooks/useFocusEngine'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Spinner } from '@/components/ui/Spinner'
import { TopBar } from './TopBar'
import { ModeSwitcher } from './ModeSwitcher'
import { BoardCanvas } from './BoardCanvas'
import { FocusPanel } from '@/components/focus/FocusPanel'

/**
 * The single unified dashboard — everything lives here. No nested routing.
 */
export function Dashboard() {
  const modesLoading = useStore((s) => s.modesLoading)
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

      <FocusPanel />
    </div>
  )
}
