// Declarative list of board widgets. Each lands in a later sprint; for now they
// render as polished empty-state shells so the board feels alive from day one.
export const WIDGETS = [
  {
    id: 'timetable',
    title: 'Timetable',
    icon: 'CalendarDays',
    sprint: 3,
    tagline: 'Drag-and-drop your day. Two-way Google Calendar sync.',
    span: 'lg:col-span-2',
  },
  {
    id: 'subjects',
    title: 'Subjects',
    icon: 'Layers',
    sprint: 4,
    tagline: 'Progress, links, flags & a micro-Kanban per subject.',
    span: '',
  },
  {
    id: 'focus',
    title: 'Deep Focus',
    icon: 'Timer',
    sprint: 5,
    tagline: 'Pomodoro that grows a forest. Ambient sounds.',
    span: '',
  },
  {
    id: 'habits',
    title: 'Habits',
    icon: 'ListChecks',
    sprint: 7,
    tagline: 'Gentle daily streaks & hydration nudges.',
    span: '',
  },
  {
    id: 'todos',
    title: 'To-dos',
    icon: 'Flag',
    sprint: 7,
    tagline: 'Frictionless capture. Quick, calm, done.',
    span: '',
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: 'BarChart3',
    sprint: 5,
    tagline: 'Active days · peak hours · longest streak.',
    span: 'lg:col-span-2',
  },
]
