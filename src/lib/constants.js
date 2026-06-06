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

// Preset execution scopes offered during onboarding. Each maps to a workspace
// "mode". Icons are Lucide component names resolved at render time.
export const MODE_PRESETS = [
  { name: 'UPSC Mode', icon: 'BookOpen', accentColor: '#6366f1', blurb: 'Civil services preparation' },
  { name: 'M.Tech Mode', icon: 'GraduationCap', accentColor: '#8b5cf6', blurb: 'Postgraduate engineering' },
  { name: 'GATE Mode', icon: 'Cpu', accentColor: '#06b6d4', blurb: 'Engineering entrance' },
  { name: 'NEET Mode', icon: 'Stethoscope', accentColor: '#10b981', blurb: 'Medical entrance' },
  { name: 'CAT Mode', icon: 'Calculator', accentColor: '#f59e0b', blurb: 'Management aptitude' },
  { name: 'Research Mode', icon: 'FlaskConical', accentColor: '#ec4899', blurb: 'Thesis & publications' },
]

// Creator credit + canonical project links (surfaced in landing + settings).
// NOTE: githubUrl points at the repo-owner account; confirm the creator's
// preferred profile handle if different.
export const CREATOR = {
  name: 'AYUSH KUMAR',
  githubUrl: 'https://github.com/thecheesybit',
}

export const APP_LINKS = {
  repo: 'https://github.com/thecheesybit/protrack',
  releasesLatest: 'https://github.com/thecheesybit/protrack/releases/latest',
  webGateway: 'https://pro-track-app.netlify.app',
}
