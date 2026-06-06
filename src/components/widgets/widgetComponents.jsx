import { PlaceholderWidget } from './PlaceholderWidget'
import { TimetableWidget } from './TimetableWidget'
import { SubjectsWidget } from './SubjectsWidget'
import { FocusWidget } from './FocusWidget'
import { AnalyticsWidget } from './AnalyticsWidget'
import { HabitsWidget } from './HabitsWidget'
import { TodosWidget } from './TodosWidget'

// Maps widget id → real component. Anything not yet built falls back to the
// polished placeholder. Filled in sprint by sprint.
const COMPONENTS = {
  timetable: TimetableWidget,
  subjects: SubjectsWidget,
  focus: FocusWidget,
  analytics: AnalyticsWidget,
  habits: HabitsWidget,
  todos: TodosWidget,
}

export function getWidgetComponent(id) {
  return COMPONENTS[id] || PlaceholderWidget
}
