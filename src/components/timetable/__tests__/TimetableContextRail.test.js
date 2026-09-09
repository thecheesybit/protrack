import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('TimetableContextRail & Slot Class Legends Architecture', () => {
  const railPath = path.resolve(__dirname, '../TimetableContextRail.jsx')
  const gridPath = path.resolve(__dirname, '../TimetableGrid.jsx')
  const subjectModalPath = path.resolve(__dirname, '../../subjects/SubjectEditorModal.jsx')
  const slotModalPath = path.resolve(__dirname, '../SlotEditorModal.jsx')

  it('TimetableContextRail implements dynamic hover expand, inspector, and legends', () => {
    const content = fs.readFileSync(railPath, 'utf8')

    // Data-testid and class positioning anchored directly against timetable card
    expect(content).toContain('data-testid="timetable-context-rail"')
    expect(content).toContain('right-full')
    expect(content).toContain('top-[92px]')
    expect(content).toContain('bottom-[88px]')
    expect(content).toContain('bottom-[196px]')

    // Hover detection, 5s linger countdown & manual close pill
    expect(content).toContain('setIsSelfHovered')
    expect(content).toContain('isPinned')
    expect(content).toContain('hoveredItem')
    expect(content).toContain('lingerRemaining')
    expect(content).toContain('handleManualClose')
    expect(content).toContain('setTimetableLegendsExpanded')
    expect(content).toContain('Legends & Details')
    expect(content).toContain('activeTab')

    // Live Event / Slot Inspector
    expect(content).toContain('Event Inspector')
    expect(content).toContain('Focus on this Class')
    expect(content).toContain('typeBadge')
    expect(content).toContain('customTopic')

    // Subject & Class Type Legends
    expect(content).toContain('Classes & Subjects')
    expect(content).toContain('Class Type Legend')
    expect(content).toContain('Core theory & instruction')
    expect(content).toContain('Laboratory')
    expect(content).toContain('Tutorial')
    expect(content).toContain('Seminar')
    expect(content).toContain('Revision')

    // Mutual exclusivity & Inactivity timer
    expect(content).toContain('modeRailOpen')
    expect(content).toContain('setModeRailOpen')
    expect(content).toContain('scopeDropdownOpen')
    expect(content).toContain('panelInactivityTimerRef')
    expect(content).toContain('resetPanelActivity')

    // L key toggle on / off & hover prompt
    expect(content).toContain('timetableLegendsEnabled')
    expect(content).toContain('toggleTimetableLegends')
    expect(content).toContain('Press L to turn on')
  })

  it('TimetableGrid resolves subject names, type badges [L], and triggers hover inspector', () => {
    const content = fs.readFileSync(gridPath, 'utf8')

    // Subject resolution instead of generic 'Lecture'
    expect(content).toContain('subj.name')
    expect(content).toContain('primaryTitle')
    expect(content).toContain('topicSubtitle')

    // Class type badge formatting [L], [Lab], [T], [S]
    expect(content).toContain('badgeText')
    expect(content).toContain("badgeText = 'L'")
    expect(content).toContain("badgeText = 'Lab'")
    expect(content).toContain("badgeText = 'T'")
    expect(content).toContain("badgeText = 'S'")

    // Hover inspector integration
    expect(content).toContain('onHover?.(slot)')
    expect(content).toContain('setHoveredTimetableItem')
    expect(content).toContain('isSubjectHighlighted')
  })

  it('SubjectEditorModal preserves subject name as default slot label', () => {
    const content = fs.readFileSync(subjectModalPath, 'utf8')

    // Verification that slot label defaults to customLabel || name (subject name), not overridden by 'Lecture'
    expect(content).toContain('customLabel || name')
  })

  it('SlotEditorModal offers quick class type presets', () => {
    const content = fs.readFileSync(slotModalPath, 'utf8')

    // Quick presets
    expect(content).toContain('Class / Session Type')
    expect(content).toContain('[L]')
    expect(content).toContain('[Lab]')
    expect(content).toContain('[T]')
    expect(content).toContain('[S]')
  })
})
