import { useState, useEffect, useRef } from 'react'
import { Sparkles, Mic, MicOff, Loader2, Plus, Trash2, AlertCircle } from 'lucide-react'
import { bulkParse } from '@/lib/bulkParse'
import { addTasksBulk } from '@/services/subjectService'
import { hasGeminiKey, callAIProvider } from '@/services/geminiService'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useStore } from '@/store/useStore'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/utils/cn'

export function SubjectQuickAdd({ uid, modeId, subjectId, subjectName, className }) {
  const [input, setInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(null) // { titles: string[], count: number, warning?: string, note?: string }
  const [openModal, setOpenModal] = useState(false)

  const inputRef = useRef(null)
  const { supported, listening, transcript, start, stop, reset } = useSpeechRecognition()

  // Pipe voice transcription into input
  useEffect(() => {
    if (transcript) {
      setInput((prev) => {
        const sep = prev && !prev.endsWith(' ') ? ' ' : ''
        return prev + sep + transcript
      })
      reset()
    }
  }, [transcript, reset])

  const toggleMic = (e) => {
    e.preventDefault()
    if (listening) {
      stop()
    } else {
      start()
    }
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    const query = input.trim()
    if (!query || aiLoading || saving) return
    if (listening) stop()

    // 1. Try deterministic pure range & list parser first
    const parsed = bulkParse(query)
    if (parsed && parsed.titles.length > 0) {
      setPreview(parsed)
      setOpenModal(true)
      return
    }

    // 2. If freeform and Gemini/AI key is present, use single-shot AI provider
    if (hasGeminiKey()) {
      setAiLoading(true)
      try {
        const systemInstruction = `Extract a list of concise task titles from the student's request. Return strictly a JSON array of strings, for example: ["Read chapter 4", "Complete exercises", "Review flashcards"]. Do not include explanation or markdown code fences.`
        const res = await callAIProvider(query, systemInstruction)
        let extracted = null
        try {
          const match = res.text.match(/\[[\s\S]*\]/)
          if (match) extracted = JSON.parse(match[0])
          else extracted = JSON.parse(res.text)
        } catch {
          // fallback to lines
          extracted = res.text.split('\n').map((l) => l.replace(/^[-*•\d+.)]\s*/, '').trim()).filter(Boolean)
        }

        if (Array.isArray(extracted) && extracted.length > 0) {
          const titles = extracted.map((s) => String(s).trim()).filter(Boolean)
          setPreview({
            titles,
            count: titles.length,
            template: null,
          })
          setOpenModal(true)
          return
        }
      } catch (err) {
        console.warn('[SubjectQuickAdd] AI fallback failed, falling back to single task:', err)
      } finally {
        setAiLoading(false)
      }
    }

    // 3. Fallback: single task preview
    setPreview({
      titles: [query],
      count: 1,
      template: null,
      note: hasGeminiKey() ? undefined : 'Add a Gemini API key in Settings for AI task breakdown.',
    })
    setOpenModal(true)
  }

  const handleConfirmAdd = async () => {
    if (!preview?.titles?.length || saving) return
    setSaving(true)
    try {
      await addTasksBulk(uid, modeId, subjectId, preview.titles, { subjectName })
      useStore.getState().pushIsland?.({
        kind: 'success',
        title: `Added ${preview.titles.length} task${preview.titles.length > 1 ? 's' : ''}`,
        detail: `Created in ${subjectName || 'subject'}`,
        duration: 3500,
      })
      setInput('')
      setOpenModal(false)
      setPreview(null)
    } catch (err) {
      console.error('[SubjectQuickAdd] Failed to save tasks:', err)
      useStore.getState().pushIsland?.({
        kind: 'error',
        title: 'Error creating tasks',
        detail: err.message || 'Check Firestore permissions',
        duration: 4000,
      })
    } finally {
      setSaving(false)
    }
  }

  const removeTitle = (index) => {
    if (!preview) return
    const updated = preview.titles.filter((_, i) => i !== index)
    if (updated.length === 0) {
      setOpenModal(false)
      setPreview(null)
    } else {
      setPreview({
        ...preview,
        titles: updated,
        count: updated.length,
      })
    }
  }

  return (
    <div className={cn('relative my-2', className)}>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1.5 rounded-xl border border-line/60 bg-surface-2/40 px-2.5 py-1.5 transition-colors focus-within:border-accent focus-within:bg-surface-2/70"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent/80" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Bulk add: e.g. 'lesson 18 to 36', comma list, or mic..."
          className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-muted"
        />

        {supported && (
          <button
            type="button"
            onClick={toggleMic}
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors',
              listening
                ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                : 'text-muted hover:bg-surface hover:text-ink',
            )}
            title={listening ? 'Listening... click to stop' : 'Voice input'}
          >
            {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
        )}

        <button
          type="submit"
          disabled={!input.trim() || aiLoading}
          className="flex h-6 items-center gap-1 rounded-lg bg-accent/15 px-2 text-[11px] font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40"
        >
          {aiLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Plus className="h-3 w-3" />
              <span>Add</span>
            </>
          )}
        </button>
      </form>

      {/* Confirmation & Edit Preview Modal */}
      <Modal
        open={openModal}
        onClose={() => !saving && setOpenModal(false)}
        title={`Add ${preview?.titles?.length || 0} Tasks to ${subjectName || 'Subject'}`}
        footer={
          <>
            <button
              onClick={() => setOpenModal(false)}
              disabled={saving}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAdd}
              disabled={saving || !preview?.titles?.length}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create {preview?.titles?.length || 0} Tasks</span>
                </>
              )}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {preview?.warning && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{preview.warning}</span>
            </div>
          )}

          {preview?.note && (
            <p className="text-[11px] text-muted italic">{preview.note}</p>
          )}

          <div className="max-h-64 overflow-y-auto pr-1 space-y-1.5">
            {preview?.titles?.map((title, idx) => (
              <div
                key={idx}
                className="group/item flex items-center justify-between gap-2 rounded-xl border border-line/50 bg-surface-2/40 px-3 py-1.5 text-xs text-ink"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface text-[10px] font-bold text-muted">
                    {idx + 1}
                  </span>
                  <span className="truncate">{title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeTitle(idx)}
                  className="shrink-0 text-muted opacity-40 hover:opacity-100 hover:text-rose-400"
                  title="Remove task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
