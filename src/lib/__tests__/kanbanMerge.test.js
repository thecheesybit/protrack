import { describe, it, expect } from 'vitest'
import { taskToCard, todoToCard, mergeSubjectCards } from '@/lib/kanbanMerge'

describe('taskToCard', () => {
  it('tags a task with _kind and leaves its fields untouched', () => {
    const task = { id: 't1', title: 'Lesson 10', column: 'todo', order: 1000 }
    expect(taskToCard(task)).toEqual({ ...task, _kind: 'task' })
  })
})

describe('todoToCard', () => {
  it('maps text -> title and derives column from done when subjectColumn is unset', () => {
    const todo = { id: 'd1', text: 'Buy notebook', done: false, subjectId: 'phys' }
    expect(todoToCard(todo)).toEqual({
      id: 'd1',
      _kind: 'todo',
      title: 'Buy notebook',
      column: 'todo',
      priority: 'medium',
      notes: '',
      dueAt: null,
      topicId: null,
      order: 0,
    })
  })

  it('surfaces subjectTopicId as topicId so topic grouping treats todos like tasks', () => {
    expect(todoToCard({ id: 'd5', text: 'x', done: false, subjectTopicId: 'topic-1' }).topicId).toBe('topic-1')
  })

  it('derives the done column from `done: true` when subjectColumn is unset', () => {
    expect(todoToCard({ id: 'd2', text: 'x', done: true }).column).toBe('done')
  })

  it('prefers an explicit subjectColumn (e.g. "doing") over the done-derived default', () => {
    expect(todoToCard({ id: 'd3', text: 'x', done: false, subjectColumn: 'doing' }).column).toBe('doing')
  })

  it('carries through priority, notes, dueAt, and order when present', () => {
    const todo = {
      id: 'd4',
      text: 'x',
      done: false,
      priority: 'high',
      notes: 'some notes',
      dueAt: '2026-01-01',
      order: 500,
    }
    const card = todoToCard(todo)
    expect(card.priority).toBe('high')
    expect(card.notes).toBe('some notes')
    expect(card.dueAt).toBe('2026-01-01')
    expect(card.order).toBe(500)
  })
})

describe('mergeSubjectCards', () => {
  const tasks = [{ id: 't1', title: 'Lesson 10', column: 'todo', order: 1000 }]
  const todos = [
    { id: 'd1', text: 'Buy notebook', done: false, subjectId: 'phys' },
    { id: 'd2', text: 'Unrelated todo', done: false, subjectId: 'chem' },
    { id: 'd3', text: 'No subject', done: false, subjectId: null },
  ]

  it('includes only todos linked to the given subjectId, after the tasks', () => {
    const merged = mergeSubjectCards(tasks, todos, 'phys')
    expect(merged.map((c) => c.id)).toEqual(['t1', 'd1'])
    expect(merged[0]._kind).toBe('task')
    expect(merged[1]._kind).toBe('todo')
  })

  it('returns just the tasks, tagged, when no todos match', () => {
    expect(mergeSubjectCards(tasks, todos, 'bio')).toEqual([{ ...tasks[0], _kind: 'task' }])
  })

  it('handles missing/empty inputs gracefully', () => {
    expect(mergeSubjectCards([], [], 'phys')).toEqual([])
    expect(mergeSubjectCards(undefined, undefined, 'phys')).toEqual([])
  })

  it('never matches todos when subjectId is falsy', () => {
    expect(mergeSubjectCards(tasks, todos, null)).toEqual([{ ...tasks[0], _kind: 'task' }])
  })
})
