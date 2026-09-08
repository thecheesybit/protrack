import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, AlertTriangle, CheckCircle2, XCircle, Mic, MicOff } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/hooks/useAuth'
import { useSubjects } from '@/hooks/useSubjects'
import { useTimetable } from '@/hooks/useTimetable'
import { useHabits, useTodos } from '@/hooks/useWellness'
import { chatWithGemini, hasGeminiKey } from '@/services/geminiService'
import { executeTool } from '@/services/geminiTools'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { todayDow } from '@/lib/time'
import { bulkParse } from '@/lib/bulkParse'
import { CommandMatrix } from './CommandMatrix'

const SLASH_PATTERNS = [
  {
    re: /^\/done\s+(.+?)(?:\s+@(.+))?$/i,
    toTool: ([, a, b]) => b
      ? { name: 'complete_task', args: { taskTitle: a.trim(), subjectName: b.trim() } }
      : { name: 'complete_task', args: { subjectName: a.trim() } },
  },
  {
    re: /^\/todo\s+(.+)$/i,
    toTool: ([, text]) => ({ name: 'add_todo', args: { text: text.trim() } }),
  },
  {
    re: /^\/progress\s+(.+?)\s+(\d+)%?$/i,
    toTool: ([, subjectName, pct]) => ({
      name: 'set_subject_progress',
      args: { subjectName: subjectName.trim(), percent: Number(pct) },
    }),
  },
  {
    re: /^\/habit\s+(.+)$/i,
    toTool: ([, habitName]) => ({ name: 'toggle_habit_today', args: { habitName: habitName.trim() } }),
  },
  {
    re: /^\/task\s+(.+?)\s+@(.+)$/i,
    toTool: ([, title, subjectName]) => ({
      name: 'add_task',
      args: { subjectName: subjectName.trim(), title: title.trim() },
    }),
  },
  {
    re: /^\/tasks\s+(.+?)\s+@(.+)$/i,
    toTool: ([, spec, subjectName]) => {
      const parsed = bulkParse(spec.trim())
      const titles = parsed?.titles?.length
        ? parsed.titles
        : spec.split(',').map((s) => s.trim()).filter(Boolean)
      return {
        name: 'add_tasks_bulk',
        args: { subjectName: subjectName.trim(), titles },
      }
    },
  },
]

function parseSlashCommand(text) {
  for (const { re, toTool } of SLASH_PATTERNS) {
    const m = text.match(re)
    if (m) return toTool(m)
  }
  return null
}

const SUGGESTIONS = [
  'Analyze my progress',
  'I finished my Calculus study session',
  'Remind me to drink water',
]

export function ChatTab({ onOpenSettings, onToggleVoiceNote }) {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const stats = useStore((s) => s.stats)
  const { subjects } = useSubjects(activeModeId)
  const { slots } = useTimetable(activeModeId)
  const habits = useHabits()
  const todos = useTodos()

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  const { supported, listening, transcript, interim, error: speechError, transcribing, start, stop, reset: resetSpeech } = useSpeechRecognition()

  const activeMode = modes.find((m) => m.id === activeModeId)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  // When speech recognition finalizes text, pipe it into the input
  useEffect(() => {
    if (transcript) {
      setInput((prev) => {
        const sep = prev && !prev.endsWith(' ') ? ' ' : ''
        return prev + sep + transcript
      })
      resetSpeech()
    }
  }, [transcript, resetSpeech])

  const buildContext = () => {
    const today = todayDow()
    const subjLines = subjects
      .map((s) => `- ${s.name}: ${s.progressPct || 0}% (${(s.flags || []).length} pending notes)`)
      .join('\n')
    const todaySlots = slots.filter((s) => s.dayOfWeek === today).map((s) => s.label).join(', ')
    const habitLines = habits.map((h) => `- ${h.name}`).join('\n')
    const todoLines = todos
      .filter((t) => !t.done)
      .slice(0, 10)
      .map((t) => `- ${t.text}`)
      .join('\n')
    return [
      `Active mode: ${activeMode?.name || '—'} (id: ${activeModeId || 'none'})`,
      `Subjects:\n${subjLines || '  (none yet)'}`,
      `Habits:\n${habitLines || '  (none yet)'}`,
      `Open to-dos:\n${todoLines || '  (none)'}`,
      `Today's sessions: ${todaySlots || 'none planned'}`,
      `Focus stats: ${stats?.currentStreak || 0}-day streak, ${Math.round((stats?.totalFocusMin || 0) / 60)}h total, ${stats?.treesGrown || 0} sessions completed.`,
    ].join('\n')
  }

  const ctx = { uid: user?.uid, modeId: activeModeId, subjects, habits, todos }

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    if (listening) stop()

    // Slash commands execute directly without a Gemini round-trip
    const slashCmd = parseSlashCommand(content)
    if (slashCmd) {
      const next = [...messages, { role: 'user', text: content }]
      setMessages(next)
      setInput('')
      setLoading(true)
      try {
        const outcome = await executeTool(slashCmd.name, slashCmd.args, ctx)
        const reply = outcome.ok ? (outcome.summary || 'Done.') : `Error: ${outcome.error}`
        setMessages((m) => [
          ...m,
          { role: 'assistant', text: reply, toolEvents: [{ ...outcome, name: slashCmd.name }] },
        ])
      } catch (err) {
        setMessages((m) => [...m, { role: 'assistant', text: `Error: ${err.message}` }])
      } finally {
        setLoading(false)
      }
      return
    }

    if (!hasGeminiKey()) return
    const next = [...messages, { role: 'user', text: content }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const { text: reply, toolEvents } = await chatWithGemini(next, buildContext(), ctx)
      setMessages((m) => [...m, { role: 'assistant', text: reply, toolEvents }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const toggleMic = () => {
    if (listening) {
      stop()
    } else {
      start()
    }
  }

  if (!hasGeminiKey()) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <p className="text-sm text-muted">
          Add your Google Gemini API key to chat with your study companion.
        </p>
        <button
          onClick={onOpenSettings}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Open Settings
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted">
              Ask anything about your studies. I can see your active mode,
              subjects, schedule, and focus stats.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
            {/* Command Matrix */}
            <CommandMatrix onSelect={(cmd) => setInput(cmd)} />
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex flex-col items-start gap-1.5'}>
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 text-sm text-white'
                  : 'max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-line/60 bg-surface-2/50 px-3.5 py-2.5 text-sm'
              }
            >
              {m.text}
            </div>
            {m.role === 'assistant' && m.toolEvents?.length > 0 && (
              <div className="ml-1 flex flex-wrap gap-1.5">
                {m.toolEvents.map((ev, j) => (
                  <span
                    key={j}
                    className={
                      ev.ok
                        ? 'inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400'
                        : 'inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-400'
                    }
                  >
                    {ev.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {ev.summary || ev.error || ev.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-line/60 bg-surface-2/50 px-3.5 py-2.5 text-sm text-muted">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line/60 p-3">
        {/* Speech error */}
        {speechError && (
          <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
            {speechError}
          </div>
        )}
        {/* Interim speech preview */}
        {listening && interim && (
          <div className="mb-2 rounded-lg bg-accent/5 px-3 py-1.5 text-xs text-accent italic">
            {interim}…
          </div>
        )}
        {/* Gemini transcription in progress */}
        {transcribing && (
          <div className="mb-2 rounded-lg bg-accent/5 px-3 py-1.5 text-xs text-accent">
            Transcribing…
          </div>
        )}
        <div className="flex items-end gap-2">
          {supported && (
            <button
              onClick={toggleMic}
              disabled={transcribing}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all disabled:opacity-50 ${
                listening
                  ? 'animate-pulse border-red-500/50 bg-red-500/10 text-red-400'
                  : speechError
                    ? 'border-red-500/30 text-red-400/60 cursor-not-allowed'
                    : 'border-line text-muted hover:text-ink hover:border-accent/40'
              }`}
              aria-label={listening ? 'Stop listening' : 'Start voice input'}
              title={speechError || (listening ? 'Listening… click to stop' : 'Voice input')}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={listening ? 'Listening…' : 'Ask your companion…'}
            className="max-h-28 flex-1 resize-none rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          {onToggleVoiceNote && (
            <button
              type="button"
              onClick={onToggleVoiceNote}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:text-accent hover:border-accent/40 transition-colors"
              title="Record and Save Voice Note"
            >
              <Mic className="h-4 w-4 text-accent" />
            </button>
          )}
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

