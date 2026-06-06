import { useState } from 'react'
import { Mic, Square, Sparkles, Save, Trash2, Loader2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { useNotes } from '@/hooks/useNotes'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { summarizeTranscript, hasGeminiKey } from '@/services/geminiService'
import { addNote, deleteNote } from '@/services/noteService'
import { cn } from '@/utils/cn'

export function VoiceNotesTab({ onOpenSettings }) {
  const { user } = useAuth()
  const activeModeId = useStore((s) => s.activeModeId)
  const notes = useNotes()
  const { supported, listening, transcript, interim, start, stop, reset, setText } =
    useSpeechRecognition()

  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState(null) // {title, summary, actionItems, flashcards}
  const [expanded, setExpanded] = useState(null)

  const generate = async () => {
    if (!transcript.trim()) return toast.error('Record or type something first')
    if (!hasGeminiKey()) return onOpenSettings()
    setGenerating(true)
    try {
      const result = await summarizeTranscript(transcript.trim())
      setDraft(result)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    try {
      await addNote(user.uid, {
        title: draft.title,
        transcript: transcript.trim(),
        summary: draft.summary,
        actionItems: draft.actionItems,
        flashcards: draft.flashcards,
        modeId: activeModeId,
      })
      toast.success('Note saved')
      setDraft(null)
      reset()
    } catch (err) {
      toast.error('Could not save note')
      console.error(err)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Recorder */}
        <div className="rounded-2xl border border-line/60 bg-surface-2/40 p-4">
          {!supported ? (
            <p className="text-sm text-muted">
              Voice capture needs a Chromium browser or the desktop app.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={listening ? stop : start}
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-full text-white transition-transform active:scale-95',
                  listening ? 'animate-pulse bg-red-500' : 'bg-accent',
                )}
              >
                {listening ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
              </button>
              <span className="text-xs text-muted">
                {listening ? 'Listening… tap to stop' : 'Tap to record a voice note'}
              </span>
            </div>
          )}

          {(transcript || interim) && (
            <textarea
              value={transcript + (interim ? ` ${interim}` : '')}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mt-3 w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Transcript…"
            />
          )}

          {transcript && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={generate}
                disabled={generating}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate
              </button>
              <button
                onClick={() => {
                  reset()
                  setDraft(null)
                }}
                className="rounded-xl border border-line px-3 py-2 text-sm text-muted hover:text-ink"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* AI draft preview */}
        {draft && (
          <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
            <h4 className="font-semibold">{draft.title}</h4>
            <p className="mt-1 text-sm text-muted">{draft.summary}</p>
            {draft.actionItems?.length > 0 && (
              <ul className="mt-3 space-y-1">
                {draft.actionItems.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-accent">•</span> {a}
                  </li>
                ))}
              </ul>
            )}
            {draft.flashcards?.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <span className="text-xs font-medium text-muted">
                  {draft.flashcards.length} flashcards
                </span>
                {draft.flashcards.map((f, i) => (
                  <div key={i} className="rounded-lg border border-line/60 bg-surface px-3 py-2 text-xs">
                    <div className="font-medium">{f.front}</div>
                    <div className="mt-0.5 text-muted">{f.back}</div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={save}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white"
            >
              <Save className="h-4 w-4" /> Save note
            </button>
          </div>
        )}

        {/* Saved notes */}
        {notes.length > 0 && (
          <div>
            <span className="text-xs font-medium text-muted">Saved notes</span>
            <div className="mt-2 space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-xl border border-line/60 bg-surface-2/30">
                  <button
                    onClick={() => setExpanded(expanded === n.id ? null : n.id)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{n.title}</span>
                      <span className="text-[11px] text-muted">
                        {(n.flashcards?.length || 0)} cards · {(n.actionItems?.length || 0)} actions
                      </span>
                    </span>
                    <ChevronDown
                      className={cn('h-4 w-4 text-muted transition-transform', expanded === n.id && 'rotate-180')}
                    />
                  </button>
                  {expanded === n.id && (
                    <div className="border-t border-line/50 px-3 py-2.5 text-sm">
                      <p className="text-muted">{n.summary}</p>
                      {n.flashcards?.map((f, i) => (
                        <div key={i} className="mt-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs">
                          <div className="font-medium">{f.front}</div>
                          <div className="text-muted">{f.back}</div>
                        </div>
                      ))}
                      <button
                        onClick={() => deleteNote(user.uid, n.id)}
                        className="mt-2 flex items-center gap-1 text-xs text-red-400 hover:underline"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
