import { describe, it, expect } from 'vitest'
import {
  groupTasksByTopic,
  topicStats,
  pendingTaskIds,
  isTopicComplete,
} from '../topics'

const topics = [
  { id: 'tB', title: 'Topic B', order: 20 },
  { id: 'tA', title: 'Topic A', order: 10 },
]

const tasks = [
  { id: 'l1', topicId: 'tA', order: 1, column: 'done' },
  { id: 'l2', topicId: 'tA', order: 2, column: 'todo' },
  { id: 'l3', topicId: 'tB', order: 3, column: 'todo' },
  { id: 'l4', topicId: null, order: 4, column: 'todo' },
  { id: 'l5', topicId: 'ghost', order: 5, column: 'todo' }, // dangling → ungrouped
]

describe('groupTasksByTopic', () => {
  it('orders groups by topic.order and keeps tasks in task.order', () => {
    const { groups } = groupTasksByTopic(tasks, topics)
    expect(groups.map((g) => g.topic.id)).toEqual(['tA', 'tB'])
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['l1', 'l2'])
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['l3'])
  })

  it('routes untagged and dangling-topic tasks to ungrouped', () => {
    const { ungrouped } = groupTasksByTopic(tasks, topics)
    expect(ungrouped.map((t) => t.id)).toEqual(['l4', 'l5'])
  })

  it('returns an empty group for a topic with no tasks', () => {
    const { groups } = groupTasksByTopic([], [{ id: 'x', order: 1 }])
    expect(groups).toEqual([{ topic: { id: 'x', order: 1 }, tasks: [] }])
  })

  it('handles empty inputs without throwing', () => {
    expect(groupTasksByTopic()).toEqual({ groups: [], ungrouped: [] })
  })
})

describe('topicStats', () => {
  it('computes total / done / pct', () => {
    expect(topicStats([{ column: 'done' }, { column: 'todo' }, { column: 'done' }])).toEqual({
      total: 3,
      done: 2,
      pct: 67,
    })
  })

  it('is zero-safe for an empty topic', () => {
    expect(topicStats([])).toEqual({ total: 0, done: 0, pct: 0 })
  })
})

describe('pendingTaskIds / isTopicComplete', () => {
  it('lists only not-done ids', () => {
    expect(pendingTaskIds(tasks.filter((t) => t.topicId === 'tA'))).toEqual(['l2'])
  })

  it('isTopicComplete is false when any task is pending and false for empty', () => {
    expect(isTopicComplete([{ column: 'done' }, { column: 'todo' }])).toBe(false)
    expect(isTopicComplete([{ column: 'done' }, { column: 'done' }])).toBe(true)
    expect(isTopicComplete([])).toBe(false)
  })
})
