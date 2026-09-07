/**
 * Curated Deep Focus background scenes (ambient YouTube video + audio).
 *
 * Single source of truth shared by the Focus widget (scenes tab), the Deep
 * Focus lock screen (live picker), and Settings → Deep Focus Scene, so the list
 * never drifts between surfaces. Selecting a scene writes `focusAudioUrl` +
 * `focusVideoEnabled` to user settings; the lock screen and BackgroundAudioPlayer
 * react to those.
 */
// Each id verified embeddable via YouTube oEmbed (401 = embedding disabled).
// The previous "Shiv Stuti" (AQFI1PJfV_I) returned 401 — embedding disabled by
// its owner, so it could never play — and was removed. Add replacements only
// after confirming https://www.youtube.com/oembed?url=<url> returns 200.
export const VIDEO_PRESETS = [
  { label: 'Forest River', url: 'https://youtu.be/1GzKYoyrlkA' },
  { label: 'Varanasi Temple', url: 'https://youtu.be/tAk4G8Rs1RQ' },
  { label: 'Lo-fi Jazz', url: 'https://youtu.be/BYTxPFj44uo' },
  { label: 'Hari Mantra', url: 'https://youtu.be/6x5xtNhOts0' },
]

// Default scene for new users (Forest River ambient)
export const DEFAULT_FOCUS_SCENE = VIDEO_PRESETS[0]

/** Matches any YouTube URL or path and captures the 11-char video id. */
export const YT_PATTERN =
  /(?:youtu\.be\/|youtube(?:-nocookie)?\.[a-z.]+\/(?:.*[?&]v=|embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/i

/** Extract the YouTube video id from any supported URL, ID string, or null. */
export function youtubeId(url) {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed
  }
  const match = trimmed.match(YT_PATTERN)
  if (match?.[1]) return match[1]

  const paramMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i)
  if (paramMatch?.[1]) return paramMatch[1]

  return null
}

/**
 * Normalizes any YouTube URL or video ID to the canonical preset format:
 * `https://youtu.be/<videoId>`. Returns null if input is not a valid YouTube reference.
 */
export function toCanonicalYouTubeUrl(urlOrId) {
  const id = youtubeId(urlOrId)
  return id ? `https://youtu.be/${id}` : null
}

/**
 * Build the IFrame embed URL for a background scene. Single source of truth for
 * both the Deep Focus lock screen and the hidden background-audio player, so the
 * two never drift.
 *
 * enablejsapi=1 (needed for volume control via postMessage) requires the parent
 * page's `origin` to be passed and to match. We pass the real page origin
 * whenever it is http(s) — dev over http://localhost AND the hosted web build —
 * and omit it only under file:// (packaged), where the opaque origin would be
 * rejected; there the Electron main process supplies a Referer instead.
 *
 * @param {string} videoId
 * @returns {string}
 */
export function buildSceneEmbedUrl(videoId) {
  if (!videoId) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const originParam = origin.startsWith('http') ? `&origin=${encodeURIComponent(origin)}` : ''
  return (
    `https://www.youtube.com/embed/${videoId}` +
    `?autoplay=1&mute=0&loop=1&playlist=${videoId}` +
    `&controls=0&rel=0&showinfo=0&modestbranding=1&enablejsapi=1` +
    // cc_load_policy=0 keeps captions off; iv_load_policy=3 hides annotations —
    // a background scene must stay clean (no text overlays). We also unload the
    // captions module via the IFrame API after onReady, because YouTube can
    // otherwise restore a viewer's global "captions on" preference.
    `&cc_load_policy=0&iv_load_policy=3&fs=0&disablekb=1` +
    `${originParam}`
  )
}
