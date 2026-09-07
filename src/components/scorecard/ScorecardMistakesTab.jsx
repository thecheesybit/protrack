import { useState, useMemo } from 'react'
import { AlertCircle, Search, Filter, Plus, Calendar, Layers, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { addMistakeToScorecard, removeMistakeFromScorecard } from '@/services/scorecardService'
import { cn } from '@/utils/cn'

const MISTAKE_TAGS = [
  { id: 'silly', label: 'Silly Mistake', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  { id: 'speed', label: 'Speed / Time Trap', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { id: 'concept', label: 'Concept Gap', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { id: 'calculation', label: 'Calculation Slip', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { id: 'misread', label: 'Misread Question', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  { id: 'formula', label: 'Formula Miss', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  { id: 'guess', label: 'Negative Guess', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
]

export function ScorecardMistakesTab({ scorecards = [], onOpenDetail }) {
  const { user } = useAuth()
  const activeModeId = useStore((s) => s.activeModeId)
  const [selectedTag, setSelectedTag] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [targetScorecardId, setTargetScorecardId] = useState(scorecards[0]?.id || '')

  const [newMistake, setNewMistake] = useState({
    tag: 'silly',
    topic: '',
    questionNo: '',
    note: '',
  })

  // Flatten all mistakes across all scorecards with parent exam context
  const allMistakes = useMemo(() => {
    const list = []
    scorecards.forEach((s) => {
      ;(s.mistakes || []).forEach((m) => {
        list.push({
          ...m,
          scorecardId: s.id,
          scorecardTitle: s.title,
          scorecardType: s.type,
          scorecardSection: s.sectionName,
          scorecardDate: s.attemptDate,
          _modeId: s._modeId || s.modeId,
          _modeName: s._modeName,
          _modeColor: s._modeColor,
        })
      })
    })
    return list.sort((a, b) => new Date(b.createdAt || b.scorecardDate || 0) - new Date(a.createdAt || a.scorecardDate || 0))
  }, [scorecards])

  // Filtered mistakes
  const filteredMistakes = useMemo(() => {
    return allMistakes.filter((m) => {
      if (selectedTag !== 'all' && m.tag !== selectedTag) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTopic = (m.topic || '').toLowerCase().includes(q)
        const matchNote = (m.note || '').toLowerCase().includes(q)
        const matchExam = (m.scorecardTitle || '').toLowerCase().includes(q)
        if (!matchTopic && !matchNote && !matchExam) return false
      }
      return true
    })
  }, [allMistakes, selectedTag, searchQuery])

  // Aggregate Insights
  const insights = useMemo(() => {
    if (!allMistakes.length) return null

    const tagCounts = {}
    const topicCounts = {}
    allMistakes.forEach((m) => {
      tagCounts[m.tag] = (tagCounts[m.tag] || 0) + 1
      if (m.topic) {
        topicCounts[m.topic] = (topicCounts[m.topic] || 0) + 1
      }
    })

    const topTagEntry = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]
    const topTopicEntry = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]

    const tagObj = MISTAKE_TAGS.find((t) => t.id === topTagEntry?.[0])
    return {
      topTagLabel: tagObj?.label || topTagEntry?.[0] || 'N/A',
      topTagCount: topTagEntry?.[1] || 0,
      topTopic: topTopicEntry?.[0] || 'N/A',
      topTopicCount: topTopicEntry?.[1] || 0,
    }
  }, [allMistakes])

  const handleQuickAdd = async () => {
    if (!targetScorecardId) {
      toast.error('Select an exam attempt to attach this mistake to')
      return
    }

    const sc = scorecards.find((s) => s.id === targetScorecardId)
    if (!sc) {
      toast.error('Exam attempt not found')
      return
    }

    const tagInfo = MISTAKE_TAGS.find((t) => t.id === newMistake.tag)
    const noteText = newMistake.note.trim() || newMistake.topic.trim() || `${tagInfo?.label || 'Mistake'}`
    const targetModeId = sc._modeId || sc.modeId || (activeModeId !== 'all' ? activeModeId : null)

    try {
      await addMistakeToScorecard(user.uid, targetModeId, sc, {
        ...newMistake,
        note: noteText,
      })
      toast.success('Mistake logged!')
      setNewMistake({ tag: 'silly', topic: '', questionNo: '', note: '' })
      setQuickAddOpen(false)
    } catch (err) {
      console.error('[mistakes tab] failed to add:', err)
      toast.error('Failed to log mistake')
    }
  }

  const handleDeleteMistake = async (m) => {
    const sc = scorecards.find((s) => s.id === m.scorecardId)
    if (!sc) return
    const targetModeId = sc._modeId || sc.modeId || (activeModeId !== 'all' ? activeModeId : null)
    try {
      await removeMistakeFromScorecard(user.uid, targetModeId, sc, m.id)
      toast.success('Mistake removed')
    } catch (err) {
      console.error('[mistakes tab] failed to remove:', err)
      toast.error('Failed to remove mistake')
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* ── Summary Insights Strip ──────────────────────────────── */}
      {insights && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-line/60 bg-surface-2/30 p-3 flex flex-col justify-between">
            <span className="text-[11px] text-muted flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-rose-400" /> Total Mistakes Logged
            </span>
            <span className="text-2xl font-black text-ink">{allMistakes.length}</span>
            <span className="text-[10px] text-muted">across all recorded mocks</span>
          </div>

          <div className="rounded-2xl border border-line/60 bg-surface-2/30 p-3 flex flex-col justify-between">
            <span className="text-[11px] text-muted flex items-center gap-1">
              <Tag className="h-3 w-3 text-amber-400" /> Top Error Pattern
            </span>
            <span className="text-base font-bold text-amber-400 truncate">
              {insights.topTagLabel} ({insights.topTagCount})
            </span>
            <span className="text-[10px] text-muted">highest recurring leak</span>
          </div>

          <div className="rounded-2xl border border-line/60 bg-surface-2/30 p-3 flex flex-col justify-between">
            <span className="text-[11px] text-muted flex items-center gap-1">
              <Filter className="h-3 w-3 text-purple-400" /> Most Weak Topic
            </span>
            <span className="text-base font-bold text-purple-400 truncate">
              {insights.topTopic} ({insights.topTopicCount})
            </span>
            <span className="text-[10px] text-muted">needs revision & drill</span>
          </div>
        </div>
      )}

      {/* ── Filter Bar & Actions ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-line/60 bg-surface-2/30 p-2.5">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topic or error note..."
            className="w-full rounded-xl border border-line bg-surface pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-muted/60 outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2">
          {!quickAddOpen && scorecards.length > 0 && (
            <button
              onClick={() => setQuickAddOpen(true)}
              className="flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-glow-sm hover:opacity-95 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" /> Log Mistake
            </button>
          )}
        </div>
      </div>

      {/* Tag pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedTag('all')}
          className={cn(
            'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
            selectedTag === 'all'
              ? 'bg-accent text-white border-accent'
              : 'border-line/60 bg-surface text-muted hover:text-ink'
          )}
        >
          All ({allMistakes.length})
        </button>
        {MISTAKE_TAGS.map((t) => {
          const count = allMistakes.filter((m) => m.tag === t.id).length
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTag(t.id)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                selectedTag === t.id
                  ? `${t.color} font-bold shadow-sm`
                  : 'border-line/60 bg-surface text-muted hover:text-ink'
              )}
            >
              {t.label} ({count})
            </button>
          )
        })}
      </div>

      {/* ── Quick Add Mistake Box ───────────────────────────────── */}
      {quickAddOpen && (
        <div className="rounded-2xl border border-accent/40 bg-surface-2/40 p-3.5 flex flex-col gap-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink">Add Mistake to Exam Attempt</span>
            <button
              onClick={() => setQuickAddOpen(false)}
              className="text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] text-muted">Select Exam Attempt</label>
              <select
                value={targetScorecardId}
                onChange={(e) => setTargetScorecardId(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
              >
                {scorecards.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.score}/{s.totalMarks})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-0.5 block text-[10px] text-muted">Category</label>
              <select
                value={newMistake.tag}
                onChange={(e) => setNewMistake((m) => ({ ...m, tag: e.target.value }))}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
              >
                {MISTAKE_TAGS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newMistake.topic}
              onChange={(e) => setNewMistake((m) => ({ ...m, topic: e.target.value }))}
              placeholder="Topic (e.g. Seating Arrangement)"
              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
            />
            <input
              type="text"
              value={newMistake.questionNo}
              onChange={(e) => setNewMistake((m) => ({ ...m, questionNo: e.target.value }))}
              placeholder="Question # (e.g. Q18)"
              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
            />
          </div>

          <input
            type="text"
            value={newMistake.note}
            onChange={(e) => setNewMistake((m) => ({ ...m, note: e.target.value }))}
            placeholder="What went wrong and key takeaway for next mock..."
            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
          />

          <div className="flex justify-end">
            <button
              onClick={handleQuickAdd}
              className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white shadow-sm hover:opacity-95"
            >
              Save Mistake
            </button>
          </div>
        </div>
      )}

      {/* ── Mistakes List ───────────────────────────────────────── */}
      {filteredMistakes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center text-muted">
          <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">No mistakes match this filter.</p>
          <p className="text-xs text-muted/70">
            {allMistakes.length === 0
              ? 'Log mistakes during or after test attempts to systematically eliminate errors.'
              : 'Try clearing your search or category filter.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredMistakes.map((m) => {
            const tagInfo = MISTAKE_TAGS.find((t) => t.id === m.tag) || MISTAKE_TAGS[0]
            const parentScorecard = scorecards.find((s) => s.id === m.scorecardId)
            return (
              <div
                key={m.id}
                className="group rounded-2xl border border-line/60 bg-surface/80 p-3.5 flex flex-col gap-1.5 transition-all hover:border-accent/40 hover:bg-surface"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-bold', tagInfo.color)}>
                      {tagInfo.label}
                    </span>
                    {m.questionNo && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted">
                        {m.questionNo}
                      </span>
                    )}
                    {m.topic && (
                      <span className="text-xs font-semibold text-ink">
                        {m.topic}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenDetail?.(parentScorecard)}
                      className="text-[11px] font-medium text-accent hover:underline flex items-center gap-1"
                    >
                      {m.scorecardTitle}
                    </button>
                    <button
                      onClick={() => handleDeleteMistake(m)}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-rose-400 text-xs px-1"
                      title="Delete mistake"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <p className="text-xs text-ink/90 pl-1">{m.note}</p>

                <div className="flex items-center gap-3 text-[10px] text-muted pt-1 border-t border-line/30">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {m.scorecardDate ? new Date(m.scorecardDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    }) : 'N/A'}
                  </span>
                  {m._modeName && (
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" /> {m._modeName}
                    </span>
                  )}
                  <span>{m.scorecardSection}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
