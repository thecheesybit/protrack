import { describe, it, expect } from 'vitest'
import { suggestSessionTopic, listTopicCandidates, isMappingOverride } from '@/lib/topicMapping'

const tasks = [
  { id: 't1', title: 'Thermodynamics', column: 'todo', order: 3000 },
  { id: 't2', title: 'Kinematics', column: 'todo', order: 1000 },
  { id: 't3', title: 'Optics', column: 'done', order: 2000 },
]

const todos = [
  { id: 'd1', text: 'Buy notebook', done: false, subjectId: null },
  { id: 'd2', text: 'Already done thing', done: true, subjectId: null },
]

describe('suggestSessionTopic', () => {
  it('returns the explicit todo link when the session already has one', () => {
    expect(suggestSessionTopic({ todoId: 'd1' }, { tasks, todos })).toEqual({
      kind: 'todo',
      id: 'd1',
      title: 'Buy notebook',
      subjectId: null,
    })
  })

  it('returns the lowest-order not-done task for a subject-linked session (FIFO)', () => {
    expect(suggestSessionTopic({ subjectId: 'phys' }, { tasks, todos })).toEqual({
      kind: 'task',
      id: 't2',
      title: 'Kinematics',
      subjectId: 'phys',
    })
  })

  it('skips done tasks when picking the next topic', () => {
    const onlyDone = [{ id: 't3', title: 'Optics', column: 'done', order: 1 }]
    expect(suggestSessionTopic({ subjectId: 'phys' }, { tasks: onlyDone, todos })).toBeNull()
  })

  it('returns null when there is neither a todoId nor a subjectId with pending tasks', () => {
    expect(suggestSessionTopic({}, { tasks, todos })).toBeNull()
    expect(suggestSessionTopic({ subjectId: 'empty' }, { tasks: [], todos })).toBeNull()
  })

  it('still returns a todo suggestion even if the todo is missing from the cache', () => {
    expect(suggestSessionTopic({ todoId: 'missing' }, { tasks, todos })).toEqual({
      kind: 'todo',
      id: 'missing',
      title: null,
      subjectId: null,
    })
  })
})

describe('listTopicCandidates', () => {
  it('lists pending subject tasks (ordered) followed by pending todos', () => {
    expect(listTopicCandidates({ subjectId: 'phys' }, { tasks, todos })).toEqual([
      { kind: 'task', id: 't2', title: 'Kinematics', subjectId: 'phys' },
      { kind: 'task', id: 't1', title: 'Thermodynamics', subjectId: 'phys' },
      { kind: 'todo', id: 'd1', title: 'Buy notebook', subjectId: null },
    ])
  })

  it('omits task candidates when there is no subjectId', () => {
    expect(listTopicCandidates({}, { tasks, todos })).toEqual([
      { kind: 'todo', id: 'd1', title: 'Buy notebook', subjectId: null },
    ])
  })
})

describe('isMappingOverride', () => {
  it('is false when nothing was suggested or nothing was chosen', () => {
    expect(isMappingOverride(null, { kind: 'task', id: 't1' })).toBe(false)
    expect(isMappingOverride({ kind: 'task', id: 't1' }, null)).toBe(false)
  })

  it('is false when the choice matches the suggestion', () => {
    expect(isMappingOverride({ kind: 'task', id: 't2' }, { kind: 'task', id: 't2' })).toBe(false)
  })

  it('is true when the choice differs from the suggestion', () => {
    expect(isMappingOverride({ kind: 'task', id: 't2' }, { kind: 'task', id: 't1' })).toBe(true)
    expect(isMappingOverride({ kind: 'task', id: 't2' }, { kind: 'todo', id: 't2' })).toBe(true)
  })
})
