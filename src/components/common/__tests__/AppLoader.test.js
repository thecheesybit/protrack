import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('AppLoader and Loading Screen Aesthetics', () => {
  const videoPackDir = path.resolve(__dirname, '../../../../src/assets/video-pack')
  const appLoaderPath = path.resolve(__dirname, '../AppLoader.jsx')
  const titleBarPath = path.resolve(__dirname, '../../../desktop/TitleBar.jsx')

  it('laoding-1.mp4 exists in video-pack and is optimized under 1MB', () => {
    const videoPath = path.join(videoPackDir, 'laoding-1.mp4')
    expect(fs.existsSync(videoPath)).toBe(true)

    const stat = fs.statSync(videoPath)
    // Compressed size under 1MB
    expect(stat.size).toBeLessThan(1024 * 1024)
    expect(stat.size).toBeGreaterThan(100 * 1024)
  })

  it('AppLoader spans fixed inset-0 and eliminates top bar color mismatch', () => {
    const content = fs.readFileSync(appLoaderPath, 'utf8')
    const titleBarContent = fs.readFileSync(titleBarPath, 'utf8')

    // Spans full window from y=0 to y=100%
    expect(content).toContain('fixed inset-0 z-40')
    expect(content).toContain('bg-[#07080c]')

    // TitleBar floats on top with relative z-50 and transparent bg
    expect(titleBarContent).toContain('relative z-50 shrink-0')
    expect(titleBarContent).toContain('bg-transparent')
  })

  it('AppLoader removes top header bar and places version next to PRO Track', () => {
    const content = fs.readFileSync(appLoaderPath, 'utf8')

    // Top header bar removed per annotation (2)
    expect(content).not.toContain('ProTrack Workspace')
    expect(content).not.toContain('PROTRACK WORKSPACE')

    // Version pill placed directly next to PRO Track per annotation (3)
    expect(content).toContain('PRO Track')
    expect(content).toContain('v{displayVersion}')
    expect(content).toContain('flex items-center justify-center gap-2.5 sm:gap-3')
  })

  it('AppLoader has 10% bigger footer attribution and no video', () => {
    const content = fs.readFileSync(appLoaderPath, 'utf8')

    // No video
    expect(content).not.toContain('<video')
    expect(content).not.toContain('loadingVideo')

    // Footer is 10% larger (text-sm sm:text-[15px] vs text-xs) per annotation (4)
    expect(content).toContain('text-sm sm:text-[15px]')
    expect(content).toContain('AYUSH KUMAR')
  })
})
