import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ListTodo, BookOpen, CalendarDays, Zap, BarChart3, Heart } from 'lucide-react'

const CMD_KEY = 'protrack:cmdMatrixOpen'

const CATEGORIES = [
  {
    label: 'Tasks',
    Icon: ListTodo,
    color: 'text-blue-400',
    commands: [
      "Add a task 'Read Ch.5' to Physics",
      'Mark Calculus homework done',
      "Add task 'Submit assignment' as urgent",
    ],
  },
  {
    label: 'To-Dos',
    Icon: BookOpen,
    color: 'text-violet-400',
    commands: [
      'Remind me to drink water at 3pm',
      'Add UPSC revision to my todo list',
      'Mark todo "buy notebooks" done',
    ],
  },
  {
    label: 'Calendar',
    Icon: CalendarDays,
    color: 'text-emerald-400',
    commands: [
      'Schedule Biology Tuesday 4pm to 6pm',
      'Add weekly History review on Fridays',
      'Add study session tomorrow 10am',
    ],
  },
  {
    label: 'Habits',
    Icon: Heart,
    color: 'text-rose-400',
    commands: [
      'Create a habit: Meditate daily',
      "Toggle today's exercise",
      'Add habit: Read 30 min',
    ],
  },
  {
    label: 'Progress',
    Icon: BarChart3,
    color: 'text-amber-400',
    commands: [
      'Set Physics progress to 75%',
      'Analyze my study pattern',
      'Add a subject called Chemistry',
    ],
  },
  {
    label: 'Quick',
    Icon: Zap,
    color: 'text-cyan-400',
    commands: [
      'How am I doing this week?',
      'What should I focus on next?',
      'Summarize my progress',
    ],
  },
]

export function CommandMatrix({ onSelect }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(CMD_KEY) !== 'false'
    } catch {
      return true
    }
  })

  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(CMD_KEY, String(next))
    } catch { /* private mode */ }
  }

  return (
    <div className="mt-2 w-full">
      <button
        onClick={toggle}
        className="mx-auto flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted transition-colors hover:text-ink"
      >
        What can I help with?
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid grid-cols-2 gap-2">
              {CATEGORIES.map(({ label, Icon, color, commands }) => (
                <div
                  key={label}
                  className="rounded-xl border border-line/50 bg-surface-2/30 p-2.5"
                >
                  <div className={`mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${color}`}>
                    <Icon className="h-3 w-3" />
                    {label}
                  </div>
                  <div className="space-y-1">
                    {commands.map((cmd) => (
                      <button
                        key={cmd}
                        onClick={() => onSelect(cmd)}
                        className="block w-full truncate rounded-lg px-2 py-1 text-left text-[11px] text-muted transition-colors hover:bg-accent/10 hover:text-ink"
                        title={cmd}
                      >
                        "{cmd}"
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
