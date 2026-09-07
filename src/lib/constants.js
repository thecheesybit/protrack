// Default modes seeded on first login (empty by default for a clean slate).
export const DEFAULT_MODES = []

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
  { name: 'UGC NET Mode', icon: 'Globe', accentColor: '#0ea5e9', blurb: 'Lectureship & JRF · social sciences' },
  { name: 'UGC NET Sociology Mode', icon: 'Users', accentColor: '#3b82f6', blurb: 'Lectureship & JRF · sociology & social systems' },
  { name: 'Research Mode', icon: 'FlaskConical', accentColor: '#ec4899', blurb: 'Thesis & publications' },
]

// Creator credit + canonical project links (surfaced in landing + settings).
// NOTE: githubUrl points at the repo-owner account; confirm the creator's
// preferred profile handle if different.
export const CREATOR = {
  name: 'AYUSH KUMAR',
  githubUrl: 'https://github.com/thecheesybit',
}

// Evidence-based scientific starter habits offered with physiological and cognitive rationale.
export const SCIENTIFIC_HABIT_PRESETS = [
  {
    name: 'Hydration',
    icon: 'Droplets',
    color: '#06b6d4',
    interval: 'every-2h',
    timesPerDay: 8,
    timesPerWeek: 7,
    recommendedIntervalLabel: 'Every 2 hours',
    scienceRationale: 'Mild fluid deficit (1-2%) impairs prefrontal cortex perfusion, degrading working memory and alertness. Drinking 200-250ml every 2 hours preserves cellular osmotic equilibrium and renal clearance.',
    scienceDomain: 'Renal Physiology & Cognition',
  },
  {
    name: 'Screen & Eye Reset (20-20-20)',
    icon: 'Sparkles',
    color: '#3b82f6',
    interval: 'every-30m',
    timesPerDay: 12,
    timesPerWeek: 7,
    recommendedIntervalLabel: 'Every 30 minutes',
    scienceRationale: 'Looking 20 feet away for 20 seconds relaxes sustained ciliary muscle spasm, stimulates tear film blink rate, and prevents Computer Vision Syndrome (CVS) and headaches.',
    scienceDomain: 'Ophthalmology',
  },
  {
    name: 'Posture & Mobility Break',
    icon: 'Trees',
    color: '#10b981',
    interval: 'every-1h',
    timesPerDay: 8,
    timesPerWeek: 7,
    recommendedIntervalLabel: 'Every 1 hour',
    scienceRationale: 'Prolonged sitting compresses intervertebral discs and slows metabolic glucose clearance. 60 seconds of standing or stretching re-hydrates discs and reactivates venous blood return.',
    scienceDomain: 'Biomechanics & Ergonomics',
  },
  {
    name: 'Mindfulness & Box Breathing',
    icon: 'Heart',
    color: '#ec4899',
    interval: 'every-3h',
    timesPerDay: 4,
    timesPerWeek: 7,
    recommendedIntervalLabel: 'Every 3 hours',
    scienceRationale: 'Rhythmic diaphragmatic breathing stimulates the vagus nerve, rapidly initiating parasympathetic tone to suppress elevated cortisol and mental fatigue.',
    scienceDomain: 'Autonomic Neuroscience',
  },
  {
    name: 'Core Reading & Study',
    icon: 'BookOpen',
    color: '#6366f1',
    interval: 'every-4h',
    timesPerDay: 2,
    timesPerWeek: 6,
    recommendedIntervalLabel: 'Every 4 hours',
    scienceRationale: 'Focused cognitive blocks paired with diffuse downtime maximize synaptic long-term potentiation (LTP) and working memory consolidation.',
    scienceDomain: 'Cognitive Psychology',
  },
  {
    name: 'Review & Spaced Retrieval',
    icon: 'Brain',
    color: '#8b5cf6',
    interval: 'evening',
    timesPerDay: 1,
    timesPerWeek: 7,
    recommendedIntervalLabel: 'Every evening',
    scienceRationale: 'Active recall testing before sleep leverages subsequent slow-wave and REM sleep for memory consolidation, counteracting the Ebbinghaus forgetting curve.',
    scienceDomain: 'Memory Science',
  },
  {
    name: 'Physical Exercise',
    icon: 'Dumbbell',
    color: '#ef4444',
    interval: 'morning',
    timesPerDay: 1,
    timesPerWeek: 5,
    recommendedIntervalLabel: 'Once daily (morning)',
    scienceRationale: 'Aerobic and resistance exertion stimulates systemic BDNF (brain-derived neurotrophic factor) release, promoting neurogenesis and sustained dopamine regulation.',
    scienceDomain: 'Exercise Physiology',
  },
  {
    name: 'Sleep Wind-Down',
    icon: 'Moon',
    color: '#f59e0b',
    interval: 'evening',
    timesPerDay: 1,
    timesPerWeek: 7,
    recommendedIntervalLabel: 'Every evening',
    scienceRationale: 'Minimizing screens and blue light 60 minutes before bed prevents suprachiasmatic nucleus suppression of melatonin, protecting deep restorative sleep stages.',
    scienceDomain: 'Circadian Biology',
  },
]

export const HABIT_PRESETS = SCIENTIFIC_HABIT_PRESETS

export const APP_LINKS = {
  repo: 'https://github.com/thecheesybit/protrack',
  releasesLatest: 'https://github.com/thecheesybit/protrack/releases/latest',
  webGateway: 'https://pro-track-app.netlify.app',
}

/* ── Support Corner (crowd-funded sustainability) ───────── */

// The single admin who can verify contributions. Checked against the
// Google-verified token email in Firestore rules + the /patreon-approve gate.
export const ADMIN_EMAIL = 'ak818ace@gmail.com'

// Payee details for the dynamically-generated UPI intent QR.
export const SUPPORT_UPI = {
  vpa: 'ak818ace-2@oksbi',
  payeeName: 'Ayush Kumar',
  note: 'PRO TRACK support',
}

// Indicative USD→INR rate used only to render a UPI (INR) QR for USD intents.
export const USD_TO_INR = 84

// Pre-baked wall entries so the Wall of Honor feels alive from day one. Rendered
// locally (zero Firestore reads) and merged with live verified patrons by id.
export const SEED_PATREONS = [
  { id: 'seed-aarav', name: 'Aarav Sharma', region: 'IN', amount: 500, currency: 'INR', testimony: 'Switching between my UPSC and optional-subject modes is instant — it is like having two clean desks.', featureRequest: 'Spaced-repetition revision queue', seed: true },
  { id: 'seed-priya', name: 'Priya Nair', region: 'IN', amount: 250, currency: 'INR', testimony: "Typing 'revise polity tomorrow 5pm' straight onto the calendar still feels like magic.", featureRequest: 'Shared study-group calendars', seed: true },
  { id: 'seed-rohan', name: 'Rohan Mehta', region: 'IN', amount: 1000, currency: 'INR', testimony: 'The desktop app is buttery — the mini-timer following me onto the Kanban board is perfect.', featureRequest: 'Linux AppImage auto-update', seed: true },
  { id: 'seed-sneha', name: 'Sneha Iyer', region: 'IN', amount: 150, currency: 'INR', testimony: 'The activity rings finally made me consistent. Hydration habit on day one.', featureRequest: 'Weekly email digest', seed: true },
  { id: 'seed-karthik', name: 'Karthik Reddy', region: 'IN', amount: 750, currency: 'INR', testimony: 'The obsidian night theme is the only app that does not burn my eyes at 2am.', featureRequest: 'Custom ambient sound upload', seed: true },
  { id: 'seed-jordan', name: 'Jordan Miller', region: 'US', amount: 10, currency: 'USD', testimony: 'Electron build is shockingly snappy and the tray-on-close is exactly right.', featureRequest: 'Global hotkey rebinding', seed: true },
  { id: 'seed-emily', name: 'Emily Carter', region: 'US', amount: 25, currency: 'USD', testimony: 'The live timeline flag across the day is the detail that made me stay.', featureRequest: 'Apple Calendar two-way sync', seed: true },
  { id: 'seed-michael', name: 'Michael Thompson', region: 'US', amount: 5, currency: 'USD', testimony: 'Dragging a card to Done and watching the subject percentage tick up is so satisfying.', featureRequest: 'Sub-tasks inside Kanban cards', seed: true },
  { id: 'seed-sarah', name: 'Sarah Johnson', region: 'US', amount: 15, currency: 'USD', testimony: 'The Dynamic Island for Pomodoro alerts feels straight out of a flagship phone.', featureRequest: 'Focus-stats Notion export', seed: true },
  { id: 'seed-david', name: 'David Rodriguez', region: 'US', amount: 50, currency: 'USD', testimony: 'Mode-switching carried me through grad school — research mode vs coursework mode is everything.', featureRequest: 'Team / lab shared modes', seed: true },
]
