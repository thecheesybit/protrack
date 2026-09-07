import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { subscribeToScorecards } from '@/services/scorecardService'

/**
 * Real-time scorecards hook.
 * Supports specific modeId, or aggregates across all modes if modeId === 'all'.
 */
export function useScorecards(modeId, examId = null) {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const [allScorecards, setAllScorecards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !modeId) {
      setAllScorecards([])
      setLoading(false)
      return undefined
    }

    setLoading(true)

    // Global scope: aggregate across all modes
    if (modeId === 'all') {
      if (!modes || modes.length === 0) {
        setAllScorecards([])
        setLoading(false)
        return undefined
      }

      const scorecardsMap = {}
      const loadedModeIds = new Set()

      const unsubs = modes.map((m) =>
        subscribeToScorecards(user.uid, m.id, (list) => {
          scorecardsMap[m.id] = list.map((item) => ({
            ...item,
            _modeName: m.name,
            _modeColor: m.accentColor,
            _modeId: m.id,
          }))

          loadedModeIds.add(m.id)
          const all = Object.values(scorecardsMap)
            .flat()
            .sort((a, b) => {
              const timeA = new Date(a.attemptDate || 0).getTime()
              const timeB = new Date(b.attemptDate || 0).getTime()
              return timeB - timeA
            })

          setAllScorecards(all)
          if (loadedModeIds.size === modes.length) {
            setLoading(false)
          }
        })
      )

      return () => unsubs.forEach((u) => u())
    }

    // Specific mode scope
    const unsub = subscribeToScorecards(user.uid, modeId, (list) => {
      const enriched = list.map((item) => ({
        ...item,
        _modeId: item._modeId || modeId,
        modeId: item.modeId || modeId,
      }))
      setAllScorecards(enriched)
      setLoading(false)
    })
    return unsub
  }, [user, modeId, modes])

  const scorecards = useMemo(() => {
    if (!examId || examId === 'all') return allScorecards
    return allScorecards.filter((s) => s.examId === examId)
  }, [allScorecards, examId])

  const stats = useMemo(() => {
    if (!scorecards.length) {
      return {
        total: 0,
        fltCount: 0,
        sectionalCount: 0,
        avgScore: 0,
        avgAccuracy: 0,
        avgPercentile: 0,
        totalMistakes: 0,
        latest: null,
      }
    }

    const total = scorecards.length
    const fltCount = scorecards.filter((s) => s.type === 'flt').length
    const sectionalCount = scorecards.filter((s) => s.type === 'sectional').length

    const totalScore = scorecards.reduce((acc, s) => acc + (s.score || 0), 0)
    const avgScore = Math.round((totalScore / total) * 10) / 10

    const validAcc = scorecards.filter((s) => s.accuracy != null)
    const avgAccuracy = validAcc.length
      ? Math.round((validAcc.reduce((acc, s) => acc + s.accuracy, 0) / validAcc.length) * 10) / 10
      : 0

    const validPerc = scorecards.filter((s) => s.percentile != null)
    const avgPercentile = validPerc.length
      ? Math.round((validPerc.reduce((acc, s) => acc + s.percentile, 0) / validPerc.length) * 10) / 10
      : 0

    const totalMistakes = scorecards.reduce((acc, s) => acc + (s.mistakes?.length || 0), 0)

    return {
      total,
      fltCount,
      sectionalCount,
      avgScore,
      avgAccuracy,
      avgPercentile,
      totalMistakes,
      latest: scorecards[0] || null,
    }
  }, [scorecards])

  return { scorecards, allScorecards, loading, stats }
}
