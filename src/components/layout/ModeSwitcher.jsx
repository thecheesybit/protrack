import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { getIcon } from '@/lib/icons'
import { MODE_PALETTE } from '@/lib/constants'
import { createMode } from '@/services/modeService'
import { updateActiveMode } from '@/services/userService'
import { cn } from '@/utils/cn'

/**
 * Workspace mode pills. Selecting a mode swaps the entire board context and
 * persists the choice so the next visit resumes here. The sliding highlight is
 * a single shared `layoutId` element.
 */
export function ModeSwitcher() {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const setActiveModeId = useStore((s) => s.setActiveModeId)
  const restoreWidgets = useStore((s) => s.restoreWidgets)

  const selectMode = async (id) => {
    if (id === activeModeId) return
    setActiveModeId(id) // optimistic
    restoreWidgets() // collapse any focused widget on context switch
    try {
      await updateActiveMode(user.uid, id)
    } catch (err) {
      console.error('[mode] failed to persist active mode', err)
    }
  }

  const addMode = async () => {
    try {
      const order = modes.length
      const accentColor = MODE_PALETTE[order % MODE_PALETTE.length]
      const ref = await createMode(user.uid, {
        name: `New Mode ${order + 1}`,
        icon: 'Layers',
        accentColor,
        order,
      })
      await selectMode(ref.id)
      toast.success('Mode created')
    } catch (err) {
      console.error('[mode] failed to create mode', err)
      toast.error('Could not create mode')
    }
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-line/70 bg-surface/50 p-1.5 backdrop-blur-xl">
      {modes.map((mode) => {
        const Icon = getIcon(mode.icon)
        const active = mode.id === activeModeId
        return (
          <button
            key={mode.id}
            onClick={() => selectMode(mode.id)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
              active ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId="active-mode-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                className="absolute inset-0 rounded-xl bg-surface-2 shadow-sm"
              />
            )}
            <span
              className="relative h-2 w-2 rounded-full"
              style={{ backgroundColor: mode.accentColor || '#6366f1' }}
            />
            <Icon className="relative h-4 w-4" />
            <span className="relative whitespace-nowrap">{mode.name}</span>
          </button>
        )
      })}

      <button
        onClick={addMode}
        title="New mode"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
