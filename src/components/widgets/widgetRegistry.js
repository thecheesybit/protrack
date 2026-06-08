// Declarative list of board widgets — order, identity, icon, and grid span.
// Each id maps to a real component in widgetComponents.jsx.
export const WIDGETS = [
  { id: 'timetable', title: 'Timetable', icon: 'CalendarDays', span: 'lg:col-span-2' },
  { id: 'todos', title: 'To-dos', icon: 'Flag', span: '' },
  { id: 'habits', title: 'Habits', icon: 'ListChecks', span: '' },
  { id: 'focus', title: 'Deep Focus', icon: 'Timer', span: '' },
  { id: 'subjects', title: 'Subjects', icon: 'Layers', span: '' },
  { id: 'analytics', title: 'Analytics', icon: 'BarChart3', span: 'lg:col-span-2' },
  { id: 'ledger', title: 'History', icon: 'Trophy', span: '' },
]
