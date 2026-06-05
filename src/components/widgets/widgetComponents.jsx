import { PlaceholderWidget } from './PlaceholderWidget'
import { TimetableWidget } from './TimetableWidget'

// Maps widget id → real component. Anything not yet built falls back to the
// polished placeholder. Filled in sprint by sprint.
const COMPONENTS = {
  timetable: TimetableWidget,
}

export function getWidgetComponent(id) {
  return COMPONENTS[id] || PlaceholderWidget
}
