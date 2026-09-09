import { callAIProvider } from '@/services/geminiService'

/**
 * Converts a time string (e.g. '00:25:00', '25:00', '25m', '25 mins', '1h 20m') into minutes.
 */
export function timeStringToMinutes(timeStr) {
  if (!timeStr) return 0
  if (typeof timeStr === 'number') return timeStr
  const s = String(timeStr).trim()

  // Format: HH:MM:SS or MM:SS
  if (s.includes(':')) {
    const parts = s.split(':').map((p) => parseFloat(p) || 0)
    if (parts.length === 3) {
      return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60)
    } else if (parts.length === 2) {
      return Math.round(parts[0] + parts[1] / 60)
    }
  }

  // Format: '25m', '25 mins', '1h 20m'
  const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hours?)/i)
  const minMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins?|minutes?)/i)
  let total = 0
  if (hourMatch) total += parseFloat(hourMatch[1]) * 60
  if (minMatch) total += parseFloat(minMatch[1])
  if (total > 0) return Math.round(total)

  const numOnly = parseFloat(s)
  return isNaN(numOnly) ? 0 : Math.round(numOnly)
}

// Canonical section names — keeps SmartKeeda's "Reasoning Aptitude" and
// Oliveboard's "Reasoning Ability" landing on the same bucket.
const SECTION_CANON = [
  { name: 'Reasoning', re: /reasoning|logical|general intelligence|analytical/i },
  { name: 'Quantitative Aptitude', re: /quant|numerical ability|numerical aptitude|\bmaths?\b|mathematic|data interpretation|\bdi\b/i },
  { name: 'English Language', re: /english|verbal ability|reading comprehension/i },
  { name: 'General Awareness', re: /general awareness|current affairs|banking awareness|financial awareness|general knowledge|\bga\b|\bgk\b/i },
  { name: 'Computer Aptitude', re: /computer/i },
  { name: 'General Studies', re: /general studies|\bgs\b|\bcsat\b/i },
]

/** Map a raw section label onto a canonical name (falls back to the trimmed input). */
export function canonicalSectionName(raw) {
  const s = String(raw || '').trim()
  for (const item of SECTION_CANON) if (item.re.test(s)) return item.name
  return s
}

export function detectPortal(text) {
  if (!text || typeof text !== 'string') return 'generic'
  const t = text.toLowerCase()
  if (t.includes('smartkeeda') || t.includes('testzone') || /your marks\s*:/i.test(text) || /cut[\s-]*off marks/i.test(text)) {
    return 'smartkeeda'
  }
  if (t.includes('adda247') || t.includes('careerpower') || /adda\s*247/i.test(text) || /general intelligence & reasoning/i.test(text) || (/marks scored/i.test(text) && /maximum score/i.test(text))) {
    return 'adda247'
  }
  if (t.includes('guidely') || t.includes('ibpsguide') || (/section details/i.test(text) && /\|\s*(?:score|marks|correct)/i.test(text))) {
    return 'guidely'
  }
  if (t.includes('oliveboard') || t.includes('olive board') || (/all india rank/i.test(text) && /sectional summary/i.test(text))) {
    return 'oliveboard'
  }
  if (SMARTKEEDA_ROW_RE.test(text)) {
    SMARTKEEDA_ROW_RE.lastIndex = 0
    return 'smartkeeda'
  }
  if (ADDA_ROW_RE.test(text)) {
    ADDA_ROW_RE.lastIndex = 0
    return 'adda247'
  }
  if (GUIDELY_ROW_RE.test(text)) {
    GUIDELY_ROW_RE.lastIndex = 0
    return 'guidely'
  }
  if (OLIVEBOARD_ROW_RE.test(text)) {
    OLIVEBOARD_ROW_RE.lastIndex = 0
    return 'oliveboard'
  }
  return 'generic'
}

const OVERALL_ROW_RE = /^(overall|total|grand total|aggregate|overall performance)$/i

// ── SmartKeeda "Test Analysis" Row Format ─────────────────────────────────────
const SMARTKEEDA_ROW_RE =
  /([A-Za-z][A-Za-z0-9 .&/'()-]*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s*(?:mins?|minutes?|m)\b\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\/\s*(\d+)\s*\(?\s*(\d+(?:\.\d+)?)\s*%?\s*\)?\s+(-?\d+(?:\.\d+)?)/gi

// ── Adda247 Section Table Format ──────────────────────────────────────────────
// Section | Total Ques | Attempted | Correct | Incorrect | Marks | Time | Accuracy
const ADDA_ROW_RE =
  /([A-Za-z][A-Za-z0-9 .&/'()-]*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([+-]?\d+(?:\.\d+)?)\s+(\d{1,2}:\d{2}(?::\d{2})?|\d+(?:\.\d+)?\s*(?:mins?|m)?)\s+(\d+(?:\.\d+)?)\s*%/gi

// ── Guidely Pipe-Delimited Section Format ─────────────────────────────────────
// Section: Correct: x | Wrong: y | Attempted: a | Score: s/total | Accuracy: acc% | Time: t
const GUIDELY_ROW_RE =
  /([A-Za-z][A-Za-z0-9 .&/'()-]*?)\s*:\s*(?:Correct\s*:\s*(\d+))?[^|\n]*\|\s*(?:Wrong|Incorrect)\s*:\s*(\d+)[^|\n]*(?:\|\s*(?:Attempted|Attempts)\s*:\s*(\d+))?[^|\n]*\|\s*(?:Score|Marks)\s*:\s*([+-]?\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?[^|\n]*(?:\|\s*Accuracy\s*:\s*(\d+(?:\.\d+)?)\s*%)?[^|\n]*(?:\|\s*Time\s*:\s*(\d{1,2}:\d{2}(?::\d{2})?|\d+(?:\.\d+)?\s*(?:mins?|m)?))?/gi

// ── Oliveboard Section Row Format ─────────────────────────────────────────────
// Section | Score/Total | Rank/Total | Percentile% | Accuracy% | Time
const OLIVEBOARD_ROW_RE =
  /([A-Za-z][A-Za-z0-9 .&/'()-]*?)\s+([+-]?\d+(?:\.\d+)?)\s*\/\s*(\d+)\s+(\d+)\s*\/\s*(\d+)\s+(\d+(?:\.\d+)?)\s*%\s+(\d+(?:\.\d+)?)\s*%\s+(\d{1,2}:\d{2}(?::\d{2})?|\d+(?:\.\d+)?\s*(?:mins?|m)?)/gi

function roundTo(n, dp = 1) {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

/**
 * Parse a tabular per-section breakdown across Smartkeeda, Adda247, Guidely, and Oliveboard.
 *
 * @param {string} text
 * @returns {{ sections: object[], overall: object|null } | null}
 */
export function parseSectionTable(text) {
  if (!text) return null
  let rows = []

  // 1. Try SmartKeeda pattern
  SMARTKEEDA_ROW_RE.lastIndex = 0
  let m
  while ((m = SMARTKEEDA_ROW_RE.exec(text)) !== null) {
    const [, rawName, nQ, correct, wrong, unatt, timeVal, cutoff, score, scoreTotal, scorePct, percentile] = m
    const c = parseInt(correct, 10)
    const w = parseInt(wrong, 10)
    const u = parseInt(unatt, 10)
    const attempted = c + w
    rows.push({
      name: rawName.trim(),
      canonicalName: canonicalSectionName(rawName),
      totalQuestions: parseInt(nQ, 10),
      correct: c,
      wrong: w,
      unattempted: u,
      timeSpentMinutes: Math.round(parseFloat(timeVal)),
      cutoff: parseFloat(cutoff),
      score: parseFloat(score),
      totalMarks: parseInt(scoreTotal, 10),
      scorePct: parseFloat(scorePct),
      accuracy: attempted ? roundTo((c / attempted) * 100, 1) : 0,
      percentile: parseFloat(percentile),
    })
  }

  // 2. Try Adda247 pattern if SmartKeeda returned no rows
  if (rows.length === 0) {
    ADDA_ROW_RE.lastIndex = 0
    while ((m = ADDA_ROW_RE.exec(text)) !== null) {
      const [, rawName, nQ, attempted, correct, wrong, marks, timeStr, accuracy] = m
      const c = parseInt(correct, 10)
      const w = parseInt(wrong, 10)
      const totalQ = parseInt(nQ, 10)
      const u = Math.max(0, totalQ - c - w)
      const sNum = parseFloat(marks)
      const totalMarks = sNum > totalQ ? totalQ * 2 : totalQ
      rows.push({
        name: rawName.trim(),
        canonicalName: canonicalSectionName(rawName),
        totalQuestions: totalQ,
        correct: c,
        wrong: w,
        unattempted: u,
        timeSpentMinutes: timeStringToMinutes(timeStr),
        cutoff: null,
        score: sNum,
        totalMarks,
        scorePct: totalMarks ? roundTo((sNum / totalMarks) * 100, 1) : null,
        accuracy: parseFloat(accuracy),
        percentile: null,
      })
    }
  }

  // 3. Try Guidely pipe pattern if still empty
  if (rows.length === 0) {
    GUIDELY_ROW_RE.lastIndex = 0
    while ((m = GUIDELY_ROW_RE.exec(text)) !== null) {
      const [, rawName, correct, wrong, attempted, score, totalMarks, accuracy, timeStr] = m
      const c = correct ? parseInt(correct, 10) : 0
      const w = wrong ? parseInt(wrong, 10) : 0
      const att = attempted ? parseInt(attempted, 10) : c + w
      const s = parseFloat(score)
      const tm = totalMarks ? parseInt(totalMarks, 10) : null
      rows.push({
        name: rawName.trim(),
        canonicalName: canonicalSectionName(rawName),
        totalQuestions: tm || att,
        correct: c,
        wrong: w,
        unattempted: tm ? Math.max(0, tm - att) : 0,
        timeSpentMinutes: timeStringToMinutes(timeStr),
        cutoff: null,
        score: s,
        totalMarks: tm || att,
        scorePct: tm ? roundTo((s / tm) * 100, 1) : null,
        accuracy: accuracy ? parseFloat(accuracy) : att ? roundTo((c / att) * 100, 1) : 0,
        percentile: null,
      })
    }
  }

  // 4. Try Oliveboard pattern if still empty
  if (rows.length === 0) {
    OLIVEBOARD_ROW_RE.lastIndex = 0
    while ((m = OLIVEBOARD_ROW_RE.exec(text)) !== null) {
      const [, rawName, score, totalMarks, rank, totalCandidates, percentile, accuracy, timeStr] = m
      rows.push({
        name: rawName.trim(),
        canonicalName: canonicalSectionName(rawName),
        totalQuestions: parseInt(totalMarks, 10),
        correct: null,
        wrong: null,
        unattempted: null,
        timeSpentMinutes: timeStringToMinutes(timeStr),
        cutoff: null,
        score: parseFloat(score),
        totalMarks: parseInt(totalMarks, 10),
        scorePct: roundTo((parseFloat(score) / parseInt(totalMarks, 10)) * 100, 1),
        accuracy: parseFloat(accuracy),
        percentile: parseFloat(percentile),
      })
    }
  }

  if (rows.length === 0) return null

  const overall = rows.find((r) => OVERALL_ROW_RE.test(r.name)) || null
  const sections = rows.filter((r) => r !== overall)
  return { sections, overall }
}

/**
 * Parses raw text copied from mock exam portals (SmartKeeda, Adda247, Guidely,
 * Oliveboard, Testbook, PracticeMock, etc.) using fast regex and heuristics.
 *
 * @param {string} rawText
 * @returns {object} Extracted scorecard fields
 */
export function parseRawExamSummary(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {}
  }

  const text = rawText.replace(/\r\n/g, '\n')
  const detectedPortal = detectPortal(text)
  const result = {
    score: null,
    totalMarks: null,
    negativeMarks: null,
    cutoff: null,
    rank: null,
    totalCandidates: null,
    percentile: null,
    accuracy: null,
    timeSpent: '',
    timeSpentMinutes: 0,
    correct: null,
    wrong: null,
    unattempted: null,
    totalQuestions: null,
    sectionName: '',
    sections: [],
    examName: '',
    type: 'sectional', // default to sectional
    detectedPortal,
  }

  // ── 1. Section Name & Exam Type ──────────────────────────────────
  // Pattern A: "Section: Reasoning" or "Subject: English" or "Section - Quant"
  const secColonMatch = text.match(
    /(?:Section|Subject|Section Name|Test Section)\s*[:=-]?\s*([A-Za-z0-9\s&/()+-]+?)(?:\s*\n|$)/i
  )

  // Pattern B: "Sectional Summary \n Reasoning"
  const secSummaryMatch = text.match(
    /Sectional Summary\s*\n\s*([A-Za-z0-9\s&/()+-]+?)(?:\s*\n|$)/i
  )

  if (secColonMatch && secColonMatch[1].trim() && !/Summary|Overview|Performance/i.test(secColonMatch[1])) {
    result.sectionName = canonicalSectionName(secColonMatch[1])
    result.type = 'sectional'
  } else if (secSummaryMatch && secSummaryMatch[1].trim() && !/Summary|Overview|Performance/i.test(secSummaryMatch[1])) {
    result.sectionName = canonicalSectionName(secSummaryMatch[1])
    result.type = 'sectional'
  } else {
    // Check for common competitive exam section names in text
    const knownSections = [
      { name: 'Reasoning', patterns: [/\bReasoning Ability\b/i, /\bLogical Reasoning\b/i, /\bGeneral Intelligence\b/i, /\bReasoning\b/i] },
      { name: 'Quantitative Aptitude', patterns: [/\bQuantitative Aptitude\b/i, /\bNumerical Ability\b/i, /\bMathematics\b/i, /\bMaths\b/i, /\bQuant\b/i, /\bData Interpretation\b/i] },
      { name: 'English Language', patterns: [/\bEnglish Language\b/i, /\bVerbal Ability\b/i, /\bGeneral English\b/i, /\bEnglish\b/i] },
      { name: 'General Awareness', patterns: [/\bGeneral Awareness\b/i, /\bCurrent Affairs\b/i, /\bBanking Awareness\b/i, /\bGeneral Knowledge\b/i, /\bGA\b/, /\bGK\b/] },
      { name: 'Computer Aptitude', patterns: [/\bComputer Aptitude\b/i, /\bComputer Knowledge\b/i, /\bComputers\b/i] },
      { name: 'General Studies', patterns: [/\bGeneral Studies\b/i, /\bGS\b/, /\bCSAT\b/] },
    ]

    for (const item of knownSections) {
      if (item.patterns.some((p) => p.test(text))) {
        result.sectionName = item.name
        result.type = 'sectional'
        break
      }
    }
  }

  // Check if it's explicitly FLT (Full Length Test) - only if no specific section found or says Full Length
  if (/full[- ]?length test|\bFLT\b|complete mock|all sections/i.test(text) && !result.sectionName) {
    result.type = 'flt'
    result.sectionName = 'All Sections'
  } else if (!result.sectionName) {
    result.type = 'sectional'
  }

  // Detect exam name if present (e.g. RRB PO, IBPS PO, SBI Clerk, SSC CGL)
  const examNameMatch = text.match(
    /(?:RRB\s*(?:PO|Clerk|Officer)?|IBPS\s*(?:PO|Clerk|SO)?|SBI\s*(?:PO|Clerk)?|RBI\s*(?:Grade B|Assistant)?|SSC\s*(?:CGL|CHSL|MTS|CPO)?|CAT|GATE|UPSC)/i
  )
  if (examNameMatch) {
    result.examName = examNameMatch[0].trim()
  }

  // ── 2. Score & Total Marks ───────────────────────────────────────
  // Pattern A: "16.25 \n | 40 \n Your Score" or "16.25 | 40 Your Score"
  const scoreSlashMatch = text.match(
    /([+-]?\d+(?:\.\d+)?)\s*(?:\n\s*)?\|\s*(\d+(?:\.\d+)?)\s*(?:\n\s*)?(?:Your Score|Score|Marks)/i
  )
  // Pattern B: "Your Score: 16.25 / 40" or "Score: 16.25/40" or "Marks: 16.25 / 40"
  const scoreColonMatch = text.match(
    /(?:Your Score|Score|Total Marks Scored|Marks Scored|Marks|Scored)[ \t]*[:=-]?[ \t]*([+-]?\d+(?:\.\d+)?)(?:[ \t]*(?:\/|out of|\|)[ \t]*(\d+(?:\.\d+)?))?/i
  )
  // Pattern C: "Score \n 16.25"
  const scoreWordAboveMatch = text.match(
    /(?:Your Score|Score|Marks)\s*\n\s*([+-]?\d+(?:\.\d+)?)(?:\s*(?:\/|\|)\s*(\d+(?:\.\d+)?))?/i
  )

  if (scoreSlashMatch) {
    result.score = parseFloat(scoreSlashMatch[1])
    result.totalMarks = parseFloat(scoreSlashMatch[2])
  } else if (scoreColonMatch) {
    result.score = parseFloat(scoreColonMatch[1])
    if (scoreColonMatch[2]) result.totalMarks = parseFloat(scoreColonMatch[2])
  } else if (scoreWordAboveMatch) {
    result.score = parseFloat(scoreWordAboveMatch[1])
    if (scoreWordAboveMatch[2]) result.totalMarks = parseFloat(scoreWordAboveMatch[2])
  }

  // Also check explicit "Total Marks: 40" or "Max Marks: 40" or "Maximum Score: 35"
  if (result.totalMarks === null) {
    const maxMarksMatch = text.match(/(?:Total Marks|Max Marks|Maximum Marks|Maximum Score|Max Score|Total Score)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i)
    if (maxMarksMatch) result.totalMarks = parseFloat(maxMarksMatch[1])
  }

  // ── 3. Negative Marks ────────────────────────────────────────────
  const negMatch = text.match(/(?:Negative Marks?|Penalty|Negative)[ \t]*[:=-]?[ \t]*([+-]?\d+(?:\.\d+)?)/i)
  if (negMatch) {
    result.negativeMarks = Math.abs(parseFloat(negMatch[1]))
  }

  // ── 4. Rank & Total Candidates ───────────────────────────────────
  // Pattern A: "13320 \n | 17508 \n Your Rank"
  const rankPipeMatch = text.match(
    /(\d+)\s*(?:\n\s*)?\|\s*(\d+)\s*(?:\n\s*)?(?:Your Rank|Rank)/i
  )
  // Pattern B: "Rank: 13320 / 17508" or "All India Rank: 13320" or "Rank 450 of 12400"
  const rankColonMatch = text.match(
    /(?:Your Rank|All India Rank|AIR|Rank)[ \t]*[:=-]?[ \t]*(\d+)(?:[ \t]*(?:\/|out of|of|\|)[ \t]*(\d+))?/i
  )

  if (rankPipeMatch) {
    result.rank = parseInt(rankPipeMatch[1], 10)
    result.totalCandidates = parseInt(rankPipeMatch[2], 10)
  } else if (rankColonMatch) {
    result.rank = parseInt(rankColonMatch[1], 10)
    if (rankColonMatch[2]) result.totalCandidates = parseInt(rankColonMatch[2], 10)
  }

  if (result.totalCandidates === null) {
    const totalCandMatch = text.match(/(?:Total Candidates|Total Students|Appeared)\s*[:=-]?\s*(\d+)/i)
    if (totalCandMatch) result.totalCandidates = parseInt(totalCandMatch[1], 10)
  }

  // ── 5. Percentile ────────────────────────────────────────────────
  // Pattern A: "Percentile: 23.90%"
  const percColonMatch = text.match(
    /(?:Your Percentile|Percentile)[ \t]*[:=-]?[ \t]*(\d+(?:\.\d+)?)[ \t]*%?/i
  )
  // Pattern B: "23.90 \n | 100 \n Percentile"
  const percPipeMatch = text.match(
    /^[ \t]*(\d+(?:\.\d+)?)\s*(?:\n\s*\|\s*100)?\s*\n\s*(?:Your Percentile|Percentile)/im
  )
  // Pattern C: "23.90%tile"
  const percTileMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*tile/i)

  if (percColonMatch) {
    result.percentile = parseFloat(percColonMatch[1])
  } else if (percPipeMatch) {
    result.percentile = parseFloat(percPipeMatch[1])
  } else if (percTileMatch) {
    result.percentile = parseFloat(percTileMatch[1])
  }

  // ── 6. Accuracy ──────────────────────────────────────────────────
  // Pattern A: "Accuracy: 85.00%"
  const accColonMatch = text.match(
    /(?:Your Accuracy|Accuracy)[ \t]*[:=-]?[ \t]*(\d+(?:\.\d+)?)[ \t]*%?/i
  )
  // Pattern B: "85.00 \n | 100 \n Accuracy"
  const accPipeMatch = text.match(
    /^[ \t]*(\d+(?:\.\d+)?)\s*(?:\n\s*\|\s*100)?\s*\n\s*(?:Your Accuracy|Accuracy)/im
  )

  if (accColonMatch) {
    result.accuracy = parseFloat(accColonMatch[1])
  } else if (accPipeMatch) {
    result.accuracy = parseFloat(accPipeMatch[1])
  }

  // ── 7. Time Spent ────────────────────────────────────────────────
  // Pattern A: "00:25:00 \n | 00:25:00 \n Time Spent"
  const timePipeMatch = text.match(
    /(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:\n\s*\|\s*\d{1,2}:\d{2}(?::\d{2})?)?\s*\n\s*Time(?: Spent)?/i
  )
  // Pattern B: "Time Spent: 00:25:00" or "Time: 25 mins"
  const timeColonMatch = text.match(
    /Time(?: Spent| Taken)?[ \t]*[:=-]?[ \t]*(\d{1,2}:\d{2}(?::\d{2})?|\d+(?:\.\d+)?[ \t]*(?:mins?|minutes|m|hours?|h))/i
  )

  if (timePipeMatch) {
    result.timeSpent = timePipeMatch[1]
    result.timeSpentMinutes = timeStringToMinutes(result.timeSpent)
  } else if (timeColonMatch) {
    result.timeSpent = timeColonMatch[1]
    result.timeSpentMinutes = timeStringToMinutes(result.timeSpent)
  }

  // ── 8. Question Distribution (Correct / Wrong / Unattempted) ──────
  // Pattern A: Same line Word before number ("Correct: 17", "Wrong: 3", "Unattempted: 20")
  const correctWordBefore = text.match(/(?:Correct|Right|Correct Questions?)[ \t]*[:=-]?[ \t]*(\d+)/i)
  const wrongWordBefore = text.match(/(?:Wrong|Incorrect|Wrong Questions?|Incorrect Questions?)[ \t]*[:=-]?[ \t]*(\d+)/i)
  const unattemptedWordBefore = text.match(/(?:Unattempted|Skipped|Left|Not Attempted)[ \t]*[:=-]?[ \t]*(\d+)/i)

  // Pattern B: Line with number preceding word ("17 \n Correct", "3 \n Wrong", "20 \n Unattempted")
  const correctNumBefore = text.match(/^[ \t]*(\d+)[ \t]*\n[ \t]*(?:Correct|Right)/im)
  const wrongNumBefore = text.match(/^[ \t]*(\d+)[ \t]*\n[ \t]*(?:Wrong|Incorrect)/im)
  const unattemptedNumBefore = text.match(/^[ \t]*(\d+)[ \t]*\n[ \t]*(?:Unattempted|Skipped|Left|Not Attempted)/im)

  // Pattern C: Comma or inline listing ("17 correct, 3 wrong, 20 skipped")
  const inlineListMatch = text.match(
    /(\d+)\s*(?:correct|right)[,\s]+(\d+)\s*(?:wrong|incorrect)[,\s]+(\d+)\s*(?:unattempted|skipped|left)/i
  )

  if (correctWordBefore) result.correct = parseInt(correctWordBefore[1], 10)
  else if (correctNumBefore) result.correct = parseInt(correctNumBefore[1], 10)
  else if (inlineListMatch) result.correct = parseInt(inlineListMatch[1], 10)

  if (wrongWordBefore) result.wrong = parseInt(wrongWordBefore[1], 10)
  else if (wrongNumBefore) result.wrong = parseInt(wrongNumBefore[1], 10)
  else if (inlineListMatch) result.wrong = parseInt(inlineListMatch[2], 10)

  if (unattemptedWordBefore) result.unattempted = parseInt(unattemptedWordBefore[1], 10)
  else if (unattemptedNumBefore) result.unattempted = parseInt(unattemptedNumBefore[1], 10)
  else if (inlineListMatch) result.unattempted = parseInt(inlineListMatch[3], 10)

  // Parse explicit total questions if present
  const totalQMatch = text.match(/(?:Total\s*Questions?|No\.?\s*of\s*Questions?|Total\s*Ques)\s*[:=-]?\s*(\d+)/i)
  if (totalQMatch) {
    result.totalQuestions = parseInt(totalQMatch[1], 10)
  } else if (result.totalQuestions === null && result.correct !== null && result.wrong !== null && result.unattempted !== null) {
    result.totalQuestions = result.correct + result.wrong + result.unattempted
  }

  // ── 9. Tabular per-section breakdown (SmartKeeda "Test Analysis", Adda247 …) ──
  // A multi-row section table with an aggregate row makes this unambiguously a
  // full-length test: capture every section and drive the top-level fields from
  // the "Overall" row (falling back to the section sum).
  const table = parseSectionTable(text)
  if (table && table.sections.length >= 2) {
    result.sections = table.sections
    result.type = 'flt'
    result.sectionName = 'All Sections'

    const sum = (key) => table.sections.reduce((acc, s) => acc + (Number(s[key]) || 0), 0)
    if (table.overall) {
      if (table.overall.score != null) result.score = table.overall.score
      if (table.overall.totalMarks != null) result.totalMarks = table.overall.totalMarks
      if (table.overall.correct != null) result.correct = table.overall.correct
      if (table.overall.wrong != null) result.wrong = table.overall.wrong
      if (table.overall.unattempted != null) result.unattempted = table.overall.unattempted
      if (table.overall.totalQuestions != null) result.totalQuestions = table.overall.totalQuestions
      if (table.overall.cutoff != null && !Number.isNaN(table.overall.cutoff)) result.cutoff = table.overall.cutoff
      if (table.overall.percentile != null && !Number.isNaN(table.overall.percentile) && result.percentile == null) {
        result.percentile = table.overall.percentile
      }
      if (table.overall.timeSpentMinutes && !result.timeSpentMinutes) {
        result.timeSpentMinutes = table.overall.timeSpentMinutes
      }
      if (table.overall.accuracy != null && result.accuracy == null) {
        result.accuracy = table.overall.accuracy
      }
    } else {
      if (result.score == null) result.score = sum('score')
      if (result.totalMarks == null) result.totalMarks = sum('totalMarks')
      if (result.correct == null) {
        const sCorrect = sum('correct')
        if (sCorrect > 0) result.correct = sCorrect
      }
      if (result.wrong == null) {
        const sWrong = sum('wrong')
        if (sWrong > 0) result.wrong = sWrong
      }
      if (result.unattempted == null) {
        const sUnatt = sum('unattempted')
        if (sUnatt > 0) result.unattempted = sUnatt
      }
      if (result.totalQuestions == null) {
        const sTotalQ = sum('totalQuestions')
        if (sTotalQ > 0) result.totalQuestions = sTotalQ
      }
      if (!result.timeSpentMinutes) result.timeSpentMinutes = sum('timeSpentMinutes')
    }

    // Derived overall accuracy when the portal didn't print one.
    if (result.accuracy == null) {
      const attempted = Number(result.correct || 0) + Number(result.wrong || 0)
      if (attempted > 0) result.accuracy = roundTo((result.correct / attempted) * 100, 1)
    }
  }

  // ── 10. Labelled summary cards ("Label:" then value on the next line) ─────────
  // SmartKeeda / generic portals stack the label above the number. These only
  // fill gaps the line-oriented patterns above missed, so existing formats are
  // untouched.
  const yourMarks = text.match(/Your\s*Marks\s*:?\s*([+-]?\d+(?:\.\d+)?)\s*\/\s*(\d+)/i)
  if (yourMarks) {
    if (result.score == null) result.score = parseFloat(yourMarks[1])
    if (result.totalMarks == null) result.totalMarks = parseFloat(yourMarks[2])
  }
  if (result.cutoff == null) {
    const cutoffCard = text.match(/Cut[\s-]*Off\s*Marks?\s*:?\s*([+-]?\d+(?:\.\d+)?)/i)
    if (cutoffCard) result.cutoff = parseFloat(cutoffCard[1])
  }
  if (result.accuracy == null) {
    const accCard = text.match(/(?:Your\s+)?Accuracy\s*:?\s*([\d.]+)\s*%/i)
    if (accCard) result.accuracy = parseFloat(accCard[1])
  }
  if (result.percentile == null) {
    const pctCard = text.match(/(?:Your\s+)?Percentile\s*:?\s*([\d.]+)\s*%/i)
    if (pctCard) result.percentile = parseFloat(pctCard[1])
  }
  if (result.rank == null) {
    const rankHash = text.match(/(?:Your\s+)?Rank\s*#\s*([\d,]+)/i)
    if (rankHash) result.rank = parseInt(rankHash[1].replace(/,/g, ''), 10)
  }
  if (result.totalCandidates == null) {
    const takers = text.match(/(?:Out of|of)\s*([\d,]+)\s*(?:test[\s-]*takers|students|candidates|aspirants|users)/i)
    if (takers) result.totalCandidates = parseInt(takers[1].replace(/,/g, ''), 10)
  }

  // ── 11. Final Auto-Derivations ────────────────────────────────────
  if (result.accuracy === null && result.correct !== null && result.wrong !== null) {
    const attempted = result.correct + result.wrong
    if (attempted > 0) {
      result.accuracy = roundTo((result.correct / attempted) * 100, 1)
    }
  }

  if (result.unattempted === null && result.totalQuestions !== null && result.correct !== null && result.wrong !== null) {
    result.unattempted = Math.max(0, result.totalQuestions - result.correct - result.wrong)
  }

  if (result.totalQuestions === null && (result.correct !== null || result.wrong !== null || result.unattempted !== null)) {
    result.totalQuestions = (result.correct || 0) + (result.wrong || 0) + (result.unattempted || 0)
  }

  return result
}

/**
 * Uses Gemini AI to parse any raw scorecard text into a clean JSON structure.
 * Robust fallback for non-standard formats or heavily messy text copies.
 *
 * @param {string} rawText
 * @returns {Promise<object>} Extracted scorecard fields
 */
export async function extractScorecardWithGemini(rawText) {
  if (!rawText || !rawText.trim()) {
    throw new Error('Please paste exam result text to extract')
  }

  const systemInstruction = `You are an expert exam report card parser.
Your task is to extract structured test performance data from the provided raw clipboard text of an exam or mock test portal (e.g. Oliveboard, Testbook, PracticeMock, Adda247, etc.).
Extract the metrics with high precision. If a metric is not present in the text, return null (do not invent or use placeholder numbers).

If the text contains a per-section table (e.g. SmartKeeda "Test Analysis" with rows per
section plus an "Overall" row), it is a full-length test: set "type" to "flt",
"sectionName" to "All Sections", fill the top-level metrics from the "Overall" row, and
list every non-overall section in "sections". Otherwise "sections" is an empty array.

Return STRICTLY a JSON object with these keys:
{
  "examName": "string or empty",
  "type": "sectional" or "flt",
  "sectionName": "string (e.g. Reasoning, Quantitative Aptitude, English, or All Sections if FLT)",
  "topicName": "string or empty",
  "score": number or null,
  "totalMarks": number or null,
  "negativeMarks": number or null,
  "cutoff": number or null,
  "rank": number or null,
  "totalCandidates": number or null,
  "percentile": number or null,
  "accuracy": number or null,
  "timeSpent": "string in format HH:MM:SS or empty",
  "timeSpentMinutes": number or null,
  "correct": number or null,
  "wrong": number or null,
  "unattempted": number or null,
  "totalQuestions": number or null,
  "sections": [
    {
      "name": "string",
      "totalQuestions": number or null,
      "correct": number or null,
      "wrong": number or null,
      "unattempted": number or null,
      "score": number or null,
      "totalMarks": number or null,
      "accuracy": number or null,
      "percentile": number or null,
      "timeSpentMinutes": number or null,
      "cutoff": number or null
    }
  ]
}
Do not include markdown wraps or extra commentary. Return only the JSON.`

  const preferred = typeof localStorage !== 'undefined' ? localStorage.getItem('protrack:ai_preferred_provider') || 'auto' : 'auto'
  const prompt = `Raw Exam Text:\n"""\n${rawText}\n"""`

  const res = await callAIProvider(prompt, systemInstruction, preferred)
  const rawResponse = res.text || ''
  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }
  return JSON.parse(rawResponse)
}
