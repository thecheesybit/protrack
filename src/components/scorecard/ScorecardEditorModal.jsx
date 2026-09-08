import { useEffect, useState } from 'react'
import { Sparkles, Zap, Plus, Trash2, X, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { parseRawExamSummary, extractScorecardWithGemini } from '@/services/scorecardParser'
import { addScorecard, updateScorecard, deleteScorecard } from '@/services/scorecardService'
import { cn } from '@/utils/cn'

const MISTAKE_TAGS = [
  { id: 'silly', label: 'Silly Mistake', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  { id: 'speed', label: 'Speed / Time Trap', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { id: 'concept', label: 'Concept Gap', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { id: 'calculation', label: 'Calculation Error', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { id: 'misread', label: 'Misread Question', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  { id: 'formula', label: 'Formula Miss', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  { id: 'guess', label: 'Negative Guess', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
]

export function ScorecardEditorModal({
  open,
  onClose,
  modeId: propModeId,
  scorecard,
  exams = [],
  defaultExamId = '',
  onOpenExamEditor,
  nextSerial = 1,
  onDeleted,
}) {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const isEdit = Boolean(scorecard?.id)

  const [selectedModeId, setSelectedModeId] = useState('')
  const [selectedExamId, setSelectedExamId] = useState('')
  const [rawText, setRawText] = useState('')
  const [aiParsing, setAiParsing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form State
  const [title, setTitle] = useState('')
  const [type, setType] = useState('sectional') // 'sectional' | 'flt'
  const [sectionName, setSectionName] = useState('')
  const [topicName, setTopicName] = useState('')
  const [serialNo, setSerialNo] = useState(1)
  const [attemptDate, setAttemptDate] = useState('')

  const [score, setScore] = useState('')
  const [totalMarks, setTotalMarks] = useState('')
  const [negativeMarks, setNegativeMarks] = useState('')
  const [cutoff, setCutoff] = useState('')
  const [rank, setRank] = useState('')
  const [totalCandidates, setTotalCandidates] = useState('')
  const [percentile, setPercentile] = useState('')
  const [accuracy, setAccuracy] = useState('')
  const [timeSpent, setTimeSpent] = useState('')
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(0)

  const [correct, setCorrect] = useState('')
  const [wrong, setWrong] = useState('')
  const [unattempted, setUnattempted] = useState('')

  // Per-section breakdown (FLT paste, e.g. SmartKeeda "Test Analysis"). Read-only
  // preview here; persisted so the detail card + AI coach can use it.
  const [sections, setSections] = useState([])

  // Inline Mistakes
  const [mistakes, setMistakes] = useState([])
  const [showMistakeForm, setShowMistakeForm] = useState(false)
  const [newMistake, setNewMistake] = useState({
    tag: 'silly',
    topic: '',
    questionNo: '',
    note: '',
  })

  const targetExam = exams.find((e) => e.id === selectedExamId) || null

  useEffect(() => {
    if (selectedExamId) {
      const ex = exams.find((e) => e.id === selectedExamId)
      if (ex?._modeId) {
        setSelectedModeId(ex._modeId)
      }
    }
  }, [selectedExamId, exams])

  useEffect(() => {
    if (!open) return

    const initialExam = scorecard?.examId || defaultExamId || (exams[0]?.id || '')
    setSelectedExamId(initialExam)

    const exObj = exams.find((e) => e.id === initialExam)
    const initialMode = exObj?._modeId || scorecard?._modeId || (propModeId !== 'all' ? propModeId : modes[0]?.id || '')
    setSelectedModeId(initialMode)

    if (scorecard) {
      setTitle(scorecard.title || '')
      setType(scorecard.type || 'sectional')
      setSectionName(scorecard.sectionName || '')
      setTopicName(scorecard.topicName || '')
      setSerialNo(scorecard.serialNo || 1)
      setAttemptDate(scorecard.attemptDate ? scorecard.attemptDate.slice(0, 16) : '')

      setScore(scorecard.score != null ? String(scorecard.score) : '')
      setTotalMarks(scorecard.totalMarks != null ? String(scorecard.totalMarks) : '')
      setNegativeMarks(scorecard.negativeMarks != null ? String(scorecard.negativeMarks) : '')
      setCutoff(scorecard.cutoff != null ? String(scorecard.cutoff) : '')
      setSections(Array.isArray(scorecard.sections) ? scorecard.sections : [])
      setRank(scorecard.rank != null ? String(scorecard.rank) : '')
      setTotalCandidates(scorecard.totalCandidates != null ? String(scorecard.totalCandidates) : '')
      setPercentile(scorecard.percentile != null ? String(scorecard.percentile) : '')
      setAccuracy(scorecard.accuracy != null ? String(scorecard.accuracy) : '')
      setTimeSpent(scorecard.timeSpent || '')
      setTimeSpentMinutes(scorecard.timeSpentMinutes || 0)

      setCorrect(scorecard.correct != null ? String(scorecard.correct) : '')
      setWrong(scorecard.wrong != null ? String(scorecard.wrong) : '')
      setUnattempted(scorecard.unattempted != null ? String(scorecard.unattempted) : '')

      setMistakes(Array.isArray(scorecard.mistakes) ? scorecard.mistakes : [])
      setRawText(scorecard.rawText || '')
    } else {
      // New scorecard defaults
      setTitle('')
      setType('sectional')
      setSectionName('')
      setTopicName('')
      setSerialNo(nextSerial || 1)
      setAttemptDate(new Date().toISOString().slice(0, 16))

      setScore('')
      setTotalMarks('')
      setNegativeMarks('')
      setCutoff('')
      setSections([])
      setRank('')
      setTotalCandidates('')
      setPercentile('')
      setAccuracy('')
      setTimeSpent('')
      setTimeSpentMinutes(0)

      setCorrect('')
      setWrong('')
      setUnattempted('')

      setMistakes([])
      setRawText('')
    }
    setShowMistakeForm(false)
  }, [open, scorecard, propModeId, modes, nextSerial, exams, defaultExamId])

  const applyParsedData = (parsed) => {
    if (parsed.examName && exams.length) {
      const match = exams.find((e) => e.name.toLowerCase().includes(parsed.examName.toLowerCase()))
      if (match) setSelectedExamId(match.id)
    }
    if (parsed.score != null) setScore(String(parsed.score))
    if (parsed.totalMarks != null) setTotalMarks(String(parsed.totalMarks))
    if (parsed.negativeMarks != null) setNegativeMarks(String(parsed.negativeMarks))
    if (parsed.cutoff != null) setCutoff(String(parsed.cutoff))
    if (Array.isArray(parsed.sections) && parsed.sections.length) setSections(parsed.sections)
    if (parsed.rank != null) setRank(String(parsed.rank))
    if (parsed.totalCandidates != null) setTotalCandidates(String(parsed.totalCandidates))
    if (parsed.percentile != null) setPercentile(String(parsed.percentile))
    if (parsed.accuracy != null) setAccuracy(String(parsed.accuracy))
    if (parsed.timeSpent) setTimeSpent(parsed.timeSpent)
    if (parsed.timeSpentMinutes) setTimeSpentMinutes(parsed.timeSpentMinutes)

    if (parsed.correct != null) setCorrect(String(parsed.correct))
    if (parsed.wrong != null) setWrong(String(parsed.wrong))
    if (parsed.unattempted != null) setUnattempted(String(parsed.unattempted))

    // Section Name preservation:
    if (parsed.sectionName && parsed.sectionName !== 'All Sections') {
      setSectionName(parsed.sectionName)
      setType('sectional')
    } else if (parsed.sectionName === 'All Sections' && parsed.type === 'flt' && !sectionName) {
      setSectionName('All Sections')
      setType('flt')
    }

    if (parsed.topicName) setTopicName(parsed.topicName)

    const effectiveSection = (parsed.sectionName && parsed.sectionName !== 'All Sections')
      ? parsed.sectionName
      : sectionName

    if (parsed.examName && !title) {
      setTitle(
        parsed.type === 'flt'
          ? `${parsed.examName} Full Mock #${serialNo}`
          : `${parsed.examName} ${effectiveSection || 'Sectional'} #${serialNo}`
      )
    } else if (!title) {
      setTitle(
        parsed.type === 'flt'
          ? `Full Mock #${serialNo}`
          : `${effectiveSection || 'Sectional'} Mock #${serialNo}`
      )
    }
  }

  const handleInstantParse = () => {
    if (!rawText.trim()) {
      toast.error('Paste exam performance copy first')
      return
    }
    const parsed = parseRawExamSummary(rawText)
    applyParsedData(parsed)
    toast.success('Extracted details from clipboard text!')
  }

  const handlePaste = (e) => {
    const text = e.clipboardData?.getData('text')
    if (text && text.trim()) {
      setRawText(text)
      setTimeout(() => {
        const parsed = parseRawExamSummary(text)
        applyParsedData(parsed)
        toast.success('Auto-parsed pasted text!')
      }, 50)
    }
  }

  const handleClear = () => {
    setScore('')
    setTotalMarks('')
    setNegativeMarks('')
    setCutoff('')
    setSections([])
    setRank('')
    setTotalCandidates('')
    setPercentile('')
    setAccuracy('')
    setTimeSpent('')
    setTimeSpentMinutes(0)
    setCorrect('')
    setWrong('')
    setUnattempted('')
    setSectionName('')
    setTopicName('')
    setTitle('')
    setRawText('')
    setMistakes([])
    toast.success('Form cleared')
  }

  const handleGeminiExtract = async () => {
    if (!rawText.trim()) {
      toast.error('Paste exam performance copy first')
      return
    }
    setAiParsing(true)
    try {
      const parsed = await extractScorecardWithGemini(rawText)
      applyParsedData(parsed)
      toast.success('Gemini AI extracted test metrics!')
    } catch (err) {
      console.warn('[Gemini Extract] fallback to regex parser:', err)
      const parsed = parseRawExamSummary(rawText)
      applyParsedData(parsed)
      toast.error(err.message || 'AI extraction failed; parsed with local engine.')
    } finally {
      setAiParsing(false)
    }
  }

  const addMistake = () => {
    const tagInfo = MISTAKE_TAGS.find((t) => t.id === newMistake.tag)
    const noteText = newMistake.note.trim() || newMistake.topic.trim() || (tagInfo?.label || 'Mistake logged')
    const item = {
      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tag: newMistake.tag,
      topic: newMistake.topic.trim(),
      questionNo: newMistake.questionNo.trim(),
      note: noteText,
      createdAt: new Date().toISOString(),
    }
    setMistakes((prev) => [...prev, item])
    setNewMistake({ tag: 'silly', topic: '', questionNo: '', note: '' })
    setShowMistakeForm(false)
  }

  const removeMistake = (id) => {
    setMistakes((prev) => prev.filter((m) => m.id !== id))
  }

  const handleSave = async () => {
    const fallbackTitle = targetExam?.name
      ? (type === 'flt' ? `${targetExam.name} Full Mock #${serialNo}` : `${targetExam.name} ${sectionName || 'Sectional'} #${serialNo}`)
      : (type === 'flt' ? `Full Mock #${serialNo}` : `${sectionName || 'Sectional'} Mock #${serialNo}`)
    const finalTitle = title.trim() || fallbackTitle

    const targetModeId = targetExam?._modeId || selectedModeId || (propModeId !== 'all' ? propModeId : modes[0]?.id)
    if (!targetModeId) {
      toast.error('Please assign this test to a scope/mode.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        examId: selectedExamId || null,
        examName: targetExam?.name || '',
        title: finalTitle,
        type,
        sectionName: sectionName.trim() || (type === 'flt' ? 'All Sections' : 'General'),
        topicName: topicName.trim(),
        serialNo: Number(serialNo) || 1,
        attemptDate: attemptDate ? new Date(attemptDate).toISOString() : new Date().toISOString(),
        score: score !== '' ? Number(score) : 0,
        totalMarks: totalMarks !== '' ? Number(totalMarks) : 0,
        negativeMarks: negativeMarks !== '' ? Number(negativeMarks) : 0,
        cutoff: cutoff !== '' ? Number(cutoff) : null,
        sections: Array.isArray(sections) ? sections : [],
        rank: rank !== '' ? Number(rank) : null,
        totalCandidates: totalCandidates !== '' ? Number(totalCandidates) : null,
        percentile: percentile !== '' ? Number(percentile) : null,
        accuracy: accuracy !== '' ? Number(accuracy) : null,
        timeSpent: timeSpent || '00:00:00',
        timeSpentMinutes: Number(timeSpentMinutes) || 0,
        correct: correct !== '' ? Number(correct) : 0,
        wrong: wrong !== '' ? Number(wrong) : 0,
        unattempted: unattempted !== '' ? Number(unattempted) : 0,
        mistakes,
        rawText,
      }

      if (isEdit) {
        await updateScorecard(user.uid, targetModeId, scorecard.id, payload)
        toast.success('Scorecard updated')
      } else {
        await addScorecard(user.uid, targetModeId, payload)
        toast.success('Exam attempt logged!')
      }
      onClose()
    } catch (err) {
      console.error('[scorecard] save error:', err)
      toast.error('Could not save scorecard')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this scorecard attempt?')) return
    setSaving(true)
    try {
      await deleteScorecard(user.uid, selectedModeId, scorecard.id)
      onDeleted?.(scorecard.id)
      toast.success('Scorecard deleted')
      onClose()
    } catch (err) {
      console.error('[scorecard] delete error:', err)
      toast.error('Could not delete scorecard')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Exam Scorecard' : (targetExam ? `Record Attempt · ${targetExam.name}` : 'Record Exam Attempt')}
      className="max-w-2xl"
      footer={
        <>
          {isEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="mr-auto text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Log Attempt'}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        {/* ── Raw Text Ingestion Box ─────────────────────────────── */}
        <div className="rounded-2xl border border-line/60 bg-surface-2/30 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-accent" /> Paste Raw Portal Copy
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-line/70 bg-surface px-2 py-1 text-xs text-muted hover:text-ink transition-colors"
                title="Clear all fields"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleInstantParse}
                className="flex items-center gap-1 rounded-lg border border-line/70 bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:border-accent hover:text-accent transition-colors"
                title="Instant offline regex parser"
              >
                <Zap className="h-3 w-3 text-amber-400" /> Instant Parse
              </button>
              <button
                type="button"
                onClick={handleGeminiExtract}
                disabled={aiParsing}
                className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-accent to-accent-2 px-2.5 py-1 text-xs font-medium text-white shadow-glow-sm hover:opacity-95 transition-opacity disabled:opacity-50"
                title="Extract using Gemini AI"
              >
                {aiParsing ? <Spinner className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                Extract with AI
              </button>
            </div>
          </div>
          <textarea
            rows={3}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            onPaste={handlePaste}
            placeholder="Paste raw text copied from Oliveboard, Testbook, PracticeMock, etc. (Auto-parses instantly on paste!)..."
            className="w-full rounded-xl border border-line bg-surface/70 p-2.5 text-xs text-ink placeholder:text-muted/60 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* ── Exam Context Banner when exam exists (No Scope/Mode or Target Exam questions needed) ── */}
        {targetExam ? (
          <div className="flex items-center justify-between rounded-xl border border-line/50 bg-surface-2/30 px-3.5 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: targetExam.color || 'var(--accent)' }}
              />
              <span className="font-bold text-ink truncate">{targetExam.name}</span>
              {targetExam.category && (
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted shrink-0">
                  {targetExam.category}
                </span>
              )}
            </div>

            {exams.length > 1 && (
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <span className="text-[10px] text-muted">Exam:</span>
                <select
                  value={selectedExamId}
                  onChange={(e) => {
                    const exId = e.target.value
                    setSelectedExamId(exId)
                    const ex = exams.find((x) => x.id === exId)
                    if (ex?.totalMarks && !totalMarks) {
                      setTotalMarks(String(ex.totalMarks))
                    }
                  }}
                  className="rounded-lg border border-line/60 bg-surface px-2 py-0.5 text-[11px] text-muted hover:text-ink outline-none"
                  title="Switch target exam"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : (
          /* Only if no exam exists yet */
          exams.length === 0 && (
            <div className="flex flex-col gap-2">
              {modes.length > 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Scope / Mode</label>
                  <select
                    value={selectedModeId}
                    onChange={(e) => setSelectedModeId(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                  >
                    {modes.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {onOpenExamEditor && (
                <div className="flex items-center justify-between rounded-xl border border-dashed border-line/70 bg-surface-2/20 p-2.5 text-xs text-muted">
                  <span>No exam added yet.</span>
                  <button
                    type="button"
                    onClick={() => onOpenExamEditor(selectedModeId)}
                    className="flex items-center gap-1 font-semibold text-accent hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Add Exam
                  </button>
                </div>
              )}
            </div>
          )
        )}

        {/* ── Basic Info: Title, Type, Section ────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Exam Title / Mock Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                targetExam
                  ? `e.g. ${targetExam.name} Mock #${serialNo}`
                  : 'e.g. RRB PO Prelims Mock 1'
              }
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Test Type</label>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-line/60 bg-surface-2/40 p-1">
              <button
                type="button"
                onClick={() => setType('sectional')}
                className={cn(
                  'rounded-lg py-1.5 text-xs font-medium transition-colors',
                  type === 'sectional'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-ink'
                )}
              >
                Sectional
              </button>
              <button
                type="button"
                onClick={() => setType('flt')}
                className={cn(
                  'rounded-lg py-1.5 text-xs font-medium transition-colors',
                  type === 'flt'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-ink'
                )}
              >
                FLT (All)
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              {type === 'sectional' ? 'Section Name' : 'Exam Category / Scope'}
            </label>
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder={type === 'sectional' ? 'e.g. Reasoning, Quant, English' : 'All Sections'}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
            />
          </div>

          {type === 'sectional' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Topic Focus (Optional)</label>
              <input
                type="text"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                placeholder="e.g. Puzzles, DI, Syllogisms"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Test Serial # & Date</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                className="w-20 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                placeholder="#1"
              />
              <input
                type="datetime-local"
                value={attemptDate}
                onChange={(e) => setAttemptDate(e.target.value)}
                className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* ── Key Metrics Grid ───────────────────────────────────── */}
        <div className="rounded-2xl border border-line/60 bg-surface-2/20 p-3.5">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
            Performance Metrics
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="mb-1 block text-[11px] text-muted">Your Score</label>
              <input
                type="number"
                step="0.01"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-muted">Total Marks</label>
              <input
                type="number"
                step="1"
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                placeholder="40"
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-muted">Negative Marks</label>
              <input
                type="number"
                step="0.01"
                value={negativeMarks}
                onChange={(e) => setNegativeMarks(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-rose-400 outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-muted">Time Spent</label>
              <input
                type="text"
                value={timeSpent}
                onChange={(e) => setTimeSpent(e.target.value)}
                placeholder="00:00:00"
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-muted">Rank</label>
              <input
                type="number"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-muted">Total Candidates</label>
              <input
                type="number"
                value={totalCandidates}
                onChange={(e) => setTotalCandidates(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-muted">Percentile %</label>
              <input
                type="number"
                step="0.01"
                value={percentile}
                onChange={(e) => setPercentile(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-accent outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-muted">Accuracy %</label>
              <input
                type="number"
                step="0.01"
                value={accuracy}
                onChange={(e) => setAccuracy(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-emerald-400 outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Question Breakdown */}
          <div className="mt-3 pt-3 border-t border-line/40">
            <span className="mb-2 block text-[11px] text-muted">
              Question Distribution (Total: {(Number(correct) || 0) + (Number(wrong) || 0) + (Number(unattempted) || 0)})
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="mb-1 block text-[10px] text-emerald-400 font-medium">Right / Correct</label>
                <input
                  type="number"
                  value={correct}
                  onChange={(e) => setCorrect(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs font-bold text-emerald-400 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-rose-400 font-medium">Wrong / Incorrect</label>
                <input
                  type="number"
                  value={wrong}
                  onChange={(e) => setWrong(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-xs font-bold text-rose-400 outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-muted font-medium">Unattempted</label>
                <input
                  type="number"
                  value={unattempted}
                  onChange={(e) => setUnattempted(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-muted outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Sectional split — captured from an FLT paste (SmartKeeda / Adda247 table) */}
          {sections.length > 0 && (
            <div className="mt-3 pt-3 border-t border-line/40">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted">
                  Sectional Split ({sections.length} sections{cutoff ? ` · overall cut-off ${cutoff}` : ''})
                </span>
                <button
                  type="button"
                  onClick={() => setSections([])}
                  className="text-[10px] text-muted hover:text-rose-400 transition-colors"
                  title="Discard the parsed sectional split"
                >
                  Remove
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-line/50">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-surface-2/50 text-[10px] uppercase tracking-wider text-muted">
                      <th className="px-2 py-1.5 text-left font-medium">Section</th>
                      <th className="px-2 py-1.5 text-right font-medium">Score</th>
                      <th className="px-2 py-1.5 text-right font-medium">C / W / U</th>
                      <th className="px-2 py-1.5 text-right font-medium">Acc</th>
                      <th className="px-2 py-1.5 text-right font-medium">%ile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((sec, i) => (
                      <tr key={`${sec.name}-${i}`} className="border-t border-line/40">
                        <td className="px-2 py-1.5 font-medium text-ink">{sec.canonicalName || sec.name}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-ink">
                          {sec.score}<span className="text-muted">/{sec.totalMarks}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                          <span className="text-emerald-400">{sec.correct}</span>
                          {' / '}<span className="text-rose-400">{sec.wrong}</span>
                          {' / '}{sec.unattempted}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-emerald-400">
                          {sec.accuracy != null ? `${sec.accuracy}%` : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-accent">
                          {sec.percentile != null ? sec.percentile : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[10px] text-muted/70">
                Auto-detected full-length test — top metrics above reflect the overall row.
              </p>
            </div>
          )}
        </div>

        {/* ── Mistakes & Error Logger (Most Important) ──────────── */}
        <div className="rounded-2xl border border-line/60 bg-surface-2/20 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-rose-400" /> Mistakes & Error Analysis ({mistakes.length})
              </span>
              {Number(wrong) > 0 && (
                <span className="text-[10px] text-rose-400 font-medium">
                  {wrong} wrong question{Number(wrong) > 1 ? 's' : ''} recorded. Tag mistake types below:
                </span>
              )}
            </div>
            {!showMistakeForm && (
              <button
                type="button"
                onClick={() => setShowMistakeForm(true)}
                className="flex items-center gap-1 rounded-lg border border-line/60 bg-surface px-2.5 py-1 text-xs font-medium text-accent hover:border-accent"
              >
                <Plus className="h-3 w-3" /> Detailed Note
              </button>
            )}
          </div>

          {/* Quick-Click Preset Tags: 1-click mistake tagging without opening forms */}
          <div className="mb-3 rounded-xl border border-line/40 bg-surface/50 p-2.5">
            <span className="mb-1.5 block text-[10px] font-medium text-muted">
              Quick Add Error Tag (1-Click):
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {MISTAKE_TAGS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const item = {
                      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                      tag: t.id,
                      topic: '',
                      questionNo: '',
                      note: t.label,
                      createdAt: new Date().toISOString(),
                    }
                    setMistakes((prev) => [...prev, item])
                    toast.success(`+ ${t.label}`, { duration: 1500 })
                  }}
                  className={cn(
                    'flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium transition-all hover:scale-105 active:scale-95',
                    t.color
                  )}
                  title={`Click to add ${t.label}`}
                >
                  <Plus className="h-2.5 w-2.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* New Mistake Form */}
          {showMistakeForm && (
            <div className="mb-3 rounded-xl border border-line bg-surface p-3 flex flex-col gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] text-muted">Error Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {MISTAKE_TAGS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewMistake((m) => ({ ...m, tag: t.id }))}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        newMistake.tag === t.id
                          ? `${t.color} font-bold shadow-sm`
                          : 'border-line text-muted hover:text-ink'
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] text-muted">Topic / Question Type</label>
                  <input
                    type="text"
                    value={newMistake.topic}
                    onChange={(e) => setNewMistake((m) => ({ ...m, topic: e.target.value }))}
                    placeholder="e.g. Syllogism, Floor Puzzle"
                    className="w-full rounded-lg border border-line bg-surface-2/50 px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] text-muted">Question # (Optional)</label>
                  <input
                    type="text"
                    value={newMistake.questionNo}
                    onChange={(e) => setNewMistake((m) => ({ ...m, questionNo: e.target.value }))}
                    placeholder="e.g. Q14"
                    className="w-full rounded-lg border border-line bg-surface-2/50 px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="mb-0.5 block text-[10px] text-muted">What went wrong & lesson</label>
                <input
                  type="text"
                  value={newMistake.note}
                  onChange={(e) => setNewMistake((m) => ({ ...m, note: e.target.value }))}
                  placeholder="e.g. Didn't notice 'not' in conclusion. Spent 4 mins on dead-end case."
                  className="w-full rounded-lg border border-line bg-surface-2/50 px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowMistakeForm(false)}
                  className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addMistake}
                  className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90"
                >
                  Save Mistake
                </button>
              </div>
            </div>
          )}

          {/* Mistakes List */}
          {mistakes.length === 0 ? (
            <p className="text-center py-3 text-xs text-muted/70">
              No mistakes logged for this test yet. Click "Add Mistake" to record silly slips, speed traps, or topic gaps.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {mistakes.map((m) => {
                const tagInfo = MISTAKE_TAGS.find((t) => t.id === m.tag) || MISTAKE_TAGS[0]
                return (
                  <div
                    key={m.id}
                    className="group flex items-center justify-between gap-2 rounded-xl border border-line/60 bg-surface/80 px-3 py-2 text-xs"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className={cn('shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold', tagInfo.color)}>
                        {tagInfo.label}
                      </span>
                      {m.questionNo && (
                        <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted">
                          {m.questionNo}
                        </span>
                      )}
                      {m.topic && (
                        <span className="shrink-0 text-ink font-medium">
                          {m.topic}:
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-muted group-hover:text-ink">
                        {m.note}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMistake(m.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-muted hover:text-rose-400 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
