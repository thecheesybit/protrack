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

const OVERALL_ROW_RE = /^(overall|total|grand total|aggregate|overall performance)$/i

// One row of a tabular section breakdown (SmartKeeda "Test Analysis", Adda247
// section table, etc.). Columns may be separated by any mix of spaces / tabs /
// newlines. Order:
//   Name | No. of Ques | Correct | Incorrect | Unattempted | Time Taken
//        | Cut off | Score (x / total (pct%)) | Percentile
const SECTION_ROW_RE =
  /([A-Za-z][A-Za-z0-9 .&/'()-]*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s*(?:mins?|minutes?|m)\b\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\/\s*(\d+)\s*\(?\s*(\d+(?:\.\d+)?)\s*%?\s*\)?\s+(-?\d+(?:\.\d+)?)/gi

function roundTo(n, dp = 1) {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

/**
 * Parse a tabular per-section breakdown, if the raw text contains one.
 *
 * @param {string} text
 * @returns {{ sections: object[], overall: object|null } | null}
 */
export function parseSectionTable(text) {
  if (!text) return null
  const rows = []
  SECTION_ROW_RE.lastIndex = 0
  let m
  while ((m = SECTION_ROW_RE.exec(text)) !== null) {
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
  if (rows.length === 0) return null

  const overall = rows.find((r) => OVERALL_ROW_RE.test(r.name)) || null
  const sections = rows.filter((r) => r !== overall)
  return { sections, overall }
}

/**
 * Parses raw text copied from mock exam portals (Oliveboard, Testbook, PracticeMock,
 * Adda247, SmartKeeda, etc.) using fast regex and heuristics. Works offline with
 * zero latency.
 *
 * @param {string} rawText
 * @returns {object} Extracted scorecard fields
 */
export function parseRawExamSummary(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {}
  }

  const text = rawText.replace(/\r\n/g, '\n')
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
    result.sectionName = secColonMatch[1].trim()
    result.type = 'sectional'
  } else if (secSummaryMatch && secSummaryMatch[1].trim() && !/Summary|Overview|Performance/i.test(secSummaryMatch[1])) {
    result.sectionName = secSummaryMatch[1].trim()
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

  // Also check explicit "Total Marks: 40" or "Max Marks: 40"
  if (result.totalMarks === null) {
    const maxMarksMatch = text.match(/(?:Total Marks|Max Marks|Maximum Marks)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i)
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
  // Pattern B: "Rank: 13320 / 17508" or "All India Rank: 13320"
  const rankColonMatch = text.match(
    /(?:Your Rank|All India Rank|AIR|Rank)[ \t]*[:=-]?[ \t]*(\d+)(?:[ \t]*(?:\/|out of|\|)[ \t]*(\d+))?/i
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

  // Calculate total questions if components exist
  if (result.correct !== null || result.wrong !== null || result.unattempted !== null) {
    const c = result.correct || 0
    const w = result.wrong || 0
    const u = result.unattempted || 0
    result.totalQuestions = c + w + u
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
    const ov = table.overall || {
      score: sum('score'),
      totalMarks: sum('totalMarks'),
      correct: sum('correct'),
      wrong: sum('wrong'),
      unattempted: sum('unattempted'),
      totalQuestions: sum('totalQuestions'),
      timeSpentMinutes: sum('timeSpentMinutes'),
      cutoff: null,
      percentile: null,
    }

    if (ov.score != null) result.score = ov.score
    if (ov.totalMarks) result.totalMarks = ov.totalMarks
    if (ov.correct != null) result.correct = ov.correct
    if (ov.wrong != null) result.wrong = ov.wrong
    if (ov.unattempted != null) result.unattempted = ov.unattempted
    result.totalQuestions =
      ov.totalQuestions ||
      (Number(result.correct || 0) + Number(result.wrong || 0) + Number(result.unattempted || 0))
    if (ov.cutoff != null && !Number.isNaN(ov.cutoff)) result.cutoff = ov.cutoff
    if (ov.percentile != null && !Number.isNaN(ov.percentile) && result.percentile == null) {
      result.percentile = ov.percentile
    }
    if (ov.timeSpentMinutes && !result.timeSpentMinutes) {
      result.timeSpentMinutes = ov.timeSpentMinutes
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
