/**
 * Curated Deep Focus background scenes (ambient YouTube video + audio).
 *
 * Single source of truth shared by the Focus widget (scenes tab), the Deep
 * Focus lock screen (live picker), and Settings → Deep Focus Scene, so the list
 * never drifts between surfaces. Selecting a scene writes `focusAudioUrl` +
 * `focusVideoEnabled` to user settings; the lock screen and BackgroundAudioPlayer
 * react to those.
 */
export const VIDEO_PRESETS = [
  { label: 'Forest River', url: 'https://youtu.be/1GzKYoyrlkA' },
  { label: 'Varanasi Temple', url: 'https://youtu.be/tAk4G8Rs1RQ' },
  { label: 'Lo-fi Jazz', url: 'https://youtu.be/BYTxPFj44uo' },
  { label: 'Hari Mantra', url: 'https://youtu.be/6x5xtNhOts0' },
  { label: 'Shiv Stuti', url: 'https://youtu.be/AQFI1PJfV_I' },
]

// Default scene for new users (Forest River ambient)
export const DEFAULT_FOCUS_SCENE = VIDEO_PRESETS[0]
