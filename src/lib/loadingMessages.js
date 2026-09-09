/**
 * Curated list of inspiring, atmospheric loading messages for the ProTrack boot loader.
 * Populated randomly on reload to make every boot engaging and fresh.
 */
export const LOADING_MESSAGES = [
  'Verifying your workspace profile…',
  'Aligning your focus sanctuary…',
  'Synthesizing your daily timetable…',
  'Gathering deep focus sessions…',
  'Cultivating your botanical grove…',
  'Calibrating celestial chronometers…',
  'Harmonizing workspace frequencies…',
  'Synchronizing habits and targets…',
  'Warming up your study flow…',
  'Preparing quiet sanctuary…',
  'Restoring mindful state…',
  'Polishing your workspace canvas…',
  'Organizing knowledge notes & subjects…',
  'Connecting to your focus grove…',
  'Readying zen environment…',
  'Tuning ambient soundscapes…',
]

/** Returns a random loading message from the curated list */
export function getRandomLoadingMessage() {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
}
