import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { openItemCounts } from '../counts'

const Y = 2024
const M = 5 // June
const D = 15
const NOW = new Date(Y, M, D, 12, 0, 0, 0)
const yesterday = new Date(Y, M, D - 1, 10, 0, 0, 0)
const tomorrow = new Date(Y, M, D + 1, 10, 0, 0, 0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('openItemCounts', () => {
  it('returns zeroes for empty inputs', () => {
    expect(openItemCounts()).toEqual({ openTodos: 0, eventsToday: 0, overdue: 0 })
  })

  it('counts open todos and ignores completed ones', () => {
    const todos = [
      { id: '1', text: 'Task 1', done: false },
      { id: '2', text: 'Task 2', done: true },
      { id: '3', text: 'Task 3', column: 'done' },
      { id: '4', text: 'Task 4', column: 'doing' },
    ]
    const counts = openItemCounts({ todos, date: NOW })
    expect(counts.openTodos).toBe(2)
  })

  it('counts overdue open items correctly', () => {
    const todos = [
      { id: '1', text: 'Past due', dueAt: yesterday, done: false },
      { id: '2', text: 'Past due but completed', dueAt: yesterday, done: true },
      { id: '3', text: 'Future due', dueAt: tomorrow, done: false },
      { id: '4', text: 'No due date', done: false },
    ]
    const counts = openItemCounts({ todos, date: NOW })
    expect(counts.openTodos).toBe(3)
    expect(counts.overdue).toBe(1)
  })

  it('counts events for the target date', () => {
    const events = [
      { id: 'e1', text: 'Today event', eventDate: '2024-06-15' },
      { id: 'e2', text: 'Today event by dueAt', dueAt: NOW },
      { id: 'e3', text: 'Tomorrow event', eventDate: '2024-06-16' },
      { id: 'e4', text: 'Yesterday event', dueAt: yesterday },
    ]
    const counts = openItemCounts({ events, date: NOW })
    expect(counts.eventsToday).toBe(2)
  })

  it('excludes events from openTodos count', () => {
    const todos = [
      { id: 't1', text: 'Todo 1', done: false },
      { id: 't2', text: 'Event todo', type: 'event', done: false },
    ]
    const counts = openItemCounts({ todos, date: NOW })
    expect(counts.openTodos).toBe(1)
  })
})
