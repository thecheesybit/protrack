#!/usr/bin/env node
/**
 * CI guard: fails if any shipped video carries an audio stream.
 *
 *   node scripts/check-video-audio.mjs
 *
 * ProTrack's videos are silent decorative clips; a stray audio track is dead
 * weight (and, for autoplaying loops, a UX hazard). Runs against source assets
 * so a regression is caught before it ever reaches a build. Fix offenders with
 * `node scripts/optimize-assets.mjs` (strips audio losslessly).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ffprobe from 'ffprobe-static'

const VIDEO_RE = /\.(mp4|webm|mov|m4v)$/i
const ROOTS = ['src/assets', 'public']

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (VIDEO_RE.test(entry)) out.push(p)
  }
  return out
}

const hasAudio = (f) =>
  execFileSync(ffprobe.path, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', f])
    .toString()
    .trim().length > 0

const videos = ROOTS.flatMap((r) => walk(r))
const offenders = videos.filter(hasAudio)

if (offenders.length) {
  console.error(`✗ ${offenders.length} shipped video(s) still carry an audio track:`)
  for (const f of offenders) console.error(`  - ${f}`)
  console.error('Run: node scripts/optimize-assets.mjs')
  process.exit(1)
}

console.log(`✓ ${videos.length} shipped videos, none with an audio track.`)
