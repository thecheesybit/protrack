import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { subscribeToRecentCheckins } from '@/services/checkinService'
import { fetchCheckinQuestion, hasApiKey } from '@/services/geminiService'
import { currentSlot, selectQuestion, shouldPrompt } from '@/lib/checkin'
import { ymd } from '@/lib/dates'

const SNOOZE_KEY = 'protrack:checkin:snoozedUntil'
const AI_QUESTION_KEY = 'protrack:checkin:aiq' // value: JSON { date, text }
const AI_PROVIDERS = ['gemini', 'openai', 'anthropic', 'deepseek']

export const CHECKIN_SNOOZE_MS = 90 * 60 * 1000

/** Dismissing the card snoozes every slot for a while — quiet beats nagging. */
export function snoozeCheckins(ms = CHECKIN_SNOOZE_MS) {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + ms))
  } catch {
    /* private mode — the in-session prompt is cleared by the caller anyway */
  }
}

function snoozedUntil() {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) || 0
  } catch {
    return 0
  }
}

/**
 * The morning question can be AI-personalized: one call per day, cached in
 * localStorage, skipped entirely when no provider key is configured, and any
 * failure falls back to the rule-based bank — the check-in never depends on it.
 */
async function personalizedMorningText(today, checkins, stats) {
  try {
    const cached = JSON.parse(localStorage.getItem(AI_QUESTION_KEY) || 'null')
    if (cached?.date === today) return cached.text || null
  } catch {
    /* corrupt cache — refetch below */
  }
  if (!AI_PROVIDERS.some((p) => hasApiKey(p))) return null

  const yesterdayDoc = checkins.find((c) => c.date !== today) || null
  const evening = yesterdayDoc?.answers?.evening
  const text = await fetchCheckinQuestion({
    streak: stats?.currentStreak ?? 0,
    yesterday: typeof evening?.value === 'number' ? evening.value : null,
  })
  try {
    localStorage.setItem(AI_QUESTION_KEY, JSON.stringify({ date: today, text }))
  } catch {
    /* private mode — worst case we refetch next session */
  }
  return text
}

/**
 * Daily check-in orchestrator. Mounted once in Dashboard. Hydrates the
 * bounded checkins listener into the store and, once a minute, decides
 * whether to offer a question (see lib/checkin.shouldPrompt). Never fires
 * during a focus session — protecting flow beats collecting data.
 */
export function useCheckIns() {
  const { user } = useAuth()
  const setCheckins = useStore((s) => s.setCheckins)
  const sessionStartRef = useRef(Date.now())
  const aiAttemptedRef = useRef(false)

  useEffect(() => {
    if (!user) {
      setCheckins([])
      return undefined
    }
    return subscribeToRecentCheckins(user.uid, setCheckins)
  }, [user, setCheckins])

  useEffect(() => {
    if (!user) return undefined

    const evaluate = async () => {
      const st = useStore.getState()
      // Don't stack a second check-in; it may still queue behind a routine/quote.
      const checkinPending =
        st.activePrompt?.type === 'checkin' ||
        st.promptQueue.some((p) => p.type === 'checkin')
      if (checkinPending) return
      if (st.focusLocked || st.status === 'running') return

      const slot = currentSlot()
      const today = ymd()
      const todayDoc = st.checkins.find((c) => c.date === today) || null
      const ok = shouldPrompt({
        enabled: st.settings?.checkinsEnabled !== false,
        slot,
        todayDoc,
        snoozedUntil: snoozedUntil(),
        now: Date.now(),
        sessionStartedAt: sessionStartRef.current,
      })
      if (!ok) return

      let overrideText = null
      if (slot === 'morning' && !aiAttemptedRef.current) {
        aiAttemptedRef.current = true
        overrideText = await personalizedMorningText(today, st.checkins, st.stats)
      }

      const morningAnswer = todayDoc?.answers?.morning
      const question = selectQuestion(slot, {
        morningIntent: morningAnswer?.type === 'intent' ? morningAnswer.value : null,
        overrideText,
      })
      if (question) {
        st.pushPrompt({
          type: 'checkin',
          payload: { slot, question },
          snoozeMs: CHECKIN_SNOOZE_MS,
        })
      }
    }

    evaluate()
    const id = setInterval(evaluate, 60 * 1000)
    return () => clearInterval(id)
  }, [user])
}
