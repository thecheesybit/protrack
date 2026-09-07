import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, Copy, Check, BookOpen, AlertTriangle, ShieldCheck, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { Spinner } from '@/components/ui/Spinner'
import { generateGeminiExpertAnalysis } from '@/services/scorecardService'
import { cn } from '@/utils/cn'

const COACH_CACHE_KEY = 'protrack:scorecard_coach_report'

export function ScorecardAiCoach({ scorecards = [], activeScopeName = 'All Exams' }) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(() => {
    try {
      return localStorage.getItem(COACH_CACHE_KEY) || ''
    } catch {
      return ''
    }
  })
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!scorecards.length) {
      toast.error('Log at least one exam attempt first')
      return
    }

    setLoading(true)
    try {
      const generated = await generateGeminiExpertAnalysis(scorecards, activeScopeName)
      setReport(generated)
      try {
        localStorage.setItem(COACH_CACHE_KEY, generated)
      } catch (e) {
        /* storage full */
      }
      toast.success('AI Performance Coach analysis ready!')
    } catch (err) {
      console.error('[AI Coach] generation error:', err)
      toast.error(err.message || 'Could not generate coach analysis')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!report) return
    navigator.clipboard.writeText(report)
    setCopied(true)
    toast.success('Copied report to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* ── Coach Header Banner ─────────────────────────────────── */}
      <div className="rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/15 via-surface to-accent-2/10 p-5 shadow-glass backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent/20 text-accent">
                <Sparkles className="h-4 w-4" />
              </span>
              <h3 className="font-bold text-base text-ink">Gemini AI Exam Strategist</h3>
            </div>
            <p className="text-xs text-muted max-w-xl">
              Analyzes your speed, accuracy curves, negative marks penalties, and error logs across{' '}
              <span className="text-ink font-semibold">{scorecards.length} attempts</span> to uncover mark leaks and build a winning mock strategy.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || scorecards.length === 0}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:opacity-95 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Spinner className="h-3.5 w-3.5" /> Analyzing Performance...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                {report ? 'Refresh Diagnosis' : 'Generate Coach Review'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Report Body or Empty State ─────────────────────────── */}
      {loading ? (
        <div className="rounded-3xl border border-line/60 bg-surface-2/30 p-10 flex flex-col items-center justify-center gap-3 text-center">
          <div className="relative">
            <Spinner className="h-9 w-9 text-accent" />
            <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-amber-400 animate-bounce" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-ink">Analyzing your exam record...</span>
            <span className="text-xs text-muted max-w-sm">
              Evaluating accuracy vs unattempted ratio, time spent per section, and categorizing silly mistakes.
            </span>
          </div>
        </div>
      ) : report ? (
        <div className="rounded-3xl border border-line/60 bg-surface-2/20 p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-line/40 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-accent" /> Performance Coaching Report
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:text-ink transition-colors"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Render Markdown Content nicely */}
          <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-3">
            {report.split('\n\n').map((paragraph, idx) => {
              if (paragraph.startsWith('### ') || paragraph.startsWith('## ') || paragraph.startsWith('# ')) {
                const clean = paragraph.replace(/^#+\s*/, '')
                return (
                  <h4 key={idx} className="text-sm font-bold text-accent mt-3 mb-1">
                    {clean}
                  </h4>
                )
              }
              if (paragraph.match(/^\d+\.\s/)) {
                return (
                  <div key={idx} className="pl-2 border-l-2 border-accent/40 my-2 space-y-1">
                    {paragraph.split('\n').map((line, lIdx) => (
                      <p key={lIdx} className="text-ink/90">
                        {line}
                      </p>
                    ))}
                  </div>
                )
              }
              return (
                <p key={idx} className="text-ink/90">
                  {paragraph}
                </p>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-line/60 bg-surface-2/15 p-10 flex flex-col items-center justify-center gap-2 text-center text-muted">
          <Sparkles className="h-8 w-8 text-accent/50 mb-1" />
          <span className="text-sm font-semibold text-ink">No Coaching Report Generated Yet</span>
          <p className="text-xs max-w-md">
            Click "Generate Coach Review" above to run Gemini's diagnostic engine over your recorded mocks, mistake logs, and speed patterns.
          </p>
        </div>
      )}
    </div>
  )
}
