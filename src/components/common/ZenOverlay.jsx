import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Zap, TreePine, Sprout, Sparkles, Quote, Clock, Trophy } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Leaderboard } from '@/components/leaderboard/Leaderboard'
import { useIdleDetection } from '@/hooks/useIdleDetection'
import { useSubjects } from '@/hooks/useSubjects'
import { useTodos } from '@/hooks/useWellness'
import { useFocusSessions } from '@/hooks/useFocusSessions'
import { formatFloraBreakdown } from '@/components/focus/ForestSprites'
import { ForestTerrain, sessionsToForestItems } from '@/components/focus/ForestTerrain'
import { ForestWorldMap } from '@/components/focus/ForestWorldMap'
import { deriveMonthEcosystem } from '@/lib/ecosystem'
import { speak, stopSpeaking } from '@/lib/tts'
import { classifyDeadline } from '@/lib/deadlines'
import { cn } from '@/utils/cn'

const MIN_DURATION_MS = 15000

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain", category: "productivity", language: "en", mood: "motifying" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", category: "philosophy", language: "en", mood: "calm" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King", category: "productivity", language: "en", mood: "sharp" },
  { text: "You don't have to see the whole staircase, just take the first step.", author: "Martin Luther King Jr.", category: "productivity", language: "en", mood: "motivating" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss", category: "productivity", language: "en", mood: "sharp" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin", category: "productivity", language: "en", mood: "reflective" },
  { text: "Doubt kills more dreams than failure ever will.", author: "Suzy Kassem", category: "productivity", language: "en", mood: "sharp" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh", category: "modern", language: "en", mood: "calm" },
]

export const FOREST_MOTIVATIONS = [
  "Every plant in this meadow was rooted through your deep, undivided focus.",
  "Small daily seeds of discipline grow into majestic forests of achievement.",
  "Your future self will thank you for the focus you cultivate today.",
  "Discipline is choosing between what you want now and what you want most.",
  "Consistency is the fertile soil where true mastery blooms.",
  "A quiet mind and focused intent build empires one session at a time.",
  "Great works are performed not by strength, but by perseverance.",
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

/** BCP-47 language for a quote — Hindi/Urdu quotes get a Devanagari voice. */
const zenLang = (quote) =>
  quote?.language === 'hi' || quote?.language === 'ur' ? 'hi-IN' : 'en-US'

/**
 * Speak a quote through the centralized tiered TTS (src/lib/tts.js). A calm
 * cadence (rate 0.95) reads better for a meditative quote while staying natural.
 */
const speakQuote = (quote, voiceEnabled) => {
  speak(quote.text, { voiceEnabled, lang: zenLang(quote), rate: 0.95 })
}

const DEFAULT_ZEN_CATEGORIES = ['stoic', 'philosophy', 'productivity', 'proverbs', 'hindi_urdu', 'modern']

function readZenHistory() {
  try {
    const history = JSON.parse(localStorage.getItem('protrack:zen_history')) || []
    return history.length > 30 ? history.slice(history.length - 30) : history
  } catch {
    return []
  }
}

function pushZenHistory(history, newQuote) {
  history.push({ text: newQuote.text, author: newQuote.author, date: Date.now() })
  try {
    localStorage.setItem('protrack:zen_history', JSON.stringify(history))
  } catch { /* private mode */ }
}

async function fetchNextQuote(categories, history) {
  try {
    const res = await fetch('/zen_quotes.json')
    const pool = await res.json()
    const filteredPool = pool.filter((q) => categories.includes(q.category))
    const finalPool = filteredPool.length > 0 ? filteredPool : pool
    const available = finalPool.filter((q) => !history.find((h) => h.text === q.text))
    return available.length
      ? available[Math.floor(Math.random() * available.length)]
      : finalPool[Math.floor(Math.random() * finalPool.length)]
  } catch (err) {
    console.warn('[zen] fallback to static', err)
    const available = QUOTES.filter((q) => !history.find((h) => h.text === q.text))
    return available.length
      ? available[Math.floor(Math.random() * available.length)]
      : QUOTES[Math.floor(Math.random() * QUOTES.length)]
  }
}

export function ZenOverlay() {
  const { isIdle } = useIdleDetection(180000)
  const [show, setShow] = useState(false)
  const [quote, setQuote] = useState(QUOTES[0])
  const [idleTab, setIdleTab] = useState('forest') // 'forest' | 'leaderboard' | 'quote'
  const [forestMotivationIdx, setForestMotivationIdx] = useState(0)
  const { sessions } = useFocusSessions()
  const floraText = useMemo(() => formatFloraBreakdown(sessions), [sessions])
  const currentForestMotivation = useMemo(() => {
    return FOREST_MOTIVATIONS[forestMotivationIdx % FOREST_MOTIVATIONS.length]
  }, [forestMotivationIdx])
  const completedSessions = useMemo(() => {
    return (sessions || [])
      .filter((s) => s && s.completed !== false && !s.failedReason && (Number(s.durationMin) || 0) > 0)
      .slice(0, 120)
  }, [sessions])
  // Oldest-first so the eldest plantings sit at the back of the isometric plot
  // and the newest grow toward the viewer.
  const sanctuaryItems = useMemo(
    () => sessionsToForestItems([...completedSessions].reverse()),
    [completedSessions],
  )
  const totalMin = useMemo(() => {
    return (sessions || [])
      .filter((s) => s && s.completed !== false && !s.failedReason)
      .reduce((acc, s) => acc + (Number(s.durationMin) || 0), 0)
  }, [sessions])

  const [sanctuarySubView, setSanctuarySubView] = useState('hex') // 'hex' | 'world'

  const sanctuaryEcosystem = useMemo(() => {
    const now = new Date()
    const thisMonthSessions = (sessions || []).filter((s) => {
      if (!s || s.completed === false || s.failedReason) return false
      const d = s.startedAt?.toDate ? s.startedAt.toDate() : new Date(s.startedAt || s.createdAt)
      return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    const monthTotalMin = thisMonthSessions.reduce((acc, s) => acc + (Number(s.durationMin) || 0), 0)
    const activeDaysSet = new Set(
      thisMonthSessions.map((s) => {
        const d = s.startedAt?.toDate ? s.startedAt.toDate() : new Date(s.startedAt || s.createdAt)
        return d.getDate()
      }),
    )
    const lastSession = completedSessions[0]
    const lastDate = lastSession
      ? (lastSession.startedAt?.toDate ? lastSession.startedAt.toDate() : new Date(lastSession.startedAt || lastSession.createdAt))
      : null
    const daysSinceLast = lastDate ? Math.max(0, Math.floor((Date.now() - lastDate.getTime()) / 86400000)) : 0

    return deriveMonthEcosystem({
      totalMin: monthTotalMin,
      activeDays: activeDaysSet.size,
      daysElapsed: now.getDate(),
      daysSinceLast,
      currentStreak: 0,
      month: now.getMonth(),
      year: now.getFullYear(),
      isSealed: false,
    })
  }, [sessions, completedSessions])

  const autoTimerRef = useRef(null)
  // Id of the queue slot this overlay holds while a quote is on screen, so a
  // check-in / routine cue queues behind it instead of stacking on top.
  const quotePromptIdRef = useRef(null)
  const activeModeId = useStore((s) => s.activeModeId)
  const settings = useStore((s) => s.settings)

  const zenEnabled = useStore((s) => s.settings?.zenEnabled !== false)
  const zenDuration = useStore((s) => s.settings?.zenDuration || 60000)
  const openFocus = useStore((s) => s.openFocus)
  const focusRunning = useStore((s) => s.status === 'running')
  const focusLocked = useStore((s) => s.focusLocked)
  const clockCentered = useStore((s) => s.clockCentered)
  // A manually-opened scene (Ctrl+F) is "sticky": it stays up until dismissed,
  // unlike the idle scene which auto-times-out.
  const stickyRef = useRef(false)
  const activePrompt = useStore((s) => s.activePrompt)
  // Never draw a quote over a prompt that needs an answer.
  const promptBlocking = !!activePrompt && activePrompt.type !== 'quote'
  // Desk Clock Mode (Ctrl+T) is a pure enlarged clock — the Zen/Forest scene is
  // explicitly NOT shown while it's active, so clockCentered blocks the overlay.
  const isBlocked = focusRunning || focusLocked || !zenEnabled || promptBlocking || clockCentered

  const { subjects } = useSubjects(activeModeId)
  const todos = useTodos()
  const recs = useMemo(() => {
    if (!show) return []
    return computeRecs(subjects, todos)
  }, [show, subjects, todos])

  const dismiss = useCallback(() => {
    clearTimeout(autoTimerRef.current)
    stopSpeaking()
    setShow(false)
    const pid = quotePromptIdRef.current
    if (pid != null) {
      useStore.getState().dismissPrompt(pid)
      quotePromptIdRef.current = null
    }
  }, [])

  const nextQuote = useCallback(async () => {
    stopSpeaking({ fade: true })

    const categories = settings?.zenCategories || DEFAULT_ZEN_CATEGORIES
    const history = readZenHistory()
    const newQuote = await fetchNextQuote(categories, history)
    if (!newQuote) return

    pushZenHistory(history, newQuote)
    setQuote(newQuote)

    const voiceEnabled = settings?.zenVoiceEnabled !== false
    speakQuote(newQuote, voiceEnabled)

    clearTimeout(autoTimerRef.current)
    // A manually-opened (Ctrl+F) scene is sticky — don't schedule auto-dismiss
    // while cycling quotes inside it; the idle scene still times out.
    if (!stickyRef.current) {
      const duration = Math.max(MIN_DURATION_MS, zenDuration)
      autoTimerRef.current = setTimeout(() => {
        dismiss()
      }, duration)
    }
  }, [settings, zenDuration, dismiss])

  /**
   * Shows the forest/quote scene. `autoDismiss:false` is used for Desk Clock
   * Mode, where the scene should stay up behind the enlarged clock until the
   * user un-centers it, rather than timing out like the idle trigger.
   */
  const revealScene = useCallback(async ({ tab, autoDismiss = true } = {}) => {
    const categories = settings?.zenCategories || DEFAULT_ZEN_CATEGORIES
    const history = readZenHistory()
    const newQuote = await fetchNextQuote(categories, history)
    if (!newQuote) return

    pushZenHistory(history, newQuote)
    setQuote(newQuote)

    const chosenTab = tab || (Math.random() < 0.5 ? 'forest' : 'quote')
    setIdleTab(chosenTab)
    setForestMotivationIdx(Math.floor(Math.random() * FOREST_MOTIVATIONS.length))

    if (quotePromptIdRef.current == null) {
      quotePromptIdRef.current = useStore.getState().pushPrompt({ type: 'quote', dismissible: true })
    }
    setShow(true)

    if (chosenTab === 'quote') {
      const voiceEnabled = settings?.zenVoiceEnabled !== false
      speakQuote(newQuote, voiceEnabled)
    }

    clearTimeout(autoTimerRef.current)
    stickyRef.current = !autoDismiss
    if (autoDismiss) {
      const duration = Math.max(MIN_DURATION_MS, zenDuration)
      autoTimerRef.current = setTimeout(() => {
        dismiss()
      }, duration)
    }
  }, [settings, zenDuration, dismiss])

  useEffect(() => {
    if (!show) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        dismiss()
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        nextQuote()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, dismiss, nextQuote])

  // Idle auto-trigger only. Desk Clock Mode (Ctrl+T) is a pure enlarged clock —
  // the Zen/Forest scene is explicitly NOT raised there (clockCentered is part
  // of isBlocked). The scene opens on idle, or on demand via Ctrl+F (handled by
  // the 'protrack:open-zen' listener below).
  useEffect(() => {
    if (isBlocked) {
      dismiss()
      return undefined
    }
    if (isIdle) {
      revealScene({ autoDismiss: true })
    }
    return () => clearTimeout(autoTimerRef.current)
  }, [isIdle, isBlocked, revealScene, dismiss])

  // On-demand open via Ctrl+F (dispatched from the Dashboard keydown handler).
  // Opens a sticky Forest Sanctuary scene that stays until Esc / close.
  useEffect(() => {
    const onOpen = (e) => {
      const st = useStore.getState()
      if (st.status === 'running' || st.focusLocked || st.clockCentered) return
      revealScene({ tab: e.detail?.tab || 'forest', autoDismiss: false })
    }
    window.addEventListener('protrack:open-zen', onOpen)
    return () => window.removeEventListener('protrack:open-zen', onOpen)
  }, [revealScene])

  const quoteLines = quote.text.split('\n')

  return (
    <AnimatePresence>
      {show && (!activePrompt || activePrompt.type === 'quote') && (
        <motion.div
          key="zen-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 1.0, ease: 'easeIn' },
          }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          onClick={idleTab === 'quote' ? nextQuote : () => setForestMotivationIdx((i) => i + 1)}
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center p-4 sm:p-6 text-center select-none"
        >
          {/* Ambient Background Mesh */}
          <div className="absolute inset-0 overflow-hidden -z-10 bg-bg">
            <motion.div
              animate={{
                x: [0, 80, -40, 0],
                y: [0, -60, 40, 0],
                scale: [1, 1.15, 0.9, 1],
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-accent/6 blur-[120px]"
            />
            <motion.div
              animate={{
                x: [0, -60, 80, 0],
                y: [0, 50, -40, 0],
                scale: [1, 0.9, 1.1, 1],
              }}
              transition={{
                duration: 30,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute -bottom-[20%] -right-[10%] w-[65%] h-[65%] rounded-full bg-indigo-500/4 blur-[130px]"
            />
          </div>

          {/* Close / Exit Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              dismiss()
            }}
            aria-label="Exit Zen Mode"
            className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-xl border border-line/40 bg-surface/30 text-muted backdrop-blur transition-colors hover:text-ink hover:border-line"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Mode Switcher: Forest Sanctuary vs Zen Wisdom */}
          <div
            className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 p-1 backdrop-blur-2xl shadow-glass select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setIdleTab('forest')
                stopSpeaking()
              }}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                idleTab === 'forest'
                  ? 'bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 shadow-glow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              )}
            >
              <TreePine className="h-3.5 w-3.5 text-emerald-400" />
              <span>Forest Sanctuary</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIdleTab('leaderboard')
                stopSpeaking()
              }}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                idleTab === 'leaderboard'
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200 shadow-glow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              )}
            >
              <Trophy className="h-3.5 w-3.5 text-amber-300" />
              <span>Leaderboard</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIdleTab('quote')
                const voiceEnabled = settings?.zenVoiceEnabled !== false
                speakQuote(quote, voiceEnabled)
              }}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                idleTab === 'quote'
                  ? 'bg-accent/25 border border-accent/40 text-accent shadow-glow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              )}
            >
              <Quote className="h-3.5 w-3.5" />
              <span>Zen Wisdom</span>
            </button>
          </div>

          {idleTab === 'forest' ? (
            /* ════════════════════ FOREST SANCTUARY MODE ════════════════════ */
            <motion.div
              key="idle-forest-view"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.6 }}
              className="relative z-10 flex w-full max-w-7xl px-4 flex-col items-center gap-3 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Refined, Streamlined Header (De-crowded & Airy) */}
              <div className="flex flex-col items-center gap-1.5 text-center mt-6 sm:mt-8">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-white drop-shadow-md">
                    Look how much you've grown: <span className="text-emerald-400 capitalize">{floraText}</span>
                  </h2>

                  {/* Sanctuary sub-view toggle: Living Hex vs World Continent */}
                  <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-0.5 backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => setSanctuarySubView('hex')}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
                        sanctuarySubView === 'hex'
                          ? 'bg-emerald-500/25 text-emerald-300 font-bold shadow-sm'
                          : 'text-white/60 hover:text-white',
                      )}
                    >
                      <TreePine className="h-3.5 w-3.5" />
                      <span>Living Diorama</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSanctuarySubView('world')}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
                        sanctuarySubView === 'world'
                          ? 'bg-emerald-500/25 text-emerald-300 font-bold shadow-sm'
                          : 'text-white/60 hover:text-white',
                      )}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Honeycomb World</span>
                    </button>
                  </div>
                </div>

                <p className="text-xs font-medium text-emerald-200/75 max-w-lg leading-relaxed italic">
                  "{currentForestMotivation}"
                </p>
              </div>

              {sanctuarySubView === 'world' ? (
                <ForestWorldMap
                  sessions={sessions}
                  className="h-[64vh] min-h-[500px] max-h-[740px] w-full rounded-3xl shadow-2xl"
                  onInspectMonth={() => setSanctuarySubView('hex')}
                />
              ) : (
                /* Isometric Living Rhombus ecosystem */
                <ForestTerrain
                  items={sanctuaryItems}
                  maxCells={10000}
                  ecosystem={sanctuaryEcosystem}
                  isHex={false}
                  minHeightClass="h-[64vh] min-h-[500px] max-h-[740px] w-full"
                  className="rounded-3xl shadow-2xl"
                  isSanctuary={true}
                  emptyState={
                    <>
                      <Sprout className="h-10 w-10 text-emerald-400" />
                      <p className="text-sm font-semibold text-white/80">Your sanctuary is waiting for its first plant.</p>
                      <p className="max-w-sm text-xs text-white/50">Complete a focus session to plant a flower, shrub, or tree!</p>
                    </>
                  }
                />
              )}

              {/* Stat strip & Start focus action */}
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <span className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75 backdrop-blur-md">
                  <Clock className="h-3.5 w-3.5 text-sky-400" />
                  <span>{Math.floor(totalMin / 60)}h {totalMin % 60}m focused total</span>
                </span>
                <span className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75 backdrop-blur-md">
                  <Sprout className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{completedSessions.length} total sessions</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openFocus({ title: 'Sanctuary Session' })
                    dismiss()
                  }}
                  className="flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/25 px-4 py-1.5 text-xs font-bold text-emerald-200 shadow-glow-sm backdrop-blur-md transition-all hover:scale-105 hover:bg-emerald-500/35 cursor-pointer"
                >
                  <TreePine className="h-4 w-4 text-emerald-400" />
                  <span>Start Focus & Root Another Specimen</span>
                </button>
              </div>

              <span className="text-[10px] text-muted/60 tracking-wider uppercase mt-1">
                Click background for next affirmation · Esc to exit
              </span>
            </motion.div>
          ) : idleTab === 'leaderboard' ? (
            /* ════════════════════ FOREST LEADERBOARD ════════════════════ */
            <div
              className="relative z-10 flex w-full flex-col items-center my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <Leaderboard />
            </div>
          ) : (
            /* ════════════════════ ZEN WISDOM QUOTE MODE ════════════════════ */
            <motion.div
              key="zen-quote-view"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex max-w-3xl flex-col items-center gap-6 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Line by line slow staggered fade in */}
              <div className="flex flex-col gap-3.5 mb-2">
                {quoteLines.map((line, idx) => (
                  <motion.p
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: idx * 0.9,
                      duration: 1.4,
                      ease: 'easeOut',
                    }}
                    className={cn(
                      'leading-relaxed text-ink/90',
                      quote.language === 'hi' || quote.language === 'ur'
                        ? 'text-4xl md:text-5xl font-hindi'
                        : 'text-3xl md:text-4xl font-serif-quote italic'
                    )}
                  >
                    {line}
                  </motion.p>
                ))}
              </div>

              {/* Transliteration for Hindi / Urdu */}
              {quote.transliteration && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{
                    delay: quoteLines.length * 0.9 + 0.3,
                    duration: 1.2,
                  }}
                  className="text-sm md:text-base font-serif italic text-muted max-w-2xl mx-auto leading-relaxed mt-2"
                >
                  "{quote.transliteration}"
                </motion.p>
              )}

              {/* Translation for non-English quotes */}
              {quote.translation && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.75 }}
                  transition={{
                    delay: quoteLines.length * 0.9 + (quote.transliteration ? 0.9 : 0.4),
                    duration: 1.2,
                  }}
                  className="text-xs md:text-sm text-ink/75 max-w-xl mx-auto leading-relaxed mt-1.5"
                >
                  {quote.translation}
                </motion.p>
              )}

              {/* Author */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.45 }}
                transition={{
                  delay: quoteLines.length * 0.9 + (quote.transliteration || quote.translation ? 1.4 : 0.6),
                  duration: 1.2,
                }}
                className="text-xs uppercase tracking-[0.25em] font-semibold text-muted font-cinzel mt-4"
              >
                — {quote.author}
              </motion.p>

              {/* Motivating Action Trigger */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: quoteLines.length * 0.9 + 1.6, duration: 0.8 }}
                className="flex items-center justify-center mt-3"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openFocus({ title: 'Deep Work' })
                    dismiss()
                  }}
                  className="flex items-center gap-2 rounded-2xl border border-accent/50 bg-accent/20 px-5 py-2.5 text-xs font-bold text-accent shadow-glow-sm backdrop-blur-md transition-all hover:scale-105 hover:bg-accent/30 cursor-pointer"
                >
                  <Zap className="h-4 w-4" />
                  <span>Channel this Wisdom into Focus</span>
                </button>
              </motion.div>

              {/* Recommendation chips */}
              {recs.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: quoteLines.length * 0.9 + 2.0, duration: 0.8 }}
                  className="flex flex-col items-center gap-2 mt-8"
                >
                  {recs.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center gap-3 rounded-2xl border border-line/45 bg-surface/30 px-4 py-2.5 backdrop-blur-xl"
                    >
                      <Zap className="h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="text-sm text-ink/75">{rec.question}</span>
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
                        className="shrink-0 rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 shadow-glow-sm"
                      >
                        Yes
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}

              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.2 }}
                transition={{ delay: quoteLines.length * 0.9 + 2.5 }}
                className="text-[10px] text-muted/60 tracking-wider uppercase mt-6"
              >
                Click background for next quote · Esc to exit
              </motion.span>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
