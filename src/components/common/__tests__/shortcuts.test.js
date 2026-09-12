import { describe, it, expect } from 'vitest'
import { createUiSlice } from '@/store/slices/uiSlice'
import fs from 'fs'
import path from 'path'

describe('Keyboard Shortcuts & Navigation', () => {
  function makeSlice() {
    let state = {}
    const set = (patch) => {
      const next = typeof patch === 'function' ? patch(state) : patch
      state = { ...state, ...next }
    }
    state = createUiSlice(set, () => state)
    return { get: () => state }
  }

  describe('uiSlice widget maximize and activeWidgetId tracking', () => {
    it('initializes with default activeWidgetId and maximizedWidgetId as null', () => {
      const slice = makeSlice()
      expect(slice.get().maximizedWidgetId).toBeNull()
      expect(slice.get().activeWidgetId).toBe('timetable')
    })

    it('maximizeWidget updates maximizedWidgetId and activeWidgetId', () => {
      const slice = makeSlice()
      slice.get().maximizeWidget('notes')
      expect(slice.get().maximizedWidgetId).toBe('notes')
      expect(slice.get().activeWidgetId).toBe('notes')
    })

    it('toggleWidget maximizes when unmaximized and restores to null when already maximized', () => {
      const slice = makeSlice()
      slice.get().toggleWidget('focus')
      expect(slice.get().maximizedWidgetId).toBe('focus')
      expect(slice.get().activeWidgetId).toBe('focus')

      slice.get().toggleWidget('focus')
      expect(slice.get().maximizedWidgetId).toBeNull()
    })

    it('restoreWidgets clears maximizedWidgetId while keeping activeWidgetId', () => {
      const slice = makeSlice()
      slice.get().maximizeWidget('subjects')
      expect(slice.get().maximizedWidgetId).toBe('subjects')
      slice.get().restoreWidgets()
      expect(slice.get().maximizedWidgetId).toBeNull()
      expect(slice.get().activeWidgetId).toBe('subjects')
    })
  })

  describe('electron/main.js shortcut configuration', () => {
    it('does not register global toggleFullScreen in electron main process', () => {
      const mainJsPath = path.resolve(__dirname, '../../../../electron/main.js')
      const content = fs.readFileSync(mainJsPath, 'utf8')

      // Ensure toggleFullScreen is not in SHORTCUTS definition
      const shortcutsMatch = content.match(/const SHORTCUTS = \{([\s\S]*?)\}/)
      expect(shortcutsMatch).toBeTruthy()
      expect(shortcutsMatch[1]).not.toContain('toggleFullScreen')

      // Ensure no globalShortcut.register with toggleFullScreen exists
      expect(content).not.toContain('reg(SHORTCUTS.toggleFullScreen')
    })
  })

  describe('HelpModal shortcuts reference', () => {
    it('HelpModal source contains the required in-app navigation shortcuts', () => {
      const helpModalPath = path.resolve(__dirname, '../HelpModal.jsx')
      const content = fs.readFileSync(helpModalPath, 'utf8')

      // Check for navigation shortcuts: T, C, D, N, S, E / X, M
      expect(content).toContain("['T', 'Add to-do (focuses task input)']")
      expect(content).toContain("['C', 'Open Calendar & Timetable']")
      expect(content).toContain("['D', 'Open Deep Focus']")
      expect(content).toContain("['N', 'Open Notes']")
      expect(content).toContain("['S', 'Open Subjects']")
      expect(content).toContain("['E / X', 'Open Scorecard (exams & mocks)']")
      expect(content).toContain("['M / Double-click', 'Maximize / restore widget']")

      // Check for '?' toggle open and close
      expect(content).toContain("['?', 'Toggle this shortcuts sheet (open / close)']")

      // Ensure global toggleFullScreen row was removed
      expect(content).not.toContain('globals.toggleFullScreen')
    })
  })

  describe('Dashboard keydown shortcuts integration', () => {
    it('Dashboard.jsx implements navigation keys and Escape closing HelpModal', () => {
      const dashboardPath = path.resolve(__dirname, '../../layout/Dashboard.jsx')
      const content = fs.readFileSync(dashboardPath, 'utf8')

      expect(content).toContain("helpOpenRef.current")
      expect(content).toContain("setHelpOpen(false)")
      expect(content).toContain("setHelpOpen((prev) => !prev)")
      expect(content).toContain("st.toggleWidget('timetable')")
      expect(content).toContain("st.toggleWidget('focus')")
      expect(content).toContain("st.toggleWidget('notes')")
      expect(content).toContain("st.toggleWidget('subjects')")
      expect(content).toContain("st.toggleWidget('scorecard')")
      expect(content).toContain("st.restoreWidgets()")
      expect(content).toContain("e.altKey && e.key.toLowerCase() === 'a'")
      expect(content).toContain("e.altKey && e.key.toLowerCase() === 'w'")
      expect(content).toContain("e.altKey && e.key.toLowerCase() === 't'")
      expect(content).toContain("st.setAlarmModalOpen")
      expect(content).toContain("st.setSettingsOpen")
    })
  })

  describe('Flip Clock Alarm Integration & Alt + A Shortcut', () => {
    it('uiSlice manages alarmModalOpen and activeRingingAlarm', () => {
      const slice = makeSlice()
      expect(slice.get().alarmModalOpen).toBe(false)
      expect(slice.get().activeRingingAlarm).toBeNull()

      slice.get().setAlarmModalOpen(true)
      expect(slice.get().alarmModalOpen).toBe(true)

      slice.get().setAlarmModalOpen((prev) => !prev)
      expect(slice.get().alarmModalOpen).toBe(false)

      const fakeAlarm = { id: 'a1', time: '08:00', label: 'Test' }
      slice.get().setActiveRingingAlarm(fakeAlarm)
      expect(slice.get().activeRingingAlarm).toEqual(fakeAlarm)
    })

    it('HelpModal registers Alt + A shortcut', () => {
      const helpModalPath = path.resolve(__dirname, '../HelpModal.jsx')
      const content = fs.readFileSync(helpModalPath, 'utf8')
      expect(content).toContain("['Alt + A', 'Set Alarm / Reminder (Flip Clock)']")
    })

    it('FlipClock contains the top alarm button tab', () => {
      const flipClockPath = path.resolve(__dirname, '../FlipClock.jsx')
      const content = fs.readFileSync(flipClockPath, 'utf8')
      expect(content).toContain('data-testid="flipclock-alarm-tab"')
      expect(content).toContain('setAlarmModalOpen(true)')
    })
  })
})
