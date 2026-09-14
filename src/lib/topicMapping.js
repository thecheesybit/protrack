/**
 * Pure session -> topic mapping.
 *
 * Deterministic and instant — no AI call on the live path. If the session
 * already carries an explicit `todoId` (the user manually linked it, e.g. from
 * TodosWidget), that link IS the suggestion. Otherwise, for a subject-linked
 * session, the suggestion is simply the lowest-`order` not-done task in that
 * subject's To-Do column — a FIFO queue, so as class session N gets
 * confirmed-done, session N+1 naturally suggests topic N+1.
 *
 * The "smarter" pass (semantic re-ranking of a subject's queue via an AI batch
 * job, only run when a subject has been flagged as unreliable) lives in
 * useTopicMappingBatch.js and only ever reorders the same `order` field this
 * module reads — this file never talks to any AI provider itself.
 */

/**
 * @param {{ subjectId?: string|null, todoId?: string|null }} session
 * @param {{ tasks?: Array, todos?: Array }} data
 * @returns {{ kind: 'task'|'todo', id: string, title: string|null, subjectId?: string|null } | null}
 */
export function suggestSessionTopic(session, { tasks = [], todos = [] } = {}) {
  const { subjectId, todoId } = session || {}

  if (todoId) {
    const todo = todos.find((t) => t.id === todoId)
    return { kind: 'todo', id: todoId, title: todo?.text ?? null, subjectId: todo?.subjectId ?? null }
  }

  if (subjectId) {
    const pending = tasks
      .filter((t) => t.column !== 'done')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    if (pending.length > 0) {
      const top = pending[0]
      return { kind: 'task', id: top.id, title: top.title ?? null, subjectId }
    }
  }

  return null
}

/**
 * Alternatives for the "Edit" picker at session-end: the rest of the subject's
 * pending topics plus general (not-done) todos, so the user can redirect the
 * mapping to whatever they actually worked on.
 * @returns {Array<{ kind: 'task'|'todo', id: string, title: string|null, subjectId?: string|null }>}
 */
export function listTopicCandidates({ subjectId } = {}, { tasks = [], todos = [] } = {}) {
  const taskCandidates = subjectId
    ? tasks
        .filter((t) => t.column !== 'done')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((t) => ({ kind: 'task', id: t.id, title: t.title ?? null, subjectId }))
    : []
  const todoCandidates = todos
    .filter((t) => !t.done)
    .map((t) => ({ kind: 'todo', id: t.id, title: t.text ?? null, subjectId: t.subjectId ?? null }))
  return [...taskCandidates, ...todoCandidates]
}

/** True when the user's edit picked something other than the deterministic top suggestion. */
export function isMappingOverride(suggestion, chosen) {
  if (!suggestion || !chosen) return false
  return suggestion.kind !== chosen.kind || suggestion.id !== chosen.id
}
