/**
 * Merges a subject's own Kanban tasks with general todos linked to that
 * subject (`todo.subjectId === subjectId`) into one unified card list, so a
 * subject's board shows everything for it — direct topics AND general
 * to-dos someone tagged to that subject — not just the Kanban-native tasks.
 *
 * Todos don't have the tasks' three-lane `column` ('todo'|'doing'|'done') —
 * a dedicated `subjectColumn` field (written only by this board) gives a
 * merged todo the same lane placement without touching the `done` boolean
 * used everywhere else (calendar, deadlines, the general Todos widget), and
 * without colliding with TodosWidget's own unrelated `column` field (whose
 * values are 'backlog'/'doing' — a different vocabulary for a different
 * board).
 */

/** @param {object} task @returns {object} the task, tagged for the merged board */
export function taskToCard(task) {
  return { ...task, _kind: 'task' }
}

/** @param {object} todo @returns {object} a task-shaped card for a merged todo */
export function todoToCard(todo) {
  return {
    id: todo.id,
    _kind: 'todo',
    title: todo.text || '',
    column: todo.subjectColumn || (todo.done ? 'done' : 'todo'),
    priority: todo.priority || 'medium',
    notes: todo.notes || '',
    dueAt: todo.dueAt || null,
    // Merged todos join a subject's topic groups via their own `subjectTopicId`
    // (kept separate from any Kanban-task topicId), surfaced here as topicId so
    // lib/topics grouping treats tasks and todos uniformly.
    topicId: todo.subjectTopicId || null,
    order: todo.order ?? 0,
  }
}

/**
 * @param {Array} tasks subject's own Kanban tasks
 * @param {Array} todos the user's full todos list (unfiltered)
 * @param {string} subjectId
 * @returns {Array} unified, task-shaped cards — tasks first, then matching todos
 */
export function mergeSubjectCards(tasks = [], todos = [], subjectId) {
  const subjectTodos = (todos || []).filter((t) => t && subjectId && t.subjectId === subjectId)
  return [...(tasks || []).map(taskToCard), ...subjectTodos.map(todoToCard)]
}
