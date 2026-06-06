/**
 * Centralised priority taxonomy. Used by tasks (kanban) and todos so the
 * visual language is consistent across the workspace.
 */
export const PRIORITIES = [
  { key: 'low', label: 'Low', color: '#64748b', dot: 'bg-slate-400', ring: 'ring-slate-400/40' },
  { key: 'medium', label: 'Medium', color: '#6366f1', dot: 'bg-indigo-400', ring: 'ring-indigo-400/40' },
  { key: 'high', label: 'High', color: '#f59e0b', dot: 'bg-amber-400', ring: 'ring-amber-400/40' },
  { key: 'urgent', label: 'Urgent', color: '#ef4444', dot: 'bg-rose-500', ring: 'ring-rose-500/40' },
]

export const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 }

export function getPriority(key) {
  return PRIORITIES.find((p) => p.key === key) || PRIORITIES[1] // default medium
}

/** Cycle through priorities forward — used by the inline priority chip. */
export function nextPriority(current) {
  const idx = PRIORITIES.findIndex((p) => p.key === current)
  const next = PRIORITIES[(idx + 1) % PRIORITIES.length]
  return next.key
}
