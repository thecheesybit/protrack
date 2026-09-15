/**
 * Pure topic-grouping helpers for a subject's Kanban tasks.
 *
 * A "topic" is a lightweight container that bundles a subject's lessons/tasks
 * (e.g. "Lessons 1–5 → Kinematics"). Topics live in a per-subject subcollection
 * (see services/topicService.js) and a task points at one via `task.topicId`.
 * These helpers are deterministic and side-effect free so they can be unit
 * tested and reused by both the grouped board view and progress math.
 */

/**
 * Split a subject's tasks into ordered topic groups plus an "ungrouped" bucket.
 * A task joins a group only when its `topicId` matches an existing topic — a
 * dangling `topicId` (topic since deleted) falls back to ungrouped so nothing
 * is ever hidden.
 *
 * @param {Array<{id:string, topicId?:string|null, order?:number}>} tasks
 * @param {Array<{id:string, order?:number}>} topics
 * @returns {{ groups: Array<{topic:object, tasks:Array}>, ungrouped: Array }}
 */
export function groupTasksByTopic(tasks = [], topics = []) {
  const orderedTopics = [...topics].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const buckets = new Map(orderedTopics.map((t) => [t.id, []]))
  const ungrouped = []

  const orderedTasks = [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  for (const task of orderedTasks) {
    if (task.topicId && buckets.has(task.topicId)) buckets.get(task.topicId).push(task)
    else ungrouped.push(task)
  }

  const groups = orderedTopics.map((topic) => ({ topic, tasks: buckets.get(topic.id) || [] }))
  return { groups, ungrouped }
}

/**
 * Completion stats for a set of tasks (a topic, or the whole board).
 * A task counts as done when its Kanban `column` is `'done'`.
 * @param {Array<{column?:string}>} tasks
 * @returns {{ total:number, done:number, pct:number }}
 */
export function topicStats(tasks = []) {
  const total = tasks.length
  const done = tasks.filter((t) => t.column === 'done').length
  const pct = total ? Math.round((done / total) * 100) : 0
  return { total, done, pct }
}

/** Ids of the tasks in a topic that are not yet done — the set "complete topic" acts on. */
export function pendingTaskIds(tasks = []) {
  return tasks.filter((t) => t.column !== 'done').map((t) => t.id)
}

/** True when every task in a non-empty set is already done. */
export function isTopicComplete(tasks = []) {
  return tasks.length > 0 && tasks.every((t) => t.column === 'done')
}
