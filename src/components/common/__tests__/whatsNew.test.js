import { describe, it, expect } from 'vitest'
import { createUiSlice } from '@/store/slices/uiSlice'
import fs from 'fs'
import path from 'path'

describe("What's New Tour & Video Pop-up", () => {
  function makeSlice() {
    let state = {}
    const set = (patch) => {
      const next = typeof patch === 'function' ? patch(state) : patch
      state = { ...state, ...next }
    }
    state = createUiSlice(set, () => state)
    return { get: () => state }
  }

  it('uiSlice manages whatsNewOpen state and setter', () => {
    const slice = makeSlice()
    expect(slice.get().whatsNewOpen).toBe(false)
    slice.get().setWhatsNewOpen(true)
    expect(slice.get().whatsNewOpen).toBe(true)
    slice.get().setWhatsNewOpen(false)
    expect(slice.get().whatsNewOpen).toBe(false)
  })

  it('optimized whats-new.mp4 exists in video-pack and has reasonable size', () => {
    const videoPath = path.resolve(__dirname, '../../../assets/video-pack/whats-new.mp4')
    expect(fs.existsSync(videoPath)).toBe(true)
    const stats = fs.statSync(videoPath)
    // Verify file is compressed under 2 MB (we optimized to ~1.42 MB)
    expect(stats.size).toBeLessThan(2 * 1024 * 1024)
    expect(stats.size).toBeGreaterThan(100 * 1024)
  })

  it('WhatsNewModal contains silent video player, no controls, and release points transition', () => {
    const modalPath = path.resolve(__dirname, '../WhatsNewModal.jsx')
    const content = fs.readFileSync(modalPath, 'utf8')

    // Imports optimized video asset
    expect(content).toContain("whatsNewVideo from '@/assets/video-pack/whats-new.mp4'")

    // Video tag configuration: muted, no controls, autoPlay, playsInline
    expect(content).toContain('muted')
    expect(content).toContain('autoPlay')
    expect(content).toContain('playsInline')
    expect(content).toContain('controls={false}')

    // Progress indicator & video ended handling
    expect(content).toContain('onEnded={handleVideoEnded}')
    expect(content).toContain('onTimeUpdate={handleTimeUpdate}')
    expect(content).toContain("setStage('summary')")

    // Thank you message and back to business
    expect(content).toContain('Thanks for keeping PRO TRACK part of your day')
    expect(content).toContain('Back to business')
    expect(content).toContain('Replay video')
  })

  it('SettingsPanel includes the What\'s New video showcase card and launch trigger', () => {
    const updatesTabPath = path.resolve(__dirname, '../../settings/tabs/UpdatesTab.jsx')
    const settingsPath = path.resolve(__dirname, '../../settings/SettingsPanel.jsx')
    const content = fs.existsSync(updatesTabPath)
      ? fs.readFileSync(updatesTabPath, 'utf8')
      : fs.readFileSync(settingsPath, 'utf8')

    expect(content).toContain("whatsNewVideo from '@/assets/video-pack/whats-new.mp4'")
    expect(content).toContain("What's New Video")
    expect(content).toContain('setWhatsNewOpen(true)')
    expect(content).toContain('Watch Tour')
  })
})
