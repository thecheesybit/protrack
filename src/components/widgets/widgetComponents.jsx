import { TimetableWidget } from './TimetableWidget'
import { SubjectsWidget } from './SubjectsWidget'
import { FocusWidget } from './FocusWidget'
import { AnalyticsWidget } from './AnalyticsWidget'
import { HabitsWidget } from './HabitsWidget'
import { TodosWidget } from './TodosWidget'
import { LedgerWidget } from './LedgerWidget'

// Every board widget maps to a real, mode-aware component — no placeholders.
const COMPONENTS = {
  timetable: TimetableWidget,
  subjects: SubjectsWidget,
  focus: FocusWidget,
  analytics: AnalyticsWidget,
  habits: HabitsWidget,
  todos: TodosWidget,
  ledger: LedgerWidget,
}

export function getWidgetComponent(id) {
  return COMPONENTS[id]
}
