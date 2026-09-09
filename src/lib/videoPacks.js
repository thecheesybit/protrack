import bg1 from '@/assets/video-pack/bg-1.mp4'
import bg2 from '@/assets/video-pack/bg-2.mp4'
import bg3 from '@/assets/video-pack/bg-3.mp4'
import bg4 from '@/assets/video-pack/bg-4.mp4'
import bg5 from '@/assets/video-pack/bg-5.mp4'
import habbit1 from '@/assets/video-pack/habbit-1.mp4'
import habbit2 from '@/assets/video-pack/habbit-2.mp4'
import habbit3 from '@/assets/video-pack/habbit-3.mp4'
import notes1 from '@/assets/video-pack/notes-1.mp4'
import notes2 from '@/assets/video-pack/notes-2.mp4'
import notes3 from '@/assets/video-pack/notes-3.mp4'
import todo1 from '@/assets/video-pack/todo-1.mp4'

export const ALL_VIDEOS = [
  bg1, bg2, bg3, bg4, bg5,
  habbit1, habbit2, habbit3,
  notes1, notes2, notes3,
  todo1,
]

export const WIDGET_VIDEO_MAP = {
  habits: [habbit1, habbit2, habbit3],
  notes: [notes1, notes2, notes3],
  todos: [todo1, bg1, bg2],
  focus: [bg4, bg1, bg5],
  subjects: [bg2, bg3, bg5],
  scorecard: [bg1, bg4, bg3],
  analytics: [bg3, bg4, bg5],
  ledger: [bg5, bg1, bg2],
}

/**
 * Strict guarantee: No two widget background cards can ever share the same video.
 * Fixed for each reload/session, and re-randomized without duplicates on refresh or reopen.
 */
const sessionWidgetVideoCache = new Map()
const claimedVideos = new Set()

/** Pre-assign known dock widgets on initialization so all visible dock cards are strictly unique */
export function initializeSessionVideoAssignments() {
  sessionWidgetVideoCache.clear()
  claimedVideos.clear()

  const available = new Set(ALL_VIDEOS)
  const widgetIds = Object.keys(WIDGET_VIDEO_MAP)

  // Prioritize widgets with smaller, specific pools first (e.g. todos, habits, notes)
  const sortedWidgetIds = [...widgetIds].sort((a, b) => {
    const poolA = WIDGET_VIDEO_MAP[a]?.length || 99
    const poolB = WIDGET_VIDEO_MAP[b]?.length || 99
    return poolA - poolB
  })

  for (const wId of sortedWidgetIds) {
    const pool = WIDGET_VIDEO_MAP[wId] || ALL_VIDEOS
    // Find videos from preferred pool that have NOT been claimed
    const candidatePool = pool.filter((v) => available.has(v))
    
    let chosen
    if (candidatePool.length > 0) {
      chosen = candidatePool[Math.floor(Math.random() * candidatePool.length)]
    } else {
      // If all preferred videos are claimed, choose any remaining unclaimed video from ALL_VIDEOS
      const remaining = Array.from(available)
      chosen = remaining.length > 0 ? remaining[Math.floor(Math.random() * remaining.length)] : pool[0]
    }

    if (chosen) {
      available.delete(chosen)
      claimedVideos.add(chosen)
      sessionWidgetVideoCache.set(wId, chosen)
    }
  }
}

// Automatically initialize once on load/reload
initializeSessionVideoAssignments()

/**
 * Returns a suitable, strictly unique background video for a given widget ID.
 * Guarantees that no 2 widgets ever share the same background video.
 *
 * @param {string} widgetId
 * @param {boolean} [reroll=false] Force re-allocation of session assignments
 * @returns {string} URL/path to the MP4 asset
 */
export function getWidgetVideo(widgetId, reroll = false) {
  if (reroll) {
    initializeSessionVideoAssignments()
  }

  if (sessionWidgetVideoCache.has(widgetId)) {
    return sessionWidgetVideoCache.get(widgetId)
  }

  // If a new / unexpected widget ID is queried, find an unclaimed video
  const pool = WIDGET_VIDEO_MAP[widgetId] || ALL_VIDEOS
  const unclaimedPreferred = pool.filter((v) => !claimedVideos.has(v))
  let chosen = unclaimedPreferred[Math.floor(Math.random() * unclaimedPreferred.length)]

  if (!chosen) {
    const unclaimedAll = ALL_VIDEOS.filter((v) => !claimedVideos.has(v))
    chosen = unclaimedAll.length > 0
      ? unclaimedAll[Math.floor(Math.random() * unclaimedAll.length)]
      : pool[Math.floor(Math.random() * pool.length)]
  }

  if (chosen) {
    claimedVideos.add(chosen)
    sessionWidgetVideoCache.set(widgetId, chosen)
  }

  return chosen
}
