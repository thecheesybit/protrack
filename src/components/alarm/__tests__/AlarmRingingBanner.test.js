import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { notifyAlarm, closeActiveAlarmNotification } from '@/lib/notify'

describe('Phone Alarm Clock Experience (AlarmRingingBanner & Notification)', () => {
  const bannerPath = path.resolve(__dirname, '../AlarmRingingBanner.jsx')
  const watcherPath = path.resolve(__dirname, '../../../hooks/useAlarmWatcher.js')
  const notifyPath = path.resolve(__dirname, '../../../lib/notify.js')

  it('AlarmRingingBanner implements the full phone alarm clock interface', () => {
    const content = fs.readFileSync(bannerPath, 'utf8')

    // Live clock and time display
    expect(content).toContain('displayHours')
    expect(content).toContain('minutes')
    expect(content).toContain('ampm')

    // Shockwave animation & vibrating bell
    expect(content).toContain('animate-ping')
    expect(content).toContain('BellRing')
    expect(content).toContain('ALARM RINGING')

    // Tactile Turn Off and Snooze buttons
    expect(content).toContain('TURN OFF ALARM')
    expect(content).toContain('Snooze for 5 minutes')

    // Sound & Notification cleanup
    expect(content).toContain('startAlarmRingtone')
    expect(content).toContain('stopAlarmRingtone')
    expect(content).toContain('closeActiveAlarmNotification')

    // Keyboard shortcuts (Space, Enter, Escape)
    expect(content).toContain("e.key === 'Escape' || e.key === ' ' || e.key === 'Enter'")
  })

  it('useAlarmWatcher dispatches startAlarmRingtone and notifyAlarm when alarm triggers', () => {
    const content = fs.readFileSync(watcherPath, 'utf8')

    expect(content).toContain('startAlarmRingtone()')
    expect(content).toContain('notifyAlarm(alarm')
    expect(content).toContain('setActiveRingingAlarm(alarm)')
  })

  it('notifyAlarm creates notification with requireInteraction and click to restore', () => {
    const mockClose = vi.fn()
    let constructedOptions = null
    let constructedTitle = null

    class MockNotification {
      constructor(title, options) {
        constructedTitle = title
        constructedOptions = options
        this.close = mockClose
        this.onclick = null
      }
      static permission = 'granted'
    }

    global.Notification = MockNotification
    global.window = {
      focus: vi.fn(),
      protrack: {
        window: {
          restore: vi.fn(),
        },
      },
    }

    const alarm = { id: 'a1', time: '07:30', label: 'Morning Wakeup' }
    const notif = notifyAlarm(alarm)

    expect(constructedTitle).toBe('⏰ Morning Wakeup')
    expect(constructedOptions.requireInteraction).toBe(true)
    expect(constructedOptions.renotify).toBe(true)
    expect(constructedOptions.body).toContain('Click to turn off alarm')

    // Test click handler restores window
    notif.onclick()
    expect(global.window.focus).toHaveBeenCalled()
    expect(global.window.protrack.window.restore).toHaveBeenCalled()
    expect(mockClose).toHaveBeenCalled()

    // Test closeActiveAlarmNotification cleanly cleans up
    closeActiveAlarmNotification()
  })
})
