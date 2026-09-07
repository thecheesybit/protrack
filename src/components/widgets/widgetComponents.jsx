import { TimetableWidget } from './TimetableWidget'
import { SubjectsWidget } from './SubjectsWidget'
import { FocusWidget } from './FocusWidget'
import { AnalyticsWidget } from './AnalyticsWidget'
import { HabitsWidget } from './HabitsWidget'
import { TodosWidget } from './TodosWidget'
import { LedgerWidget } from './LedgerWidget'
import { NotesWidget } from './NotesWidget'

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
}

export function getWidgetComponent(id) {
  return COMPONENTS[id]
}
