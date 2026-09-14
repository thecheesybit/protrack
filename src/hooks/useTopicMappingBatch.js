import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { hasApiKey, callAIProvider } from '@/services/geminiService'
import { getSubjectsOnce, getTasksOnce, reorderTasks, setMappingNeedsReview } from '@/services/subjectService'
import { getRecentSessionsOnce } from '@/services/focusService'

const LAST_RUN_KEY = 'protrack:topic_mapping:lastRun'
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // hourly check; the lastRun guard makes it act once/day

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function anyProviderConfigured() {
  return ['gemini', 'openai', 'anthropic', 'deepseek'].some((p) => hasApiKey(p))
}

async function reorderSubjectQueue(uid, modeId, subject, recentSessions) {
  const tasks = await getTasksOnce(uid, modeId, subject.id)
  const pending = tasks.filter((t) => t.column !== 'done')

  // Nothing ambiguous to reorder — clear the flag and move on.
  if (pending.length < 2) {
    await setMappingNeedsReview(uid, modeId, subject.id, false)
    return
  }

  const sessionLabels = recentSessions
    .filter((s) => s.subjectId === subject.id)
    .slice(0, 20)
    .map((s) => s.label || s.title || '')
    .filter(Boolean)

  const prompt = [
    'You maintain the study-topic queue order for one subject in a student productivity app.',
    'Recent completed focus-session labels for this subject (most recent first) hint at what was actually studied, in roughly the order classes covered it:',
    JSON.stringify(sessionLabels),
    'Pending topic titles for this subject, in a possibly-wrong order:',
    JSON.stringify(pending.map((t) => ({ id: t.id, title: t.title }))),
    'Reply with ONLY a JSON array of the pending topic ids, reordered to best match the likely class progression. Include every id exactly once, no extra ids, no prose.',
  ].join('\n\n')

  const { text } = await callAIProvider(
    prompt,
    'You reply with only a raw JSON array of ids. No prose, no markdown fences.',
    'auto',
  )

  const match = text?.match(/\[[\s\S]*\]/)
  if (!match) return
  const parsed = JSON.parse(match[0])
  const pendingIds = pending.map((t) => t.id)
  const orderedIds = parsed.filter((id) => pendingIds.includes(id))
  const missingIds = pendingIds.filter((id) => !orderedIds.includes(id))
  const finalOrder = [...orderedIds, ...missingIds]
  if (finalOrder.length !== pendingIds.length) return

  await reorderTasks(uid, modeId, subject.id, finalOrder)
  await setMappingNeedsReview(uid, modeId, subject.id, false)
}

/**
 * Background, once-a-day (while the app happens to be open) AI re-ranking
 * pass for subjects whose deterministic FIFO topic queue has been flagged
 * unreliable (SessionCompleteModal sets `mappingNeedsReview` when the user
 * edits a live suggestion away from the top of the queue). Never runs
 * without a configured AI provider, never blocks the live session-end UX
 * (which stays purely deterministic — see lib/topicMapping.js), and silently
 * no-ops on any failure.
 */
export function useTopicMappingBatch() {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)

  useEffect(() => {
    if (!user?.uid) return undefined
    if (!anyProviderConfigured()) return undefined

    const run = async () => {
      let lastRun = null
      try {
        lastRun = localStorage.getItem(LAST_RUN_KEY)
      } catch { /* localStorage unavailable — just run once this session */ }
      if (lastRun === todayStr()) return

      try {
        const recentSessions = await getRecentSessionsOnce(user.uid, 200)
        for (const mode of modes || []) {
          const subjects = await getSubjectsOnce(user.uid, mode.id)
          const flagged = subjects.filter((s) => s.mappingNeedsReview)
          for (const subject of flagged) {
            try {
              await reorderSubjectQueue(user.uid, mode.id, subject, recentSessions)
            } catch (err) {
              console.error('[topic-mapping-batch] subject reorder failed', subject.id, err)
            }
          }
        }
        try {
          localStorage.setItem(LAST_RUN_KEY, todayStr())
        } catch { /* localStorage unavailable — will simply retry next check */ }
      } catch (err) {
        console.error('[topic-mapping-batch] run failed', err)
      }
    }

    run()
    const id = setInterval(run, CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [user, modes])
}
