import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useSubjects } from '@/hooks/useSubjects'
import { useTimetable } from '@/hooks/useTimetable'
import { chatWithGemini, hasGeminiKey } from '@/services/geminiService'
import { todayDow } from '@/lib/time'

const SUGGESTIONS = [
  'Analyze my progress',
  'Plan my next study session',
  'Quiz me on a weak subject',
]

export function ChatTab({ onOpenSettings }) {
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const stats = useStore((s) => s.stats)
  const { subjects } = useSubjects(activeModeId)
  const { slots } = useTimetable(activeModeId)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  const activeMode = modes.find((m) => m.id === activeModeId)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const buildContext = () => {
    const today = todayDow()
    const subjLines = subjects
      .map((s) => `- ${s.name}: ${s.progressPct || 0}% (${(s.flags || []).length} pending notes)`)
      .join('\n')
    const todaySlots = slots.filter((s) => s.dayOfWeek === today).map((s) => s.label).join(', ')
    return [
      `Active mode: ${activeMode?.name || '—'}`,
      `Subjects:\n${subjLines || '  (none yet)'}`,
      `Today's sessions: ${todaySlots || 'none planned'}`,
      `Focus stats: ${stats?.currentStreak || 0}-day streak, ${Math.round((stats?.totalFocusMin || 0) / 60)}h total, ${stats?.treesGrown || 0} sessions completed.`,
    ].join('\n')
  }

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    if (!hasGeminiKey()) return
    const next = [...messages, { role: 'user', text: content }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const reply = await chatWithGemini(next, buildContext())
      setMessages((m) => [...m, { role: 'assistant', text: reply }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
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
          <div className="flex flex-col items-center gap-3 py-8 text-center">
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
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 text-sm text-white'
                  : 'max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-line/60 bg-surface-2/50 px-3.5 py-2.5 text-sm'
              }
            >
              {m.text}
            </div>
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
        <div className="flex items-end gap-2">
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
            placeholder="Ask your companion…"
            className="max-h-28 flex-1 resize-none rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
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
