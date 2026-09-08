import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubjects } from '@/hooks/useSubjects'
import { subscribeToTasks } from '@/services/subjectService'

/**
 * Every Kanban task in the active mode's subjects that carries a `dueAt`
 * (a day / time), flattened and tagged with its subject. Tasks with no date
 * stay put in their subject board — only dated ones flow to the timetable /
 * calendar views (owner: "when I add day, time slot… it should appear on the
 * timeline").
 *
 * Bounded: one listener per subject (same fan-out shape `useSubjects` already
 * uses), re-armed only when the set of subject ids changes, torn down on mode
 * switch. Undated tasks are filtered out client-side so the payload stays small.
 */
export function useModeTasksWithDates(modeId) {
  const { user } = useAuth()
  const { subjects } = useSubjects(modeId)
  const [byId, setById] = useState({})

  // Stable dependency: the ordered list of (mode,subject) pairs to subscribe to.
  const targets = useMemo(
    () =>
      (subjects || [])
        .filter((s) => s && s.id)
        .map((s) => ({ subjectId: s.id, modeId: s._modeId || modeId, name: s.name, color: s.color })),
    [subjects, modeId],
  )
  const targetsKey = targets.map((t) => `${t.modeId}/${t.subjectId}`).join(',')

  useEffect(() => {
    if (!user || !modeId || targets.length === 0) {
      setById({})
      return undefined
    }
    setById({})
    const unsubs = targets.map((t) =>
      subscribeToTasks(user.uid, t.modeId, t.subjectId, (list) => {
        const dated = (list || [])
          .filter((task) => task.dueAt && task.column !== 'done' && !task.done)
          .map((task) => ({
            ...task,
            subjectId: t.subjectId,
            subjectName: t.name,
            color: task.color || t.color,
            _modeId: t.modeId,
          }))
        setById((prev) => ({ ...prev, [`${t.modeId}/${t.subjectId}`]: dated }))
      }),
    )
    return () => unsubs.forEach((u) => typeof u === 'function' && u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, modeId, targetsKey])

  return useMemo(() => Object.values(byId).flat(), [byId])
}
