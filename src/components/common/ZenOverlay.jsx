import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Zap } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useIdleDetection } from '@/hooks/useIdleDetection'
import { useSubjects } from '@/hooks/useSubjects'
import { useTodos, useHabits } from '@/hooks/useWellness'
import { fetchZenQuote } from '@/services/geminiService'
import { classifyDeadline } from '@/lib/deadlines'

const MIN_DURATION_MS = 10000

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King" },
  { text: "You don't have to see the whole staircase, just take the first step.", author: "Martin Luther King Jr." },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin" },
  { text: "Doubt kills more dreams than failure ever will.", author: "Suzy Kassem" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
]

function computeRecs(subjects, todos) {
  const recs = []

  const lagging = subjects
    .filter((s) => (s.progressPct || 0) < 50)
    .sort((a, b) => (a.progressPct || 0) - (b.progressPct || 0))
  if (lagging[0]) {
    recs.push({
      id: `s-${lagging[0].id}`,
      question: `${lagging[0].name} is at ${lagging[0].progressPct || 0}% — start a focus session?`,
      kind: 'focus',
      _subject: lagging[0],
    })
  }

  const overdueTodo = todos.find((t) => !t.done && classifyDeadline(t.dueAt) === 'overdue')
  if (overdueTodo) {
    recs.push({
      id: `t-${overdueTodo.id}`,
      question: `"${overdueTodo.text}" is overdue — add it to today's focus?`,
      kind: 'deadline',
      _todo: overdueTodo,
    })
  }

  return recs.slice(0, 2)
}

export function ZenOverlay() {
  const { isIdle } = useIdleDetection(180000)
  const [show, setShow] = useState(false)
  const [quote, setQuote] = useState(QUOTES[0])

  const autoTimerRef = useRef(null)
  const activeModeId = useStore((s) => s.activeModeId)
  // Default true — disabled only when user explicitly sets zenEnabled: false
  const zenEnabled = useStore((s) => s.settings?.zenEnabled !== false)
  const zenDuration = useStore((s) => s.settings?.zenDuration || MIN_DURATION_MS)
  const openFocus = useStore((s) => s.openFocus)
  const focusRunning = useStore((s) => s.status === 'running')
  const focusLocked = useStore((s) => s.focusLocked)
  const isBlocked = focusRunning || focusLocked || !zenEnabled

  const { subjects } = useSubjects(activeModeId)
  const todos = useTodos()

  const recs = computeRecs(subjects, todos)

  const dismiss = useCallback(() => {
    clearTimeout(autoTimerRef.current)
    setShow(false)
  }, [])

  useEffect(() => {
    if (!show) return
    const onKey = (e) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, dismiss])

  useEffect(() => {
    let active = true

    if (isBlocked) {
      setShow(false)
      return
    }

    if (isIdle) {
      const run = async () => {
        let history = []
        try {
          history = JSON.parse(localStorage.getItem('protrack:zen_history')) || []
        } catch { /* private mode */ }
        if (history.length > 30) history = history.slice(history.length - 30)

        let newQuote = null

        // Try personalized Gemini quote first
        try {
          newQuote = await fetchZenQuote(history, { subjects, todos })
        } catch { /* fallback below */ }

        // Local zen_quotes.json fallback
        if (!newQuote?.text) {
          try {
            const res = await fetch('/zen_quotes.json')
            const pool = await res.json()
            const available = pool.filter((q) => !history.find((h) => h.text === q.text))
            newQuote = available.length
              ? available[Math.floor(Math.random() * available.length)]
              : pool[Math.floor(Math.random() * pool.length)]
          } catch { /* last resort below */ }
        }

        // Static fallback
        if (!newQuote?.text) {
          const available = QUOTES.filter((q) => !history.find((h) => h.text === q.text))
          newQuote = available.length
            ? available[Math.floor(Math.random() * available.length)]
            : QUOTES[Math.floor(Math.random() * QUOTES.length)]
        }

        if (!active) return

        history.push({ text: newQuote.text, author: newQuote.author, date: Date.now() })
        try {
          localStorage.setItem('protrack:zen_history', JSON.stringify(history))
        } catch { /* private mode */ }

        setQuote(newQuote)
        setShow(true)

        // Auto-dismiss respects minimum 10s; settings can extend it
        const duration = Math.max(MIN_DURATION_MS, zenDuration)
        clearTimeout(autoTimerRef.current)
        autoTimerRef.current = setTimeout(() => {
          if (active) setShow(false)
        }, duration)
      }
      run()
    } else {
      setShow(false)
    }

    return () => {
      active = false
      clearTimeout(autoTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIdle, isBlocked])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="zen-overlay"
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(24px)' }}
          exit={{
            opacity: 0,
            backdropFilter: 'blur(0px)',
            transition: { duration: 1.2, ease: 'easeIn' },
          }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          onClick={dismiss}
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-bg/60 p-8 text-center"
        >
          {/* Dismiss button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              dismiss()
            }}
            aria-label="Dismiss"
            className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-xl border border-line/50 bg-surface/40 text-muted backdrop-blur transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1.2, ease: 'easeOut' }}
            className="flex max-w-3xl flex-col items-center gap-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-3xl font-serif italic leading-relaxed text-ink/90 md:text-5xl">
              "{quote.text}"
            </p>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
              — {quote.author}
            </p>

            {/* Recommendation chips */}
            {recs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2, duration: 0.8 }}
                className="flex flex-col items-center gap-2"
              >
                {recs.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-3 rounded-2xl border border-line/50 bg-surface/50 px-4 py-2.5 backdrop-blur-xl"
                  >
                    <Zap className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="text-sm text-ink/80">{rec.question}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (rec.kind === 'focus' && rec._subject) {
                          openFocus({
                            title: rec._subject.name,
                            color: rec._subject.color,
                            subjectId: rec._subject.id,
                            modeId: rec._subject._modeId || activeModeId,
                          })
                        }
                        dismiss()
                      }}
                      className="shrink-0 rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      Yes
                    </button>
                  </div>
                ))}
              </motion.div>
            )}

            <span className="text-xs text-muted/50">Tap anywhere to dismiss</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
