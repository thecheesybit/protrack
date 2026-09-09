import { useState, useMemo, useEffect } from 'react'
import {
  GraduationCap,
  Plus,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Calendar,
  Search,
  Pencil,
  Settings2,
  Trash2,
  Trophy,
  ClipboardList,
  Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { useExams } from '@/hooks/useExams'
import { useScorecards } from '@/hooks/useScorecards'
import { WidgetFrame } from './WidgetFrame'
import { ScorecardEditorModal } from '@/components/scorecard/ScorecardEditorModal'
import { ExamEditorModal } from '@/components/scorecard/ExamEditorModal'
import { DeletedExamsModal } from '@/components/scorecard/DeletedExamsModal'
import { ScorecardDetailModal } from '@/components/scorecard/ScorecardDetailModal'
import { ScorecardCharts } from '@/components/scorecard/ScorecardCharts'
import { ScorecardMistakesTab } from '@/components/scorecard/ScorecardMistakesTab'
import { ScorecardAiCoach } from '@/components/scorecard/ScorecardAiCoach'
import { detectPortal, canonicalSectionName } from '@/services/scorecardParser'
import { cn } from '@/utils/cn'

export function ScorecardWidget({ widget, variant }) {
  const activeModeId = useStore((s) => s.activeModeId)
  const modes = useStore((s) => s.modes)

  // Realtime Exams (active & soft-deleted)
  const { exams, deletedExams, loading: examsLoading } = useExams(activeModeId)
  const [selectedExamId, setSelectedExamId] = useState('')
  const [trashOpen, setTrashOpen] = useState(false)

  // Automatically select the first exam when exams load and none is selected
  useEffect(() => {
    if (exams.length > 0) {
      if (!selectedExamId || (!exams.some((e) => e.id === selectedExamId) && selectedExamId !== 'all')) {
        setSelectedExamId(exams[0].id)
      }
    } else {
      setSelectedExamId('')
    }
  }, [exams, selectedExamId])

  // Realtime Scorecards: filtered by selectedExamId (or all if selectedExamId === 'all' or empty)
  const { scorecards, allScorecards, stats } = useScorecards(
    activeModeId,
    selectedExamId === 'all' ? null : selectedExamId
  )

  // Overall stats for "All Exams" tile
  const allStats = useMemo(() => {
    if (!allScorecards.length) {
      return { total: 0, avgScore: 0, avgAccuracy: 0, totalMistakes: 0 }
    }
    const total = allScorecards.length
    const totalScore = allScorecards.reduce((acc, s) => acc + (s.score || 0), 0)
    const avgScore = Math.round((totalScore / total) * 10) / 10

    const validAcc = allScorecards.filter((s) => s.accuracy != null)
    const avgAccuracy = validAcc.length
      ? Math.round((validAcc.reduce((acc, s) => acc + s.accuracy, 0) / validAcc.length) * 10) / 10
      : 0

    const totalMistakes = allScorecards.reduce((acc, s) => acc + (s.mistakes?.length || 0), 0)
    return { total, avgScore, avgAccuracy, totalMistakes }
  }, [allScorecards])

  // Per-exam stats lookup
  const examStatsMap = useMemo(() => {
    const map = {}
    for (const sc of allScorecards) {
      const eid = sc.examId || 'unassigned'
      if (!map[eid]) {
        map[eid] = { count: 0, totalScore: 0, mistakes: 0 }
      }
      map[eid].count += 1
      map[eid].totalScore += sc.score || 0
      map[eid].mistakes += sc.mistakes?.length || 0
    }
    return map
  }, [allScorecards])

  // Selected Exam Object
  const selectedExam = useMemo(() => {
    if (!selectedExamId || selectedExamId === 'all') return null
    return exams.find((e) => e.id === selectedExamId) || null
  }, [exams, selectedExamId])

  // Modals state
  const [activeTab, setActiveTab] = useState('attempts') // 'attempts' | 'trends' | 'mistakes' | 'coach'
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingScorecard, setEditingScorecard] = useState(null)
  const [examEditorOpen, setExamEditorOpen] = useState(false)
  const [editingExam, setEditingExam] = useState(null)
  const [examEditorModeId, setExamEditorModeId] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedScorecard, setSelectedScorecard] = useState(null)

  // Filter in Hero attempts list
  const [listTypeFilter, setListTypeFilter] = useState('all') // 'all' | 'sectional' | 'flt'
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const isHero = variant === 'hero'

  const activeModeObj = modes.find((m) => m.id === activeModeId)
  const activeScopeName = activeModeId === 'all' ? 'All Exams' : activeModeObj?.name || 'Current Scope'

  const availableSubjects = useMemo(() => {
    const set = new Set()
    for (const s of scorecards) {
      if (s.type === 'sectional' && s.sectionName) {
        set.add(canonicalSectionName(s.sectionName))
      }
    }
    return Array.from(set)
  }, [scorecards])

  const filteredAttempts = useMemo(() => {
    return scorecards.filter((s) => {
      if (listTypeFilter !== 'all' && s.type !== listTypeFilter) return false
      if (listTypeFilter === 'sectional' && subjectFilter !== 'all') {
        const canonical = canonicalSectionName(s.sectionName)
        if (canonical !== subjectFilter) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = (s.title || '').toLowerCase().includes(q)
        const matchSection = (s.sectionName || '').toLowerCase().includes(q)
        const matchTopic = (s.topicName || '').toLowerCase().includes(q)
        if (!matchTitle && !matchSection && !matchTopic) return false
      }
      return true
    })
  }, [scorecards, listTypeFilter, subjectFilter, searchQuery])

  const openCreateScorecard = () => {
    if (exams.length === 0) {
      toast('Please create an Exam first before logging attempts.', { icon: 'ℹ️' })
      openCreateExam()
      return
    }
    setEditingScorecard(null)
    setEditorOpen(true)
  }

  const openEditScorecard = (sc) => {
    setEditingScorecard(sc)
    setEditorOpen(true)
  }

  const openDetail = (sc) => {
    setSelectedScorecard(sc)
    setDetailOpen(true)
  }

  const openCreateExam = (modeId) => {
    if (activeModeId === 'all' && !modeId) {
      setExamEditorModeId(modes[0]?.id || '')
    } else {
      setExamEditorModeId(modeId || activeModeId)
    }
    setEditingExam(null)
    setExamEditorOpen(true)
  }

  const openEditExam = (e, exam) => {
    e.stopPropagation()
    setEditingExam(exam)
    setExamEditorModeId(exam._modeId || activeModeId)
    setExamEditorOpen(true)
  }

  return (
    <>
      <WidgetFrame
        widget={widget}
        variant={variant}
        subtitle={
          exams.length === 0
            ? 'No exams created'
            : `${scorecards.length} ${selectedExam ? selectedExam.name : 'total'} attempts · ${stats.avgScore} avg`
        }
        headerActions={
          isHero ? (
            <div className="flex items-center gap-2">
              {/* Tab Navigation if exams exist */}
              {exams.length > 0 && (
                <div className="flex rounded-xl border border-line/50 bg-surface-2/40 p-0.5">
                  <button
                    onClick={() => setActiveTab('attempts')}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                      activeTab === 'attempts' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
                    )}
                  >
                    Attempts ({scorecards.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('trends')}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                      activeTab === 'trends' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
                    )}
                  >
                    <TrendingUp className="h-3 w-3" /> Trends
                  </button>
                  <button
                    onClick={() => setActiveTab('mistakes')}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                      activeTab === 'mistakes' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
                    )}
                  >
                    <AlertCircle className="h-3 w-3" /> Mistakes ({stats.totalMistakes})
                  </button>
                  <button
                    onClick={() => setActiveTab('coach')}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                      activeTab === 'coach' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
                    )}
                  >
                    <Sparkles className="h-3 w-3 text-amber-300" /> AI Coach
                  </button>
                </div>
              )}

              {/* Add Exam button */}
              <button
                onClick={() => openCreateExam()}
                className="flex items-center gap-1 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-ink transition-colors"
                title="Add Exam"
              >
                <Plus className="h-3.5 w-3.5" /> Add Exam
              </button>

              {/* Record Attempt button */}
              <button
                onClick={openCreateScorecard}
                className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-glow-sm hover:opacity-95 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" /> Record Attempt
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {exams.length === 0 ? (
                <button
                  onClick={() => openCreateExam()}
                  className="flex items-center gap-1 rounded-lg bg-accent px-2 py-1 text-xs font-medium text-white shadow-glow-sm hover:opacity-95"
                >
                  <Plus className="h-3 w-3" /> Add Exam
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={openCreateScorecard}
                    className="flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors"
                    title="Quick Paste Mock Result (Smartkeeda, Adda247, Guidely, Oliveboard)"
                  >
                    <Zap className="h-3 w-3" /> Paste
                  </button>
                  <button
                    onClick={openCreateScorecard}
                    className="flex items-center gap-1 rounded-lg border border-line bg-surface-2/50 px-2 py-1 text-[11px] text-muted hover:text-ink"
                  >
                    <Plus className="h-3 w-3" /> Record
                  </button>
                </div>
              )}
            </div>
          )
        }
      >
        {/* ── CASE 0: STILL LOADING EXAMS (avoid flashing the empty state) ── */}
        {examsLoading && exams.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-12 text-xs text-muted">
            Loading exams…
          </div>
        ) : exams.length === 0 ? (
          /* ── CASE 1: NO EXAMS EXIST (ASK TO ADD EXAM) ──────────── */
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line/70 p-8 text-center bg-surface-2/20">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-glow-sm">
              <Trophy className="h-7 w-7" />
            </div>
            <div className="max-w-md">
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-bold text-accent uppercase tracking-wider">
                Step 1: Exam Setup
              </span>
              <h3 className="mt-2 text-base font-bold text-ink">Add Your First Exam</h3>
              <p className="mt-1 text-xs text-muted">
                ProTrack organizes your scorecard attempts exam-wise (e.g. RRB PO, IBPS PO, SSC CGL, CAT, JEE).
                Set up an exam to define target scores, accuracy benchmarks, and track your error patterns.
              </p>
            </div>
            <button
              onClick={() => openCreateExam()}
              className="mt-2 flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-glow hover:opacity-95 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" /> Add Exam
            </button>
          </div>
        ) : isHero ? (
          /* ── CASE 2: HERO / MASTER-DETAIL EXAM-WISE VIEW ─────────── */
          <div className="flex h-full min-h-0 gap-4">
            {/* ── Left Sidebar: Exam Master List ─────────────────────── */}
            <div className="flex w-60 shrink-0 flex-col gap-2 overflow-y-auto pr-1">
              <div className="flex items-center justify-between px-1 text-xs font-semibold text-muted">
                <span className="flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-accent" /> Exams ({exams.length})
                </span>
                <button
                  onClick={() => openCreateExam()}
                  className="flex items-center gap-0.5 text-[11px] font-semibold text-accent hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add Exam
                </button>
              </div>

              {/* Individual Exams */}
              {exams.map((ex) => {
                const st = examStatsMap[ex.id]
                const count = st?.count || 0
                const avgScore = count ? Math.round((st.totalScore / count) * 10) / 10 : 0
                const isSelected = selectedExamId === ex.id

                return (
                  <div
                    key={ex.id}
                    onClick={() => setSelectedExamId(ex.id)}
                    className={cn(
                      'group relative cursor-pointer rounded-xl border p-2.5 text-left transition-all',
                      isSelected
                        ? 'border-accent/60 bg-surface-2 shadow-sm'
                        : 'border-line/50 bg-surface/40 hover:border-accent/30 hover:bg-surface-2/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: ex.color || 'var(--accent)' }}
                        />
                        <span className="truncate text-xs font-bold text-ink group-hover:text-accent transition-colors">
                          {ex.name}
                        </span>
                      </div>

                      {/* Edit Exam Button */}
                      <button
                        onClick={(e) => openEditExam(e, ex)}
                        className="rounded-lg p-1 text-muted hover:text-ink hover:bg-surface-2 transition-colors"
                        title="Rename, change scope, or manage exam"
                      >
                        <Settings2 className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted mb-1">
                      <span className="truncate">{ex.category || 'General'}</span>
                      {ex.targetScore ? (
                        <span className="font-mono text-[10px]">Tgt: {ex.targetScore}</span>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-line/30">
                      <span className="text-muted font-mono text-[10px]">{count} attempts</span>
                      <span className="font-bold text-accent">{count > 0 ? `${avgScore} avg` : 'No attempts'}</span>
                    </div>
                  </div>
                )
              })}

              {/* "All Exams" aggregate filter */}
              <button
                onClick={() => setSelectedExamId('all')}
                className={cn(
                  'rounded-xl border p-2.5 text-left transition-all mt-1',
                  selectedExamId === 'all'
                    ? 'border-accent/60 bg-surface-2 shadow-sm'
                    : 'border-line/40 bg-surface/30 hover:border-accent/30'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-ink">All Exams Combined</span>
                  <span className="rounded-full bg-surface-2 px-1.5 py-0.2 text-[10px] font-mono text-muted">
                    {allScorecards.length} tests
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Cross-Exam Overview</span>
                  <span className="font-semibold text-accent">{allStats.avgScore} avg</span>
                </div>
              </button>

              {/* 15-Day Trash / Restorable Exams */}
              {deletedExams && deletedExams.length > 0 && (
                <button
                  onClick={() => setTrashOpen(true)}
                  className="mt-2.5 flex items-center justify-between rounded-xl border border-dashed border-rose-500/30 bg-rose-500/5 px-2.5 py-2 text-xs text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/50 transition-all w-full text-left"
                  title="View and restore deleted exams within 15 days"
                >
                  <div className="flex items-center gap-1.5">
                    <Trash2 className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    <span className="font-semibold text-rose-200">Trash ({deletedExams.length})</span>
                  </div>
                  <span className="text-[10px] text-rose-300/80 font-medium">15-day restore</span>
                </button>
              )}
            </div>

            {/* ── Right Content: Selected Exam Report Card ────────────── */}
            <div className="min-w-0 flex-1 border-l border-line/50 pl-4 flex flex-col overflow-y-auto pr-1">
              {/* Header Hero Banner for selected Exam */}
              <div className="rounded-2xl border border-line/60 bg-gradient-to-r from-surface-2/50 via-surface/40 to-surface-2/20 p-3.5 mb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {selectedExam ? (
                      <span
                        className="h-4 w-4 rounded-full ring-2 ring-surface shadow-sm shrink-0"
                        style={{ backgroundColor: selectedExam.color || 'var(--accent)' }}
                      />
                    ) : (
                      <Trophy className="h-5 w-5 text-accent shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        {selectedExam ? (
                          <button
                            onClick={(e) => openEditExam(e, selectedExam)}
                            className="group flex items-center gap-1.5 text-left hover:opacity-90 transition-all"
                            title="Click to rename, change scope, or manage exam"
                          >
                            <h3 className="font-bold text-base text-ink group-hover:text-accent transition-colors">
                              {selectedExam.name}
                            </h3>
                            <Pencil className="h-3.5 w-3.5 text-muted group-hover:text-accent transition-colors opacity-60 group-hover:opacity-100" />
                          </button>
                        ) : (
                          <h3 className="font-bold text-base text-ink">All Exams Overview</h3>
                        )}
                        {selectedExam?.category && (
                          <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted">
                            {selectedExam.category}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted">
                        {selectedExam
                          ? `Tracking mock attempts and error analytics for ${selectedExam.name}`
                          : 'Aggregated view of mock tests, scores and error insights across all exams'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedExam && (
                      <button
                        onClick={(e) => openEditExam(e, selectedExam)}
                        className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-accent/60 hover:bg-surface-2 transition-all shadow-xs"
                      >
                        <Settings2 className="h-3.5 w-3.5 text-accent" /> Manage Exam
                      </button>
                    )}
                    <button
                      onClick={openCreateScorecard}
                      className="flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-glow-sm hover:opacity-95"
                    >
                      <Plus className="h-3.5 w-3.5" /> Record Attempt
                    </button>
                  </div>
                </div>

                {/* KPI Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-line/30 text-center">
                  <div className="rounded-xl bg-surface/60 p-2">
                    <span className="block text-[10px] text-muted font-medium">Attempts Logged</span>
                    <span className="text-sm font-extrabold text-ink">{scorecards.length}</span>
                  </div>
                  <div className="rounded-xl bg-surface/60 p-2">
                    <span className="block text-[10px] text-muted font-medium">
                      Avg Score {selectedExam?.targetScore ? `/ Target ${selectedExam.targetScore}` : ''}
                    </span>
                    <span className="text-sm font-extrabold text-accent">{stats.avgScore}</span>
                  </div>
                  <div className="rounded-xl bg-surface/60 p-2">
                    <span className="block text-[10px] text-muted font-medium">
                      Avg Accuracy {selectedExam?.targetAccuracy ? `(Tgt ${selectedExam.targetAccuracy}%)` : ''}
                    </span>
                    <span className="text-sm font-extrabold text-emerald-400">{stats.avgAccuracy}%</span>
                  </div>
                  <div className="rounded-xl bg-surface/60 p-2">
                    <span className="block text-[10px] text-muted font-medium">
                      Avg Percentile {selectedExam?.targetPercentile ? `(Tgt ${selectedExam.targetPercentile}%)` : ''}
                    </span>
                    <span className="text-sm font-extrabold text-indigo-400">{stats.avgPercentile}%</span>
                  </div>
                </div>
              </div>

              {/* ── Sub-tabs Content ─────────────────────────────────── */}
              {scorecards.length === 0 ? (
                /* Prompt to record attempt when exam is selected and has 0 attempts */
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line/60 py-12 text-center bg-surface-2/15">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-accent">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div className="max-w-sm">
                    <h4 className="font-bold text-sm text-ink">
                      {selectedExam
                        ? `No attempts recorded for ${selectedExam.name} yet`
                        : 'No attempts recorded yet'}
                    </h4>
                    <p className="mt-1 text-xs text-muted">
                      Ready to track your exam journey? Paste your raw scorecard copy from Oliveboard,
                      Testbook, PracticeMock or log your sectional / full test scores manually.
                    </p>
                  </div>
                  <button
                    onClick={openCreateScorecard}
                    className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-glow-sm hover:opacity-95 transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" /> Record Attempt for {selectedExam?.name || 'Exam'}
                  </button>
                </div>
              ) : (
                <>
                  {activeTab === 'attempts' && (
                    <div className="flex flex-col gap-3">
                      {/* Quick Paste Mock Banner */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent shadow-xs">
                            <Zap className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-ink">Multi-Portal Mock Parser</span>
                              <span className="rounded bg-surface-2 px-1.5 py-0.2 text-[9px] font-mono text-accent">
                                Instant Auto-Detect
                              </span>
                            </div>
                            <p className="text-[11px] text-muted truncate">
                              Paste raw results from Smartkeeda, Adda247, Guidely or Oliveboard — auto-extracts marks, accuracy, time & mistakes.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={openCreateScorecard}
                          className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-glow-sm hover:opacity-95 transition-all active:scale-95 shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5" /> Paste / Record Mock
                        </button>
                      </div>

                      {/* Search & Sub-filters */}
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/60 bg-surface-2/30 p-2.5">
                        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search title, section, or topic..."
                            className="w-full rounded-xl border border-line bg-surface pl-8 pr-3 py-1 text-xs text-ink placeholder:text-muted/60 outline-none focus:border-accent"
                          />
                        </div>

                        <div className="flex items-center gap-1 rounded-xl border border-line/50 bg-surface p-0.5">
                          <button
                            onClick={() => {
                              setListTypeFilter('all')
                              setSubjectFilter('all')
                            }}
                            className={cn(
                              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                              listTypeFilter === 'all' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
                            )}
                          >
                            All ({scorecards.length})
                          </button>
                          <button
                            onClick={() => setListTypeFilter('sectional')}
                            className={cn(
                              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                              listTypeFilter === 'sectional' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
                            )}
                          >
                            Sectional ({scorecards.filter((s) => s.type === 'sectional').length})
                          </button>
                          <button
                            onClick={() => {
                              setListTypeFilter('flt')
                              setSubjectFilter('all')
                            }}
                            className={cn(
                              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                              listTypeFilter === 'flt' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
                            )}
                          >
                            FLT ({scorecards.filter((s) => s.type === 'flt').length})
                          </button>
                        </div>
                      </div>

                      {/* Subject Chips (Only visible in Sectional filter) */}
                      {listTypeFilter === 'sectional' && availableSubjects.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 px-0.5">
                          <span className="text-[10px] font-bold text-muted uppercase tracking-wider shrink-0 mr-1">
                            Subject:
                          </span>
                          <button
                            onClick={() => setSubjectFilter('all')}
                            className={cn(
                              'shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                              subjectFilter === 'all'
                                ? 'bg-accent text-white shadow-xs'
                                : 'bg-surface-2/50 text-muted hover:text-ink'
                            )}
                          >
                            All Subjects
                          </button>
                          {availableSubjects.map((subj) => (
                            <button
                              key={subj}
                              onClick={() => setSubjectFilter(subj)}
                              className={cn(
                                'shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                                subjectFilter === subj
                                  ? 'bg-accent text-white shadow-xs'
                                  : 'bg-surface-2/50 text-muted hover:text-ink'
                              )}
                            >
                              {subj}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Attempts Grid / Cards */}
                      {filteredAttempts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line/60 py-8 text-center">
                          <GraduationCap className="h-8 w-8 text-muted/60" />
                          <span className="text-sm font-semibold text-ink">
                            No attempts match your search/filter
                          </span>
                          <button
                            onClick={openCreateScorecard}
                            className="mt-1 flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-glow-sm hover:opacity-95"
                          >
                            <Plus className="h-3.5 w-3.5" /> Record Attempt
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {filteredAttempts.map((sc) => {
                            const scorePct = sc.totalMarks ? Math.round(((sc.score || 0) / sc.totalMarks) * 100) : 0
                            const portal = sc.detectedPortal || (sc.rawText ? detectPortal(sc.rawText) : null)

                            return (
                              <div
                                key={sc.id}
                                onClick={() => openDetail(sc)}
                                className="group relative cursor-pointer rounded-2xl border border-line/60 bg-surface/75 p-3.5 transition-all hover:border-accent/50 hover:bg-surface hover:shadow-glow-sm"
                              >
                                {/* Header */}
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                      <span
                                        className={cn(
                                          'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                                          sc.type === 'flt' ? 'bg-amber-500/15 text-amber-400' : 'bg-accent/15 text-accent'
                                        )}
                                      >
                                        {sc.type === 'flt' ? 'FLT' : 'Sectional'}
                                      </span>
                                      {portal && portal !== 'generic' && (
                                        <span
                                          className={cn(
                                            'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                                            portal === 'smartkeeda'
                                              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                              : portal === 'adda247'
                                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                              : portal === 'guidely'
                                              ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                                              : portal === 'oliveboard'
                                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                              : 'bg-surface-2 text-muted'
                                          )}
                                        >
                                          {portal}
                                        </span>
                                      )}
                                      {sc.examName && (
                                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                                          {sc.examName}
                                        </span>
                                      )}
                                      {sc._modeName && (
                                        <span
                                          className="rounded px-1.5 py-0.5 text-[9px] font-medium text-white"
                                          style={{ backgroundColor: sc._modeColor || 'var(--accent)' }}
                                        >
                                          {sc._modeName}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-muted font-mono">#{sc.serialNo || 1}</span>
                                    </div>
                                    <h4 className="font-bold text-sm text-ink truncate group-hover:text-accent transition-colors">
                                      {sc.title}
                                    </h4>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <div className="flex items-baseline gap-1 justify-end">
                                      <span className="font-display text-2xl font-extrabold text-ink">{sc.score}</span>
                                      <span className="text-[11px] text-muted">/{sc.totalMarks || 0}</span>
                                    </div>
                                    <span className="text-[10px] text-muted/80">{scorePct}%</span>
                                  </div>
                                </div>

                                {/* Section / Topic tag */}
                                <div className="flex items-center justify-between text-xs text-muted mb-2.5">
                                  <span className="truncate">
                                    {sc.sectionName}
                                    {sc.topicName ? ` • ${sc.topicName}` : ''}
                                  </span>
                                  <span className="flex items-center gap-1 text-[11px]">
                                    <Calendar className="h-3 w-3" />
                                    {sc.attemptDate
                                      ? new Date(sc.attemptDate).toLocaleDateString(undefined, {
                                          month: 'short',
                                          day: 'numeric',
                                        })
                                      : 'N/A'}
                                  </span>
                                </div>

                                {/* Metrics Pills row */}
                                <div className="grid grid-cols-3 gap-1.5 text-center text-xs py-2 border-t border-line/40">
                                  <div className="rounded-lg bg-surface-2/40 py-1">
                                    <span className="block text-[10px] text-muted">Accuracy</span>
                                    <span className="font-bold text-emerald-400">
                                      {sc.accuracy != null ? `${sc.accuracy}%` : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="rounded-lg bg-surface-2/40 py-1">
                                    <span className="block text-[10px] text-muted">Percentile</span>
                                    <span className="font-bold text-accent">
                                      {sc.percentile != null ? `${sc.percentile}%` : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="rounded-lg bg-surface-2/40 py-1">
                                    <span className="block text-[10px] text-muted">Time</span>
                                    <span className="font-bold text-ink truncate px-1">
                                      {sc.timeSpent || (sc.timeSpentMinutes ? `${sc.timeSpentMinutes}m` : 'N/A')}
                                    </span>
                                  </div>
                                </div>

                                {/* FLT Section Breakdown Preview */}
                                {sc.type === 'flt' && Array.isArray(sc.sections) && sc.sections.length > 0 && (
                                  <div className="mt-2.5 rounded-xl border border-line/40 bg-surface-2/30 p-2 text-left">
                                    <div className="flex items-center justify-between text-[10px] text-muted mb-1.5 font-semibold">
                                      <span>Section Breakdown</span>
                                      <span className="font-mono text-accent">{sc.sections.length} sections</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {sc.sections.map((sec, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center gap-1 rounded-lg bg-surface/80 border border-line/30 px-1.5 py-0.5 text-[10px]"
                                        >
                                          <span className="text-ink font-medium truncate max-w-[80px]" title={sec.name}>
                                            {sec.name || sec.canonicalName}
                                          </span>
                                          <span className="font-bold text-accent font-mono">{sec.score}</span>
                                          {sec.totalMarks ? (
                                            <span className="text-[9px] text-muted/70 font-mono">/{sec.totalMarks}</span>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Footer: Mistakes & Questions */}
                                <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted pt-2 border-t border-line/30">
                                  <div className="flex items-center gap-2">
                                    <span className="text-emerald-400 font-medium">✓ {sc.correct || 0}</span>
                                    <span className="text-rose-400 font-medium">✗ {sc.wrong || 0}</span>
                                    <span className="text-muted">○ {sc.unattempted || 0}</span>
                                  </div>

                                  {(sc.mistakes?.length || 0) > 0 ? (
                                    <span className="flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                                      <AlertCircle className="h-3 w-3" /> {sc.mistakes.length} mistakes
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-muted/60">No mistakes logged</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'trends' && (
                    <ScorecardCharts scorecards={scorecards} exam={selectedExam} />
                  )}

                  {activeTab === 'mistakes' && (
                    <ScorecardMistakesTab scorecards={scorecards} onOpenDetail={openDetail} />
                  )}

                  {activeTab === 'coach' && (
                    <ScorecardAiCoach
                      scorecards={scorecards}
                      activeScopeName={selectedExam ? selectedExam.name : activeScopeName}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          /* ── COMPACT / DASHBOARD VIEW ───────────────────────────── */
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {/* Quick Exam Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {exams.map((ex) => {
                const count = examStatsMap[ex.id]?.count || 0
                return (
                  <button
                    key={ex.id}
                    onClick={() => setSelectedExamId(ex.id)}
                    className={cn(
                      'shrink-0 flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors',
                      selectedExamId === ex.id
                        ? 'bg-accent text-white shadow-sm'
                        : 'bg-surface-2/40 text-muted hover:text-ink'
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: ex.color || 'var(--accent)' }}
                    />
                    <span className="truncate max-w-[90px]">{ex.name}</span>
                    <span className="text-[9px] opacity-75 font-mono">({count})</span>
                  </button>
                )
              })}
              <button
                onClick={() => setSelectedExamId('all')}
                className={cn(
                  'shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors',
                  selectedExamId === 'all'
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-surface-2/40 text-muted hover:text-ink'
                )}
              >
                All ({allScorecards.length})
              </button>
            </div>

            {/* Quick summary strip */}
            <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-line/60 bg-surface-2/30 p-2 text-center text-xs">
              <div>
                <span className="block text-[10px] text-muted">Attempts</span>
                <span className="font-extrabold text-ink">{scorecards.length}</span>
              </div>
              <div>
                <span className="block text-[10px] text-muted">Avg Score</span>
                <span className="font-extrabold text-accent">{stats.avgScore}</span>
              </div>
              <div>
                <span className="block text-[10px] text-muted">Avg Acc</span>
                <span className="font-extrabold text-emerald-400">{stats.avgAccuracy}%</span>
              </div>
            </div>

            {/* Recent attempts or Prompt to Record */}
            {scorecards.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-4 text-center rounded-xl border border-dashed border-line/50">
                <ClipboardList className="h-5 w-5 text-muted/60" />
                <span className="text-xs text-muted">
                  {selectedExam ? `No attempts for ${selectedExam.name} yet` : 'No attempts recorded'}
                </span>
                <button
                  onClick={openCreateScorecard}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  + Record first attempt
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {scorecards.slice(0, 4).map((sc) => {
                  const portal = sc.detectedPortal || (sc.rawText ? detectPortal(sc.rawText) : null)
                  return (
                    <button
                      key={sc.id}
                      onClick={() => openDetail(sc)}
                      className="flex items-center justify-between gap-2 rounded-xl border border-line/50 bg-surface-2/30 px-3 py-2 text-left transition-colors hover:border-accent/40 hover:bg-surface-2/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full shrink-0',
                              sc.type === 'flt' ? 'bg-amber-400' : 'bg-accent'
                            )}
                          />
                          <span className="min-w-0 truncate text-xs font-semibold text-ink">
                            {sc.title}
                          </span>
                          {portal && portal !== 'generic' && (
                            <span className="rounded bg-accent/10 px-1 py-0.2 text-[8px] font-bold uppercase tracking-wider text-accent shrink-0">
                              {portal}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted truncate block">
                          {sc.examName ? `${sc.examName} • ` : ''}
                          {sc.sectionName}
                          {sc.accuracy != null ? ` • ${sc.accuracy}% acc` : ''}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="block text-xs font-bold text-ink">
                          {sc.score}/{sc.totalMarks || 0}
                        </span>
                        {(sc.mistakes?.length || 0) > 0 && (
                          <span className="text-[10px] text-rose-400 font-medium">
                            {sc.mistakes.length} errors
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <p className="mt-auto text-center text-[10px] text-muted/70">
              Double-click for master report card, trends & mistakes
            </p>
          </div>
        )}
      </WidgetFrame>

      {/* Scorecard Editor Modal */}
      <ScorecardEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        modeId={activeModeId}
        scorecard={editingScorecard}
        exams={exams}
        defaultExamId={selectedExamId !== 'all' ? selectedExamId : (exams[0]?.id || '')}
        onOpenExamEditor={(modeId) => openCreateExam(modeId)}
        nextSerial={scorecards.length + 1}
        onDeleted={(id) => {
          if (selectedScorecard?.id === id) {
            setSelectedScorecard(null)
            setDetailOpen(false)
          }
        }}
      />

      {/* Exam Editor Modal */}
      <ExamEditorModal
        open={examEditorOpen}
        onClose={() => setExamEditorOpen(false)}
        modeId={examEditorModeId || activeModeId}
        exam={editingExam}
        order={exams.length}
        onDeleted={(id) => {
          if (selectedExamId === id) setSelectedExamId(exams.find((e) => e.id !== id)?.id || 'all')
        }}
      />

      {/* 15-Day Trash / Restorable Deleted Exams Modal */}
      <DeletedExamsModal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        deletedExams={deletedExams}
        activeModeId={activeModeId}
        onRestored={(id) => {
          setSelectedExamId(id)
        }}
      />

      {/* Detail Modal */}
      <ScorecardDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        scorecard={selectedScorecard}
        modeId={selectedScorecard?._modeId || selectedScorecard?.modeId || (activeModeId !== 'all' ? activeModeId : modes[0]?.id)}
        onEdit={(sc) => openEditScorecard(sc)}
      />
    </>
  )
}
