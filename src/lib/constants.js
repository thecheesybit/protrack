// Seeded for every new user so the board is alive on first login.
export const DEFAULT_MODES = [
  { name: 'UPSC Mode', icon: 'BookOpen', accentColor: '#6366f1' },
  { name: 'M.Tech Mode', icon: 'GraduationCap', accentColor: '#8b5cf6' },
]

// A rotating palette used when the user creates a fresh mode.
export const MODE_PALETTE = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#ef4444',
]

export const STORAGE_KEYS = {
  theme: 'protrack:theme',
}
