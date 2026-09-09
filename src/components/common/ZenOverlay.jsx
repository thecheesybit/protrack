import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Zap, TreePine, Sprout, Sparkles, Quote } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useIdleDetection } from '@/hooks/useIdleDetection'
import { useSubjects } from '@/hooks/useSubjects'
import { useTodos } from '@/hooks/useWellness'
import { useFocusSessions } from '@/hooks/useFocusSessions'
import { SpriteFoliage, getSessionFoliageSeed, formatFloraBreakdown } from '@/components/focus/ForestSprites'
import { getPlantType } from '@/components/focus/CalendarForest'
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

export function ZenOverlay() {
  const { isIdle } = useIdleDetection(180000)
  const [show, setShow] = useState(false)
  const [quote, setQuote] = useState(QUOTES[0])
  const [idleTab, setIdleTab] = useState('forest') // 'forest' | 'quote'
  const [forestMotivationIdx, setForestMotivationIdx] = useState(0)
  const [hoveredSession, setHoveredSession] = useState(null)
  const { sessions } = useFocusSessions()
  const floraText = useMemo(() => formatFloraBreakdown(sessions), [sessions])
  const currentForestMotivation = useMemo(() => {
    return FOREST_MOTIVATIONS[forestMotivationIdx % FOREST_MOTIVATIONS.length]
  }, [forestMotivationIdx])
  const completedSessions = useMemo(() => {
    return (sessions || [])
      .filter((s) => s && s.completed !== false && !s.failedReason && (Number(s.durationMin) || 0) > 0)
      .slice(0, 36)
  }, [sessions])
  const totalMin = useMemo(() => {
    return (sessions || [])
      .filter((s) => s && s.completed !== false && !s.failedReason)
      .reduce((acc, s) => acc + (Number(s.durationMin) || 0), 0)
  }, [sessions])

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
  const activePrompt = useStore((s) => s.activePrompt)
  // Never draw a quote over a prompt that needs an answer.
  const promptBlocking = !!activePrompt && activePrompt.type !== 'quote'
  const isBlocked = focusRunning || focusLocked || !zenEnabled || promptBlocking

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

    let history = []
    try {
      history = JSON.parse(localStorage.getItem('protrack:zen_history')) || []
    } catch { /* private */ }
    if (history.length > 30) history = history.slice(history.length - 30)

    let newQuote
    const categories = settings?.zenCategories || ['stoic', 'philosophy', 'productivity', 'proverbs', 'hindi_urdu', 'modern']

    try {
      const res = await fetch('/zen_quotes.json')
      const pool = await res.json()
      const filteredPool = pool.filter((q) => categories.includes(q.category))
      const finalPool = filteredPool.length > 0 ? filteredPool : pool

      const available = finalPool.filter((q) => !history.find((h) => h.text === q.text))
      newQuote = available.length
        ? available[Math.floor(Math.random() * available.length)]
        : finalPool[Math.floor(Math.random() * finalPool.length)]
    } catch (err) {
      console.warn('[zen] fallback to static', err)
      const available = QUOTES.filter((q) => !history.find((h) => h.text === q.text))
      newQuote = available.length
        ? available[Math.floor(Math.random() * available.length)]
        : QUOTES[Math.floor(Math.random() * QUOTES.length)]
    }

    if (newQuote) {
      history.push({ text: newQuote.text, author: newQuote.author, date: Date.now() })
      try {
        localStorage.setItem('protrack:zen_history', JSON.stringify(history))
      } catch { /* private mode */ }
      setQuote(newQuote)
      
      const voiceEnabled = settings?.zenVoiceEnabled !== false
      speakQuote(newQuote, voiceEnabled)

      const duration = Math.max(MIN_DURATION_MS, zenDuration)
      clearTimeout(autoTimerRef.current)
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

  useEffect(() => {
    let active = true

    if (isBlocked) {
      dismiss()
      return
    }

    if (isIdle) {
      const run = async () => {
        let history = []
        try {
          history = JSON.parse(localStorage.getItem('protrack:zen_history')) || []
        } catch { /* private mode */ }
        if (history.length > 30) history = history.slice(history.length - 30)

        let newQuote
        const categories = settings?.zenCategories || ['stoic', 'philosophy', 'productivity', 'proverbs', 'hindi_urdu', 'modern']

        try {
          const res = await fetch('/zen_quotes.json')
          const pool = await res.json()
          const filteredPool = pool.filter((q) => categories.includes(q.category))
          const finalPool = filteredPool.length > 0 ? filteredPool : pool

          const available = finalPool.filter((q) => !history.find((h) => h.text === q.text))
          newQuote = available.length
            ? available[Math.floor(Math.random() * available.length)]
            : finalPool[Math.floor(Math.random() * finalPool.length)]
        } catch {
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

        // 50/50 randomized display between Forest Sanctuary and Zen Wisdom
        const chosenTab = Math.random() < 0.5 ? 'forest' : 'quote'
        setIdleTab(chosenTab)
        setForestMotivationIdx(Math.floor(Math.random() * FOREST_MOTIVATIONS.length))

        // Claim the prompt queue so a due check-in waits until the quote clears.
        if (quotePromptIdRef.current == null) {
          quotePromptIdRef.current = useStore
            .getState()
            .pushPrompt({ type: 'quote', dismissible: true })
        }
        setShow(true)

        // Speak quote audio only if quote tab is selected
        if (chosenTab === 'quote') {
          const voiceEnabled = settings?.zenVoiceEnabled !== false
          speakQuote(newQuote, voiceEnabled)
        }

        const duration = Math.max(MIN_DURATION_MS, zenDuration)
        clearTimeout(autoTimerRef.current)
        autoTimerRef.current = setTimeout(() => {
          if (active) dismiss()
        }, duration)
      }
      run()
    }

    return () => {
      active = false
      clearTimeout(autoTimerRef.current)
    }
  }, [isIdle, isBlocked, settings, zenDuration, dismiss])

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
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center p-8 text-center select-none"
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
              className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-6 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Proud Header */}
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300 backdrop-blur-md">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="tracking-wider uppercase">Your Focus Sanctuary</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-white drop-shadow-md">
                  Look how much you've grown: <span className="text-emerald-400 capitalize">{floraText}</span>
                </h2>
                <p className="text-sm font-medium text-emerald-200/85 max-w-xl leading-relaxed italic mt-0.5">
                  "{currentForestMotivation}"
                </p>
              </div>

              {/* Atmospheric Meadow & Soil Patch */}
              <div className="relative w-full h-[280px] sm:h-[320px] rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-[#0a130d]/85 via-[#131b11]/90 to-[#120b06] p-6 shadow-[inset_0_0_50px_rgba(0,0,0,0.7)] flex flex-col justify-end overflow-hidden">
                {/* Soil & Terrain */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#090604] via-[#16100a]/90 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 border-b border-amber-900/40" />
                <div className="pointer-events-none absolute bottom-4 left-12 h-16 w-64 rounded-full bg-emerald-600/15 blur-2xl" />
                <div className="pointer-events-none absolute bottom-6 right-16 h-16 w-64 rounded-full bg-emerald-500/15 blur-2xl" />

                {/* Floating spores / fireflies */}
                <div className="pointer-events-none absolute top-1/4 left-1/5 h-2 w-2 rounded-full bg-amber-300/50 blur-[1px] animate-pulse" />
                <div className="pointer-events-none absolute top-1/3 right-1/4 h-2 w-2 rounded-full bg-emerald-300/40 blur-[1px] animate-pulse" style={{ animationDelay: '1.5s' }} />

                {/* Hover inspection card */}
                <AnimatePresence>
                  {hoveredSession && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none whitespace-nowrap rounded-xl border border-emerald-500/30 bg-slate-950/92 px-3 py-1.5 shadow-2xl backdrop-blur-xl text-center"
                    >
                      <p className="text-xs font-bold text-emerald-400">
                        {hoveredSession.label || hoveredSession.title || 'Focus Session'}
                      </p>
                      <p className="text-[10px] text-white/70 mt-0.5">
                        {Number(hoveredSession.durationMin) || 25}m {getPlantType(hoveredSession)}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {completedSessions.length === 0 ? (
                  <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 text-center my-auto">
                    <Sprout className="h-10 w-10 text-emerald-400" />
                    <p className="text-sm font-semibold text-white/80">Your sanctuary is waiting for its first plant.</p>
                    <p className="text-xs text-white/50 max-w-sm">Complete a focus session to plant a flower, shrub, or tree!</p>
                  </div>
                ) : (
                  <div className="relative h-full w-full">
                    {completedSessions.map((s, i) => {
                      const pType = getPlantType(s)
                      const seed = getSessionFoliageSeed(s, i)
                      const phi = 0.618033988749895
                      const rawX = ((i * phi + ((seed % 23) / 23) * 0.15) % 1)
                      const leftPct = 10 + rawX * 80
                      const tier = i % 3
                      const baseBottom = tier === 0 ? 32 : tier === 1 ? 20 : 8
                      const bottomPct = Math.max(6, Math.min(38, baseBottom + (((seed >> 2) % 9) - 4) * 1.5))
                      const depthScale = 0.9 + ((38 - bottomPct) / 32) * 0.35
                      const z = 10 + Math.round((38 - bottomPct) * 2)

                      const pHeight =
                        pType === 'flower'
                          ? Math.round(42 * depthScale)
                          : pType === 'shrub'
                          ? Math.round(58 * depthScale)
                          : Math.round(96 * depthScale)

                      return (
                        <div
                          key={s.id || `zen-foliage-${i}`}
                          className="absolute cursor-pointer transition-transform duration-200 hover:scale-115 active:scale-95 group"
                          style={{
                            left: `${leftPct}%`,
                            bottom: `${bottomPct}%`,
                            transform: 'translateX(-50%)',
                            zIndex: z,
                          }}
                          onMouseEnter={() => setHoveredSession(s)}
                          onMouseLeave={() => setHoveredSession(null)}
                        >
                          {/* Ground shadow */}
                          <div
                            className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/65 blur-[2px]"
                            style={{
                              width: pType === 'flower' ? '30px' : pType === 'shrub' ? '46px' : '64px',
                              height: '8px',
                            }}
                          />
                          <SpriteFoliage
                            type={pType}
                            species="all"
                            variant={seed}
                            height={pHeight}
                            delay={Math.min(0.5, i * 0.03)}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Stat strip & Start focus action */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur-md">
                  ⏱️ {Math.round(totalMin / 60)}h {totalMin % 60}m focused total
                </span>
                <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur-md">
                  🌱 {completedSessions.length} total sessions
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openFocus({ title: 'Sanctuary Session' })
                    dismiss()
                  }}
                  className="flex items-center gap-2 rounded-2xl border border-emerald-500/50 bg-emerald-500/25 px-5 py-2.5 text-xs font-bold text-emerald-200 shadow-glow-sm backdrop-blur-md transition-all hover:scale-105 hover:bg-emerald-500/35 cursor-pointer"
                >
                  <TreePine className="h-4 w-4 text-emerald-400" />
                  <span>Start Focus & Root Another Specimen</span>
                </button>
              </div>

              <span className="text-[10px] text-muted/60 tracking-wider uppercase mt-2">
                Click background for next affirmation · Esc to exit
              </span>
            </motion.div>
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
