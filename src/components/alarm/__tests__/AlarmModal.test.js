import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Alarm Modal and Desk Clock Alarm Integration', () => {
  const alarmModalPath = path.resolve(__dirname, '../AlarmModal.jsx')
  const flipClockPath = path.resolve(__dirname, '../../common/FlipClock.jsx')

  it('AlarmModal contains tactile steppers, theme-aligned tokens, and audio test station', () => {
    const content = fs.readFileSync(alarmModalPath, 'utf8')

    // Theme tokens
    expect(content).toContain('bg-accent')
    expect(content).toContain('text-accent')
    expect(content).toContain('border-accent')
    expect(content).toContain('bg-surface')

    // Segmented tab navigation
    expect(content).toContain('activeTab')
    expect(content).toContain('Set Alarm')
    expect(content).toContain('Saved Alarms')

    // Tactile digital time steppers
    expect(content).toContain('incrementHour')
    expect(content).toContain('decrementHour')
    expect(content).toContain('incrementMinute')
    expect(content).toContain('decrementMinute')

    // Audio test station & visualizer wave
    expect(content).toContain('handleTestAudio')
    expect(content).toContain('Play & Test Audio')
    expect(content).toContain('Stop Sound Test')
    expect(content).toContain('sound-bar')

    // Sounds enabled check & 1-click unmute alert
    expect(content).toContain('soundsEnabled()')
    expect(content).toContain('setSoundsEnabled(true)')
    expect(content).toContain('Sounds muted in settings (Unmute)')

    // Quick presets
    expect(content).toContain('handleAddMinutes')
    expect(content).toContain('handleNextTopHour')
    expect(content).toContain('+5m')
    expect(content).toContain('+15m')
    expect(content).toContain('+30m')
    expect(content).toContain('+1h')

    // Smart activity tags
    expect(content).toContain('PRESET_LABELS')
    expect(content).toContain('Reminder Label & Purpose')
  })

  it('FlipClock hides alarm button tab when expanded to large scene (Ctrl + T mode)', () => {
    const content = fs.readFileSync(flipClockPath, 'utf8')

    // Verify conditional hiding in clockCentered mode
    expect(content).toContain('!clockCentered && (')
    expect(content).toContain('data-testid="flipclock-alarm-tab"')
    expect(content).toContain('setAlarmModalOpen(true)')
  })
})
