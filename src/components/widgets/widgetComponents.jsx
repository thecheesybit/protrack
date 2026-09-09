import { Component } from 'react'
import { TimetableWidget } from './TimetableWidget'
import { SubjectsWidget } from './SubjectsWidget'
import { FocusWidget } from './FocusWidget'
import { AnalyticsWidget } from './AnalyticsWidget'
import { HabitsWidget } from './HabitsWidget'
import { TodosWidget } from './TodosWidget'
import { LedgerWidget } from './LedgerWidget'
import { NotesWidget } from './NotesWidget'
import { ScorecardWidget } from './ScorecardWidget'

// Every board widget maps to a real, mode-aware component — no placeholders.
const COMPONENTS = {
  timetable: TimetableWidget,
  subjects: SubjectsWidget,
  focus: FocusWidget,
  analytics: AnalyticsWidget,
  habits: HabitsWidget,
  todos: TodosWidget,
  ledger: LedgerWidget,
  notes: NotesWidget,
  scorecard: ScorecardWidget,
}

/**
 * Per-widget error boundary — isolates crashes so a single broken widget
 * doesn't take down the entire board layout.
 */
class WidgetErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[WidgetErrorBoundary: ${this.props.widgetId || 'unknown'}]`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-line/40 bg-surface/50 p-6 text-center">
          <span className="text-2xl">⚠️</span>
          <p className="text-sm font-medium text-ink/70">
            This widget ran into an error
            {this.props.widgetId ? ` (${this.props.widgetId})` : ''}
          </p>
          {this.state.error?.message && (
            <p className="max-w-xs text-xs text-rose-400/90 font-mono break-words bg-rose-500/10 rounded px-2 py-1 border border-rose-500/20">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink cursor-pointer"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * Returns a wrapped widget component with an isolated error boundary.
 * If the widget crashes, only its own card shows the fallback — the rest
 * of the board continues working.
 */
export function getWidgetComponent(id) {
  const Widget = COMPONENTS[id]
  if (!Widget) return undefined

  // Return a wrapper component that includes the error boundary.
  return function WidgetWithBoundary(props) {
    return (
      <WidgetErrorBoundary widgetId={id}>
        <Widget {...props} />
      </WidgetErrorBoundary>
    )
  }
}
