#!/usr/bin/env node
/**
 * One-time (re-runnable) asset optimizer for ProTrack.
 *
 *   node scripts/optimize-assets.mjs
 *
 * What it does, all visually lossless or near-lossless:
 *   - Animated GIFs  -> muted looping H.264 MP4  (the <img> becomes a <video>)
 *   - Forest PNG sprites -> WebP (high quality, alpha preserved)
 *   - Strips audio tracks from any shipped decorative video (they need none;
 *     also enforced in CI by scripts/check-video-audio.mjs)
 *
 * Sources are replaced in place (the .gif/.png is removed once converted), so
 * re-running after a successful pass is a no-op. Requires devDeps:
 * ffmpeg-static, ffprobe-static, sharp.
 */
import { execFileSync } from 'node:child_process'
import { statSync, existsSync, rmSync, renameSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'
import sharp from 'sharp'

const kb = (p) => statSync(p).size / 1024
const ff = (args) => execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', ...args])
const hasAudio = (f) =>
  execFileSync(ffprobe.path, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', f])
    .toString()
    .trim().length > 0

let saved = 0

// GIF -> muted looping H.264 MP4. yuv420p + even dimensions for universal decode.
function gifToMp4(src, crf) {
  if (!existsSync(src)) return console.log(`  skip (missing): ${src}`)
  const out = src.replace(/\.gif$/, '.mp4')
  const before = kb(src)
  ff([
    '-i', src, '-an', '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-crf', String(crf), out,
  ])
  const after = kb(out)
  rmSync(src)
  saved += before - after
  console.log(`  gif->mp4   ${src}  ${before.toFixed(0)} KB -> ${after.toFixed(0)} KB  (crf ${crf})`)
}

// PNG -> WebP, alpha preserved at full quality (crisp sprite edges over terrain).
async function pngToWebp(src) {
  if (!existsSync(src)) return
  const out = src.replace(/\.png$/, '.webp')
  const before = kb(src)
  await sharp(src).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(out)
  const after = kb(out)
  rmSync(src)
  saved += before - after
  return { before, after }
}

async function convertSprites() {
  const base = path.join('src', 'assets', 'forest')
  let before = 0, after = 0, n = 0
  for (const d of ['trees', 'shrubs', 'flowers', 'animals']) {
    const dir = path.join(base, d)
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.png')) continue
      const r = await pngToWebp(path.join(dir, f))
      if (r) { before += r.before; after += r.after; n++ }
    }
  }
  if (n) console.log(`  sprites    ${n} png->webp  ${before.toFixed(0)} KB -> ${after.toFixed(0)} KB`)
  else console.log('  sprites    none to convert (already webp)')
}

// Strip audio from decorative videos without touching the video stream (lossless).
function stripVideoAudio() {
  const dir = path.join('src', 'assets', 'video-pack')
  if (!existsSync(dir)) return
  let n = 0
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.mp4')) continue
    const p = path.join(dir, f)
    if (!hasAudio(p)) continue
    const tmp = p + '.noaudio.mp4'
    ff(['-i', p, '-c:v', 'copy', '-an', tmp])
    rmSync(p)
    renameSync(tmp, p)
    n++
    console.log(`  strip      ${p} (audio track removed)`)
  }
  if (!n) console.log('  strip      no videos with audio')
}

async function main() {
  console.log('Optimizing ProTrack assets...')
  // ai orb renders at <=144px; crf 28 is visually lossless at that size and
  // ~4x smaller than crf 23. lock renders larger but is already tiny.
  gifToMp4(path.join('src', 'assets', 'ai.gif'), 28)
  gifToMp4(path.join('src', 'assets', 'lock.gif'), 28)
  await convertSprites()
  stripVideoAudio()
  console.log(`Done. Reclaimed ~${(saved / 1024).toFixed(2)} MB of source assets.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
