import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callAIProvider } from '@/services/geminiService'

const scorecardsCol = (uid, modeId) =>
  collection(db, 'users', uid, 'modes', modeId, 'scorecards')

/**
 * Real-time subscription to exam scorecards within a specific mode.
 */
export function subscribeToScorecards(uid, modeId, callback) {
  const q = query(scorecardsCol(uid, modeId), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        _modeId: modeId,
        modeId: d.data().modeId || modeId,
        ...d.data(),
        // Normalize createdAt / attemptDate
        attemptDate: d.data().attemptDate || new Date().toISOString(),
      }))
      // Sort primarily by attemptDate desc, fallback to createdAt
      list.sort((a, b) => {
        const timeA = new Date(a.attemptDate || 0).getTime()
        const timeB = new Date(b.attemptDate || 0).getTime()
        return timeB - timeA
      })
      callback(list)
    },
    (err) => {
      console.warn('[scorecardService] subscription error:', err)
      callback([])
    }
  )
}

/**
 * Add a new scorecard attempt.
 */
export async function addScorecard(uid, modeId, data) {
  const attempt = {
    modeId,
    _modeId: modeId,
    examId: data.examId || null,
    examName: data.examName?.trim() || '',
    title: data.title?.trim() || `${data.sectionName || 'Mock'} Test`,
    type: data.type || 'sectional', // 'sectional' | 'flt'
    sectionName: data.sectionName?.trim() || (data.type === 'flt' ? 'All Sections' : 'General'),
    topicName: data.topicName?.trim() || '',
    serialNo: Number(data.serialNo) || 1,
    attemptDate: data.attemptDate || new Date().toISOString(),
    score: Number(data.score) || 0,
    totalMarks: Number(data.totalMarks) || 0,
    negativeMarks: Number(data.negativeMarks) || 0,
    rank: data.rank != null && data.rank !== '' ? Number(data.rank) : null,
    totalCandidates: data.totalCandidates != null && data.totalCandidates !== '' ? Number(data.totalCandidates) : null,
    percentile: data.percentile != null && data.percentile !== '' ? Number(data.percentile) : null,
    accuracy: data.accuracy != null && data.accuracy !== '' ? Number(data.accuracy) : null,
    timeSpent: data.timeSpent || '00:00:00',
    timeSpentMinutes: Number(data.timeSpentMinutes) || 0,
    correct: Number(data.correct) || 0,
    wrong: Number(data.wrong) || 0,
    unattempted: Number(data.unattempted) || 0,
    totalQuestions: Number(data.totalQuestions) || (Number(data.correct || 0) + Number(data.wrong || 0) + Number(data.unattempted || 0)),
    mistakes: Array.isArray(data.mistakes) ? data.mistakes : [],
    rawText: data.rawText || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  return addDoc(scorecardsCol(uid, modeId), attempt)
}

/**
 * Update an existing scorecard attempt.
 */
export async function updateScorecard(uid, modeId, scorecardId, patch) {
  const ref = doc(scorecardsCol(uid, modeId), scorecardId)
  return updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Delete a scorecard attempt.
 */
export async function deleteScorecard(uid, modeId, scorecardId) {
  const ref = doc(scorecardsCol(uid, modeId), scorecardId)
  return deleteDoc(ref)
}

/**
 * Add a mistake to a scorecard.
 */
export async function addMistakeToScorecard(uid, modeId, scorecard, mistake) {
  const resolvedModeId = modeId || scorecard?._modeId || scorecard?.modeId
  if (!resolvedModeId) {
    throw new Error('modeId is required to log mistake')
  }
  const currentMistakes = Array.isArray(scorecard.mistakes) ? scorecard.mistakes : []
  const newMistake = {
    id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    tag: mistake.tag || 'silly', // 'silly' | 'speed' | 'concept' | 'calculation' | 'misread' | 'formula' | 'guess' | 'custom'
    customTag: mistake.customTag || '',
    topic: mistake.topic?.trim() || '',
    questionNo: mistake.questionNo ? String(mistake.questionNo).trim() : '',
    note: mistake.note?.trim() || mistake.topic?.trim() || (mistake.tag ? `${mistake.tag} error` : 'Mistake logged'),
    createdAt: new Date().toISOString(),
  }
  const updatedMistakes = [...currentMistakes, newMistake]
  return updateScorecard(uid, resolvedModeId, scorecard.id, { mistakes: updatedMistakes })
}

/**
 * Remove a mistake from a scorecard.
 */
export async function removeMistakeFromScorecard(uid, modeId, scorecard, mistakeId) {
  const resolvedModeId = modeId || scorecard?._modeId || scorecard?.modeId
  if (!resolvedModeId) {
    throw new Error('modeId is required to remove mistake')
  }
  const currentMistakes = Array.isArray(scorecard.mistakes) ? scorecard.mistakes : []
  const updatedMistakes = currentMistakes.filter((m) => m.id !== mistakeId)
  return updateScorecard(uid, resolvedModeId, scorecard.id, { mistakes: updatedMistakes })
}

/**
 * Generate AI Expert Analysis & Performance Coaching via Gemini.
 */
export async function generateGeminiExpertAnalysis(scorecards, activeScopeName = 'All Exams') {
  if (!scorecards || scorecards.length === 0) {
    throw new Error('No exam attempts recorded yet. Add a scorecard first to generate analysis.')
  }

  // Aggregate metrics
  const total = scorecards.length
  const fltCount = scorecards.filter((s) => s.type === 'flt').length
  const secCount = scorecards.filter((s) => s.type === 'sectional').length

  const avgScore = (scorecards.reduce((acc, s) => acc + (s.score || 0), 0) / total).toFixed(2)
  const avgAccuracy = (scorecards.reduce((acc, s) => acc + (s.accuracy || 0), 0) / total).toFixed(1)
  const validPercentiles = scorecards.filter((s) => s.percentile != null)
  const avgPercentile = validPercentiles.length
    ? (validPercentiles.reduce((acc, s) => acc + s.percentile, 0) / validPercentiles.length).toFixed(1)
    : 'N/A'

  // Mistakes aggregation
  const allMistakes = scorecards.flatMap((s) => s.mistakes || [])
  const mistakeCounts = allMistakes.reduce((acc, m) => {
    const t = m.tag || 'other'
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  const recentAttemptsSummary = scorecards.slice(0, 8).map((s) => ({
    title: s.title,
    type: s.type,
    section: s.sectionName,
    score: `${s.score}/${s.totalMarks}`,
    percentile: s.percentile ? `${s.percentile}%` : 'N/A',
    accuracy: `${s.accuracy || 0}%`,
    timeSpent: s.timeSpent,
    correct: s.correct,
    wrong: s.wrong,
    unattempted: s.unattempted,
    negativeMarks: s.negativeMarks,
    mistakeNotes: (s.mistakes || []).map((m) => `[${m.tag}${m.topic ? ` - ${m.topic}` : ''}] ${m.note}`),
  }))

  const systemInstruction = `You are a world-class competitive exam coach and test-taking strategist (specializing in Banking, SSC, CAT, GATE, and standard competitive tests).
Analyze the candidate's scorecard trajectory, accuracy patterns, speed vs unattempted ratios, negative mark leaks, and logged mistakes.
Provide an executive, highly motivating, sharp and actionable coaching report in markdown.

Structure your report into these crisp sections:
1. 🎯 **Executive Diagnosis**: What the numbers reveal about the student's current stage (e.g. accuracy vs speed dilemma, risk appetite, percentile bottleneck).
2. ⚠️ **Critical Leakages & Error Patterns**: Breakdown of mistakes (silly slips vs speed pressure vs conceptual gaps) and how many marks they are bleeding.
3. ⏱️ **Time & Sectional Management**: Analysis of time spent vs unattempted questions and pacing strategy.
4. 🚀 **Next 3 Mocks Action Plan**: 3 concrete, non-generic rules for the candidate to enforce on their very next test attempt.

Be direct, encouraging, analytical, and highly practical.`

  const prompt = `Student Scope: ${activeScopeName}
Total Tests: ${total} (${fltCount} FLTs, ${secCount} Sectionals)
Average Score: ${avgScore}
Average Accuracy: ${avgAccuracy}%
Average Percentile: ${avgPercentile}%
Total Mistakes Logged: ${allMistakes.length}
Mistake Tag Distribution: ${JSON.stringify(mistakeCounts)}

Recent Mock Attempts Data:
${JSON.stringify(recentAttemptsSummary, null, 2)}
`

  const preferred = typeof localStorage !== 'undefined' ? localStorage.getItem('protrack:ai_preferred_provider') || 'auto' : 'auto'
  const res = await callAIProvider(prompt, systemInstruction, preferred)
  return res.text
}
