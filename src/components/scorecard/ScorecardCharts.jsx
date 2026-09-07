import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts'
import {
  TrendingUp,
  Target,
  Award,
  AlertCircle,
  BarChart3,
  Filter,
  ShieldCheck,
  Activity,
  Flame,
} from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { cn } from '@/utils/cn'

const MISTAKE_COLORS = {
  silly: '#f43f5e',
  speed: '#f59e0b',
  concept: '#a855f7',
  calculation: '#3b82f6',
  misread: '#f97316',
  formula: '#06b6d4',
  guess: '#ef4444',
  other: '#94a3b8',
}

const MISTAKE_LABELS = {
  silly: 'Silly Mistake',
  speed: 'Speed Trap',
  concept: 'Concept Gap',
  calculation: 'Calculation Error',
  misread: 'Misread Question',
  formula: 'Formula Miss',
  guess: 'Negative Guess',
  other: 'Other Error',
}

function LegendBadge({ color, label, value, isDashed = false }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-2.5 py-1 text-xs shadow-sm backdrop-blur-md">
      {isDashed ? (
        <span
          className="inline-block w-4 border-t-2 border-dashed"
          style={{ borderColor: color }}
        />
      ) : (
        <span
          className="inline-block h-2.5 w-2.5 rounded-full shadow-sm"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="font-semibold text-slate-100">{label}</span>
      {value != null && (
        <span className="font-mono text-[11px] font-bold text-slate-300">
          {value}
        </span>
      )}
    </div>
  )
}

function ScientificTooltip({ active, payload, label, targetScore }) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]?.payload || {}

  const scoreDelta =
    targetScore != null && data.score != null
      ? Number((data.score - targetScore).toFixed(2))
      : null

  return (
    <div className="min-w-[210px] rounded-2xl border border-white/15 bg-slate-950/95 p-3.5 text-xs text-slate-100 shadow-2xl backdrop-blur-xl">
      <div className="border-b border-white/10 pb-2 mb-2">
        <div className="font-bold text-sm text-white">{data.title || label}</div>
        <div className="text-[10px] text-slate-400">Attempt {data.name || label}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 py-1 text-[11px]">
        <div>
          <span className="text-slate-400 block text-[10px]">Score</span>
          <span className="font-bold font-mono text-indigo-300 text-sm">
            {data.score != null ? data.score : '—'}
            {data.totalMarks ? <span className="text-[10px] text-slate-400 font-normal"> / {data.totalMarks}</span> : ''}
          </span>
          {scoreDelta != null && (
            <span
              className={cn(
                'block text-[9px] font-semibold mt-0.5',
                scoreDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} vs Target
            </span>
          )}
        </div>

        <div>
          <span className="text-slate-400 block text-[10px]">3-Test SMA</span>
          <span className="font-bold font-mono text-cyan-300 text-sm">
            {data.sma3 != null ? data.sma3 : '—'}
          </span>
        </div>

        {data.percentile != null && (
          <div>
            <span className="text-slate-400 block text-[10px]">Percentile</span>
            <span className="font-bold font-mono text-sky-300">
              {data.percentile}%
            </span>
          </div>
        )}

        {data.accuracy != null && (
          <div>
            <span className="text-slate-400 block text-[10px]">Accuracy</span>
            <span className="font-bold font-mono text-emerald-300">
              {data.accuracy}%
            </span>
          </div>
        )}
      </div>

      {(data.correct != null || data.wrong != null) && (
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
          <span className="text-emerald-400 font-medium">✓ {data.correct || 0} Correct</span>
          <span className="text-rose-400 font-medium">✗ {data.wrong || 0} Wrong</span>
          <span className="text-slate-400 font-medium">○ {data.unattempted || 0} Skipped</span>
        </div>
      )}

      {data.negativeMarks > 0 && (
        <div className="mt-1 text-[10px] text-rose-300 font-medium">
          Negative Penalty: -{data.negativeMarks} marks
        </div>
      )}
    </div>
  )
}

export function ScorecardCharts({ scorecards = [], exam = null }) {
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'sectional' | 'flt'
  const [sectionFilter, setSectionFilter] = useState('all')

  // Extract distinct sections available
  const availableSections = useMemo(() => {
    const set = new Set()
    scorecards.forEach((s) => {
      if (s.sectionName && s.sectionName !== 'All Sections') {
        set.add(s.sectionName)
      }
    })
    return Array.from(set)
  }, [scorecards])

  // Filtered dataset
  const filtered = useMemo(() => {
    return scorecards.filter((s) => {
      if (typeFilter !== 'all' && s.type !== typeFilter) return false
      if (sectionFilter !== 'all' && s.sectionName !== sectionFilter) return false
      return true
    })
  }, [scorecards, typeFilter, sectionFilter])

  // Target values from parent exam
  const targetScore = exam?.targetScore != null && Number(exam.targetScore) > 0 ? Number(exam.targetScore) : null
  const targetAccuracy = exam?.targetAccuracy != null && Number(exam.targetAccuracy) > 0 ? Number(exam.targetAccuracy) : null
  const targetPercentile = exam?.targetPercentile != null && Number(exam.targetPercentile) > 0 ? Number(exam.targetPercentile) : null

  // Sort chronologically (oldest to newest) & calculate scientific rolling metrics
  const chronological = useMemo(() => {
    const raw = [...filtered].reverse()
    return raw.map((s, idx) => {
      const dateStr = s.attemptDate
        ? new Date(s.attemptDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : `#${s.serialNo || idx + 1}`

      // 3-attempt simple moving average (SMA-3)
      const window = raw.slice(Math.max(0, idx - 2), idx + 1)
      const sma3 = Number((window.reduce((acc, curr) => acc + (curr.score || 0), 0) / window.length).toFixed(2))

      return {
        id: s.id,
        name: `#${s.serialNo || idx + 1} (${dateStr})`,
        shortName: `#${s.serialNo || idx + 1}`,
        dateStr,
        title: s.title || `Attempt #${s.serialNo || idx + 1}`,
        score: s.score || 0,
        sma3,
        totalMarks: s.totalMarks || 0,
        percentile: s.percentile != null ? s.percentile : null,
        accuracy: s.accuracy != null ? s.accuracy : null,
        correct: s.correct || 0,
        wrong: s.wrong || 0,
        unattempted: s.unattempted || 0,
        mistakeCount: s.mistakes?.length || 0,
        negativeMarks: s.negativeMarks || 0,
      }
    })
  }, [filtered])

  // Aggregate Mistakes by tag & marks lost
  const mistakeData = useMemo(() => {
    const counts = {}
    const marksLost = {}

    filtered.forEach((s) => {
      ;(s.mistakes || []).forEach((m) => {
        const t = m.tag || 'other'
        counts[t] = (counts[t] || 0) + 1
        marksLost[t] = (marksLost[t] || 0) + (m.penalty || 0.25)
      })
    })

    return Object.entries(counts)
      .map(([key, count]) => ({
        tag: key,
        name: MISTAKE_LABELS[key] || key,
        count,
        marksLost: Number((marksLost[key] || count * 0.25).toFixed(2)),
        fill: MISTAKE_COLORS[key] || '#94a3b8',
      }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])

  // Scientific Performance Metrics
  const summary = useMemo(() => {
    if (!filtered.length) {
      return {
        count: 0,
        avgScore: 0,
        avgAccuracy: 0,
        peakPercentile: 0,
        totalMistakes: 0,
        stdDev: '0.0',
        stabilityLabel: 'N/A',
        netEfficiency: 100,
        totalNegativePenalty: 0,
      }
    }
    const count = filtered.length
    const scores = filtered.map((s) => s.score || 0)
    const avgScore = Number((scores.reduce((a, b) => a + b, 0) / count).toFixed(1))

    // Standard deviation (Score Consistency)
    const mean = avgScore
    const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count
    const stdDevVal = Math.sqrt(variance)
    const stdDev = stdDevVal.toFixed(1)
    let stabilityLabel = 'High Consistency'
    if (stdDevVal > 4.5) stabilityLabel = 'Volatile Performance'
    else if (stdDevVal > 2.5) stabilityLabel = 'Moderate Variance'

    // Accuracy
    const validAcc = filtered.filter((s) => s.accuracy != null)
    const avgAccuracy = validAcc.length
      ? (validAcc.reduce((a, s) => a + s.accuracy, 0) / validAcc.length).toFixed(1)
      : '0'

    // Percentile
    const percentiles = filtered.map((s) => s.percentile || 0)
    const peakPercentile = Math.max(...percentiles, 0).toFixed(1)

    // Mistakes & Negative Marking impact
    const totalMistakes = filtered.reduce((a, s) => a + (s.mistakes?.length || 0), 0)
    const totalNegativePenalty = Number(
      filtered.reduce((a, s) => a + (s.negativeMarks || 0), 0).toFixed(2)
    )

    // Net Efficiency: (Total Score / Total Correct Questions) * 100
    const totalCorrect = filtered.reduce((a, s) => a + (s.correct || 0), 0)
    const totalScoreAchieved = filtered.reduce((a, s) => a + (s.score || 0), 0)
    const netEfficiency =
      totalCorrect > 0
        ? Math.min(100, Math.max(0, Math.round((totalScoreAchieved / totalCorrect) * 100)))
        : 100

    return {
      count,
      avgScore,
      avgAccuracy,
      peakPercentile,
      totalMistakes,
      stdDev,
      stabilityLabel,
      netEfficiency,
      totalNegativePenalty,
    }
  }, [filtered])

  if (scorecards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted">
        <BarChart3 className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm font-semibold text-ink">No exam attempts to analyze yet.</p>
        <p className="text-xs text-muted/70 mt-0.5">Record at least one attempt to unlock scientific charts & trends.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* ── Filters Bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-line/60 bg-surface-2/30 p-2.5">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted ml-1" />
          <span className="text-xs font-semibold text-ink mr-2">Trend Scope:</span>
          <div className="flex rounded-xl border border-line/50 bg-surface p-0.5">
            <button
              onClick={() => setTypeFilter('all')}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                typeFilter === 'all' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              All ({scorecards.length})
            </button>
            <button
              onClick={() => setTypeFilter('sectional')}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                typeFilter === 'sectional' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              Sectional
            </button>
            <button
              onClick={() => setTypeFilter('flt')}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                typeFilter === 'flt' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              FLT
            </button>
          </div>
        </div>

        {availableSections.length > 0 && typeFilter !== 'flt' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Section:</span>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="rounded-xl border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
            >
              <option value="all">All Sections</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Scientific KPI Summary Cards ─────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          variant="compact"
          tone="violet"
          icon={<TrendingUp className="h-4 w-4" />}
          label="Mean Score"
          value={summary.avgScore}
        />
        <StatCard
          variant="compact"
          tone="sky"
          icon={<Award className="h-4 w-4" />}
          label="Peak Percentile"
          value={`${summary.peakPercentile}%`}
        />
        <StatCard
          variant="compact"
          tone="emerald"
          icon={<Target className="h-4 w-4" />}
          label="Avg Accuracy"
          value={`${summary.avgAccuracy}%`}
        />
        <StatCard
          variant="compact"
          tone="rose"
          icon={<AlertCircle className="h-4 w-4" />}
          label="Negative Penalty"
          value={`-${summary.totalNegativePenalty}`}
        />
      </div>

      {/* ── Scientific Diagnostic Row ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="flex items-center justify-between rounded-xl border border-line/60 bg-surface-2/20 p-2.5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <div>
              <div className="font-semibold text-ink">Score Stability (σ)</div>
              <div className="text-[10px] text-muted">{summary.stabilityLabel}</div>
            </div>
          </div>
          <span className="font-mono font-bold text-ink">±{summary.stdDev}</span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-line/60 bg-surface-2/20 p-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="font-semibold text-ink">Mark Retention Efficiency</div>
              <div className="text-[10px] text-muted">Net marks kept vs lost to penalty</div>
            </div>
          </div>
          <span className="font-mono font-bold text-emerald-400">{summary.netEfficiency}%</span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-line/60 bg-surface-2/20 p-2.5">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" />
            <div>
              <div className="font-semibold text-ink">Target Gap</div>
              <div className="text-[10px] text-muted">
                {targetScore ? `Target Score: ${targetScore}` : 'Set target in exam'}
              </div>
            </div>
          </div>
          <span className="font-mono font-bold text-ink">
            {targetScore && chronological.length > 0
              ? `${(chronological[chronological.length - 1].score - targetScore).toFixed(1)}`
              : '—'}
          </span>
        </div>
      </div>

      {/* ── Chart 1: Score Progression & Moving Average Trajectory ── */}
      <div className="rounded-2xl border border-line/60 bg-surface-2/25 p-4 flex flex-col gap-3">
        {/* Header & Explicit High-Contrast Legends */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-2.5">
          <div>
            <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-accent" /> Score Trajectory & Trailing Momentum
            </h4>
            <span className="text-[11px] text-muted">
              Actual attempt score vs 3-Test Moving Average (SMA-3) & Benchmark Target
            </span>
          </div>

          {/* Prominent Visible Legends */}
          <div className="flex flex-wrap items-center gap-2">
            <LegendBadge color="#818cf8" label="Attempt Score" value={`Avg ${summary.avgScore}`} />
            <LegendBadge color="#06b6d4" label="3-Test SMA Trend" />
            {targetScore != null && (
              <LegendBadge color="#10b981" label="Target Benchmark" value={targetScore} isDashed />
            )}
            <LegendBadge color="#475569" label="Max Marks" isDashed />
          </div>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chronological} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
              <XAxis
                dataKey="shortName"
                tick={{ fontSize: 11, fill: '#cbd5e1' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#cbd5e1' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
              />
              <Tooltip
                content={
                  <ScientificTooltip
                    targetScore={targetScore}
                  />
                }
              />

              {/* Target Benchmark Reference Line */}
              {targetScore != null && (
                <ReferenceLine
                  y={targetScore}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `Target Benchmark (${targetScore})`,
                    fill: '#10b981',
                    position: 'top',
                    fontSize: 10,
                    fontWeight: 'bold',
                  }}
                />
              )}

              {/* Score Area Curve */}
              <Area
                type="monotone"
                dataKey="score"
                stroke="#818cf8"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#scoreAreaGrad)"
                name="Score"
                dot={{ r: 3.5, fill: '#818cf8', stroke: '#1e1b4b', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: '#a5b4fc' }}
              />

              {/* Moving Average Line */}
              <Line
                type="monotone"
                dataKey="sma3"
                stroke="#06b6d4"
                strokeWidth={2.2}
                dot={false}
                name="3-Test SMA"
              />

              {/* Total Marks Baseline */}
              <Line
                type="monotone"
                dataKey="totalMarks"
                stroke="#475569"
                strokeDasharray="3 3"
                dot={false}
                name="Total Marks"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Chart 2 & 3: Percentile vs Accuracy & Question Breakdown ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Percentile vs Accuracy Correlation */}
        <div className="rounded-2xl border border-line/60 bg-surface-2/25 p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-2">
            <div>
              <span className="text-xs font-bold text-ink">Percentile vs Accuracy Correlation</span>
              <div className="text-[10px] text-muted">Tracking how precision drives competitive rank</div>
            </div>

            {/* Clear Visible Legends */}
            <div className="flex items-center gap-2">
              <LegendBadge color="#38bdf8" label="Percentile" value={`${summary.peakPercentile}% peak`} />
              <LegendBadge color="#34d399" label="Accuracy" value={`${summary.avgAccuracy}% avg`} />
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chronological} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis
                  dataKey="shortName"
                  tick={{ fontSize: 10, fill: '#cbd5e1' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#cbd5e1' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <Tooltip
                  content={
                    <ScientificTooltip
                      targetScore={targetScore}
                    />
                  }
                />

                {/* Target Accuracy Benchmark */}
                {targetAccuracy != null && (
                  <ReferenceLine
                    y={targetAccuracy}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Target Acc: ${targetAccuracy}%`,
                      fill: '#10b981',
                      position: 'insideBottomRight',
                      fontSize: 10,
                    }}
                  />
                )}

                {/* Target Percentile Benchmark */}
                {targetPercentile != null && (
                  <ReferenceLine
                    y={targetPercentile}
                    stroke="#38bdf8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Target %ile: ${targetPercentile}%`,
                      fill: '#38bdf8',
                      position: 'insideTopRight',
                      fontSize: 10,
                    }}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="percentile"
                  stroke="#38bdf8"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: '#38bdf8' }}
                  name="Percentile %"
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#34d399"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: '#34d399' }}
                  name="Accuracy %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Question Distribution Stacked Bar */}
        <div className="rounded-2xl border border-line/60 bg-surface-2/25 p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-2">
            <div>
              <span className="text-xs font-bold text-ink">Question Attempt Allocation</span>
              <div className="text-[10px] text-muted">Correct (+gain) vs Wrong (-penalty) vs Skipped</div>
            </div>

            {/* Clear Visible Legends */}
            <div className="flex items-center gap-2">
              <LegendBadge color="#10b981" label="Correct" />
              <LegendBadge color="#f43f5e" label="Wrong (-marks)" />
              <LegendBadge color="#475569" label="Skipped" />
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chronological} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis
                  dataKey="shortName"
                  tick={{ fontSize: 10, fill: '#cbd5e1' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#cbd5e1' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <Tooltip
                  content={
                    <ScientificTooltip
                      targetScore={targetScore}
                    />
                  }
                />
                <Bar dataKey="correct" stackId="a" fill="#10b981" name="Correct" />
                <Bar dataKey="wrong" stackId="a" fill="#f43f5e" name="Wrong" />
                <Bar dataKey="unattempted" stackId="a" fill="#475569" radius={[4, 4, 0, 0]} name="Unattempted" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Chart 4: Error Categories & Marks Destruction (Pareto) ─ */}
      {mistakeData.length > 0 && (
        <div className="rounded-2xl border border-line/60 bg-surface-2/25 p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-2">
            <div>
              <span className="text-xs font-bold text-ink">Error Taxonomy & Marks Destroyed</span>
              <div className="text-[11px] text-muted">
                {summary.totalMistakes} logged errors stealing marks from your score
              </div>
            </div>

            {/* Clear Visible Category Badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              {mistakeData.map((m) => (
                <div
                  key={m.tag}
                  className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ backgroundColor: `${m.fill}25`, border: `1px solid ${m.fill}55` }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.fill }} />
                  <span>{m.name}:</span>
                  <span className="font-bold font-mono text-white">{m.count}</span>
                  <span className="text-[10px] text-rose-300">(-{m.marksLost}m)</span>
                </div>
              ))}
            </div>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mistakeData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#cbd5e1' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11, fill: '#f8fafc', fontWeight: 500 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  width={120}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const item = payload[0].payload
                    return (
                      <div className="rounded-xl border border-white/15 bg-slate-950/95 p-3 text-xs text-white shadow-xl backdrop-blur-md">
                        <div className="font-bold text-sm" style={{ color: item.fill }}>
                          {item.name}
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-4">
                          <span className="text-slate-400">Total Count:</span>
                          <span className="font-mono font-bold">{item.count} errors</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-rose-400">
                          <span>Penalty Marks Lost:</span>
                          <span className="font-mono font-bold">-{item.marksLost} marks</span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Occurrences">
                  {mistakeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
