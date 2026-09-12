import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the store + every service the executor touches so no Firebase is hit.
const getState = vi.fn()
vi.mock('@/store/useStore', () => ({ useStore: { getState: () => getState() } }))
vi.mock('@/services/subjectService', () => ({
  deleteSubject: vi.fn(() => Promise.resolve()),
  deleteTask: vi.fn(() => Promise.resolve()),
  subscribeToTasks: vi.fn(),
}))
vi.mock('@/services/todoService', () => ({ deleteTodo: vi.fn(() => Promise.resolve()) }))
vi.mock('@/services/habitService', () => ({ deleteHabit: vi.fn(() => Promise.resolve()) }))
vi.mock('@/services/noteService', () => ({ addNote: vi.fn(() => Promise.resolve()) }))
vi.mock('@/services/modeService', () => ({ createMode: vi.fn(() => Promise.resolve()) }))
vi.mock('@/services/userService', () => ({ updateActiveMode: vi.fn(() => Promise.resolve()) }))
vi.mock('@/services/alarmService', () => ({
  createAlarm: vi.fn(({ time }) => ({ id: 'a1', time })),
  getAlarms: vi.fn(() => []),
  deleteAlarm: vi.fn(),
}))
vi.mock('@/lib/sound', () => ({
  stopAlarmRingtone: vi.fn(),
}))

import {
  AGENT_TOOL_DECLARATIONS,
  AGENT_ACTION_NAMES,
  executeAgentAction,
} from '@/services/agentActions'
import { deleteTodo } from '@/services/todoService'
import { stopAlarmRingtone } from '@/lib/sound'

const CTX = {
  uid: 'u1',
  modeId: 'm1',
  subjects: [{ id: 's1', name: 'Physics', progressPct: 20 }],
  habits: [{ id: 'h1', name: 'Meditate', doneDates: [] }],
  todos: [{ id: 't1', text: 'Submit essay', done: false, dueAt: '2000-01-01T09:00:00' }],
}

beforeEach(() => {
  getState.mockReturnValue({})
  vi.clearAllMocks()
})

describe('agentActions declarations', () => {
  it('declares the new capability tools', () => {
    const names = AGENT_TOOL_DECLARATIONS.map((d) => d.name)
    for (const n of [
      'get_status', 'open_view', 'switch_mode', 'start_focus', 'control_focus',
      'set_alarm', 'cancel_alarm', 'add_note', 'delete_todo', 'delete_subject',
      'dismiss_assistant',
    ]) {
      expect(names).toContain(n)
    }
    expect(AGENT_ACTION_NAMES).toEqual(names)
  })
})

describe('executeAgentAction', () => {
  it('returns null for a tool it does not own (routing signal)', async () => {
    const res = await executeAgentAction('add_todo', { text: 'x' }, CTX)
    expect(res).toBeNull()
  })

  it('refuses when signed out', async () => {
    const res = await executeAgentAction('get_status', { topic: 'subjects' }, { uid: null })
    expect(res).toEqual({ ok: false, error: 'Not signed in.' })
  })

  it('get_status subjects reads from ctx', async () => {
    const res = await executeAgentAction('get_status', { topic: 'subjects' }, CTX)
    expect(res.ok).toBe(true)
    expect(res.summary).toContain('Physics 20%')
  })

  it('get_status todos_overdue classifies the overdue item', async () => {
    const res = await executeAgentAction('get_status', { topic: 'todos_overdue' }, CTX)
    expect(res.ok).toBe(true)
    expect(res.summary).toContain('Submit essay')
  })

  it('open_view maximises a widget via the store', async () => {
    const maximizeWidget = vi.fn()
    getState.mockReturnValue({ maximizeWidget })
    const res = await executeAgentAction('open_view', { view: 'analytics' }, CTX)
    expect(res.ok).toBe(true)
    expect(maximizeWidget).toHaveBeenCalledWith('analytics')
  })

  it('open_view rejects an unknown view', async () => {
    const res = await executeAgentAction('open_view', { view: 'nonsense' }, CTX)
    expect(res.ok).toBe(false)
  })

  it('set_alarm parses a 12-hour time', async () => {
    const res = await executeAgentAction('set_alarm', { time: '7:30 am', label: 'Wake' }, CTX)
    expect(res.ok).toBe(true)
    expect(res.summary).toContain('7:30 AM')
  })

  it('delete_todo removes a matching item', async () => {
    const res = await executeAgentAction('delete_todo', { text: 'essay' }, CTX)
    expect(res.ok).toBe(true)
    expect(deleteTodo).toHaveBeenCalledWith('u1', 't1')
  })

  it('start_focus starts a session on a subject', async () => {
    const startFocus = vi.fn()
    const maximizeWidget = vi.fn()
    getState.mockReturnValue({ startFocus, maximizeWidget, activeModeId: 'm1' })
    const res = await executeAgentAction('start_focus', { subjectName: 'Physics', durationMin: 30 }, CTX)
    expect(res.ok).toBe(true)
    expect(startFocus).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 's1', durationMin: 30 }),
    )
    expect(maximizeWidget).toHaveBeenCalledWith('focus')
  })

  it('dismiss_assistant turns off hands-free mode in the store', async () => {
    const setHandsFreeActive = vi.fn()
    const setHandsFreeStatus = vi.fn()
    getState.mockReturnValue({ setHandsFreeActive, setHandsFreeStatus })
    const res = await executeAgentAction('dismiss_assistant', { message: 'Goodbye!' }, CTX)
    expect(res.ok).toBe(true)
    expect(res.dismissed).toBe(true)
    expect(setHandsFreeActive).toHaveBeenCalledWith(false)
    expect(setHandsFreeStatus).toHaveBeenCalledWith('idle')
  })

  it('cancel_alarm with "stop" or "dismiss" silences ringing alarm', async () => {
    const setAlarmModalOpen = vi.fn()
    getState.mockReturnValue({ setAlarmModalOpen })
    const res = await executeAgentAction('cancel_alarm', { query: 'stop' }, CTX)
    expect(res.ok).toBe(true)
    expect(stopAlarmRingtone).toHaveBeenCalled()
    expect(setAlarmModalOpen).toHaveBeenCalledWith(false)
  })
})
