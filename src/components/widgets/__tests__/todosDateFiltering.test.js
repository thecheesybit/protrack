import { describe, it, expect } from 'vitest'
import { ymd } from '@/lib/dates'

function toDateSafe(val) {
  if (!val) return null
  if (typeof val.toDate === 'function') return val.toDate()
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === 'number' || typeof val === 'string') {
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function getTodoDueDay(t) {
  if (!t.dueAt) return null
  const d = toDateSafe(t.dueAt)
  return d ? ymd(d) : null
}

function getTodoCreatedDay(t) {
  if (!t.createdAt) return null
  const d = toDateSafe(t.createdAt)
  return d ? ymd(d) : null
}

function getTodoCompletedDay(t) {
  if (t.completedAt) {
    const d = toDateSafe(t.completedAt)
    if (d) return ymd(d)
  }
  if (t.updatedAt) {
    const d = toDateSafe(t.updatedAt)
    if (d) return ymd(d)
  }
  if (t.createdAt) {
    const d = toDateSafe(t.createdAt)
    if (d) return ymd(d)
  }
  return null
}

function filterDoneTodos(todos, selectedDate, filterMode = 'day') {
  return todos.filter((t) => {
    if (!t.done) return false
    if (filterMode === 'all') return true
    const compDay = getTodoCompletedDay(t)
    return compDay === selectedDate
  })
}

function filterOpenTodos(todos, selectedDate, todayDateStr, filterMode = 'day') {
  if (filterMode === 'all') {
    return todos.filter((t) => !t.done)
  }

  const isSelectedToday = selectedDate === todayDateStr

  return todos.filter((t) => {
    if (t.done) return false
    const dueDay = getTodoDueDay(t)
    const createdDay = getTodoCreatedDay(t)

    // 1. Task has explicit due date
    if (dueDay) {
      if (dueDay === selectedDate) return true
      if (isSelectedToday && dueDay < todayDateStr) return true
      return false
    }

    // 2. Task has NO due date
    if (isSelectedToday) {
      return true
    }

    if (selectedDate < todayDateStr) {
      return createdDay === selectedDate
    }

    return false
  })
}

describe('Day-wise To-do Filtering Logic', () => {
  const TODAY = '2026-09-09'
  const YESTERDAY = '2026-09-08'
  const TOMORROW = '2026-09-10'

  const sampleTodos = [
    // Completed tasks (completed yesterday)
    { id: '1', text: 'prompting to create subject', done: true, completedAt: '2026-09-08T14:00:00.000Z' },
    { id: '2', text: 'counter on dashboard', done: true, completedAt: '2026-09-08T15:30:00.000Z' },
    { id: '3', text: 'no global switcher', done: true, completedAt: '2026-09-08T18:00:00.000Z' },

    // Open tasks
    { id: '4', text: 'Study physics today', done: false, column: 'backlog', dueAt: '2026-09-09T10:00:00.000Z' },
    { id: '5', text: 'Math test tomorrow', done: false, column: 'backlog', dueAt: '2026-09-10T09:00:00.000Z' },
    { id: '6', text: 'Overdue assignment', done: false, column: 'doing', dueAt: '2026-09-07T12:00:00.000Z' },
    { id: '7', text: 'General undated task', done: false, column: 'backlog', createdAt: '2026-09-09T08:00:00.000Z' },
  ]

  it('Completed section is EMPTY for today if no task was completed today', () => {
    const doneToday = filterDoneTodos(sampleTodos, TODAY, 'day')
    expect(doneToday).toHaveLength(0)
  })

  it('Completed section shows yesterday\'s completed tasks when yesterday is selected', () => {
    const doneYesterday = filterDoneTodos(sampleTodos, YESTERDAY, 'day')
    expect(doneYesterday).toHaveLength(3)
    expect(doneYesterday.map((t) => t.id)).toEqual(['1', '2', '3'])
  })

  it('Shows task completed today once marked done today', () => {
    const todosWithTodayDone = [
      ...sampleTodos,
      { id: '8', text: 'Task finished today', done: true, completedAt: '2026-09-09T11:00:00.000Z' },
    ]
    const doneToday = filterDoneTodos(todosWithTodayDone, TODAY, 'day')
    expect(doneToday).toHaveLength(1)
    expect(doneToday[0].text).toBe('Task finished today')
  })

  it('Backlog/doing on Today includes tasks due today, overdue tasks, and undated tasks', () => {
    const openToday = filterOpenTodos(sampleTodos, TODAY, TODAY, 'day')
    expect(openToday.map((t) => t.id)).toEqual(['4', '6', '7'])
    expect(openToday.find((t) => t.id === '5')).toBeUndefined() // tomorrow's task excluded
  })

  it('Tomorrow only shows tasks scheduled for tomorrow', () => {
    const openTomorrow = filterOpenTodos(sampleTodos, TOMORROW, TODAY, 'day')
    expect(openTomorrow.map((t) => t.id)).toEqual(['5'])
  })

  it('Filter mode "all" shows all open and completed tasks regardless of day', () => {
    const allOpen = filterOpenTodos(sampleTodos, TODAY, TODAY, 'all')
    expect(allOpen).toHaveLength(4)
    const allDone = filterDoneTodos(sampleTodos, TODAY, 'all')
    expect(allDone).toHaveLength(3)
  })
})
