import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Notifications System & Settings Overhaul', () => {
  it('NotificationsTab.jsx component exists and exports NotificationsTab', () => {
    const tabPath = path.resolve(__dirname, '../tabs/NotificationsTab.jsx')
    expect(fs.existsSync(tabPath)).toBe(true)
    const content = fs.readFileSync(tabPath, 'utf8')
    expect(content).toContain('export function NotificationsTab')
    expect(content).toContain('Desktop OS Notifications')
    expect(content).toContain('Granular Desktop Channels')
    expect(content).toContain('In-App Notification Surfaces')
    expect(content).toContain('Scheduled Alarms')
    expect(content).toContain('Deep Focus & Break Completions')
    expect(content).toContain('Deadlines & Notes')
    expect(content).toContain('Hydration Alerts (Desktop)')
  })

  it('SettingsPanel.jsx registers Notifications tab in Workspace group with Bell icon', () => {
    const settingsPath = path.resolve(__dirname, '../SettingsPanel.jsx')
    const content = fs.readFileSync(settingsPath, 'utf8')
    expect(content).toContain("const NotificationsTab = lazy(() => import('./tabs/NotificationsTab')")
    expect(content).toContain("{ id: 'notifications', label: 'Notifications', icon: Bell }")
    expect(content).toContain("activeTab === 'notifications'")
  })

  it('useHabitReminders.js does NOT dispatch desktop OS notifications', () => {
    const habitHookPath = path.resolve(__dirname, '../../../hooks/useHabitReminders.js')
    const content = fs.readFileSync(habitHookPath, 'utf8')
    // Must NOT import notify or call notify in triggerHabitCue
    expect(content).not.toMatch(/import\s*\{[^}]*\bnotify\b[^}]*\}\s*from\s*['"]@\/lib\/notify['"]/)
    expect(content).not.toContain("notify(")
    // Retains in-app notifications
    expect(content).toContain('useStore.getState().pushIsland')
    expect(content).toContain("st.pushPrompt({")
  })

  it('notify calls across hooks specify proper categories', () => {
    const focusPath = path.resolve(__dirname, '../../../hooks/useFocusEngine.js')
    const notePath = path.resolve(__dirname, '../../../hooks/useNoteReminders.js')
    const hydrationPath = path.resolve(__dirname, '../../wellness/HydrationReminder.jsx')

    const focusContent = fs.readFileSync(focusPath, 'utf8')
    const noteContent = fs.readFileSync(notePath, 'utf8')
    const hydrationContent = fs.readFileSync(hydrationPath, 'utf8')

    expect(focusContent).toContain("category: 'focus'")
    expect(noteContent).toContain("category: 'deadlines'")
    expect(hydrationContent).toContain("category: 'hydration'")
  })

  it('electron/main.js configures clean app identity for Windows notifications', () => {
    const mainPath = path.resolve(__dirname, '../../../../electron/main.js')
    const content = fs.readFileSync(mainPath, 'utf8')
    expect(content).toContain("app.setName('PRO TRACK')")
    expect(content).toContain("app.setAppUserModelId('com.protrack.app')")
  })
})
