import { describe, it, expect } from 'vitest'
import { parseRawExamSummary, timeStringToMinutes } from '../scorecardParser'

describe('scorecardParser', () => {
  it('correctly converts time strings to minutes', () => {
    expect(timeStringToMinutes('00:25:00')).toBe(25)
    expect(timeStringToMinutes('01:15:30')).toBe(76)
    expect(timeStringToMinutes('45 mins')).toBe(45)
    expect(timeStringToMinutes('1 hr 20m')).toBe(80)
    expect(timeStringToMinutes(30)).toBe(30)
  })

  it('parses user provided mock exam copy accurately', () => {
    const rawCopy = `
Overall Performance Summary
checkMark-icon
16.25
| 40
Your Score
Negative Marks: 0.75
checkMark-icon
13320
| 17508
Your Rank
checkMark-icon
23.90
| 100
Percentile
checkMark-icon
85.00
| 100
Accuracy
checkMark-icon
00:25:00
| 00:25:00
Time Spent
Sectional Summary
Reasoning
checkMark-icon
16.25
| 40
Your Score
Negative Marks: 0.75
checkMark-icon
13320
| 17508
Your Rank
checkMark-icon
23.90
| 100
Percentile
checkMark-icon
85.00
| 100
Accuracy
checkMark-icon
00:25:00
Time Spent
Question Distribution

Overall
17
Correct
3
Wrong
20
Unattempted
`

    const parsed = parseRawExamSummary(rawCopy)

    expect(parsed.score).toBe(16.25)
    expect(parsed.totalMarks).toBe(40)
    expect(parsed.negativeMarks).toBe(0.75)
    expect(parsed.rank).toBe(13320)
    expect(parsed.totalCandidates).toBe(17508)
    expect(parsed.percentile).toBe(23.90)
    expect(parsed.accuracy).toBe(85.00)
    expect(parsed.timeSpent).toBe('00:25:00')
    expect(parsed.timeSpentMinutes).toBe(25)
    expect(parsed.correct).toBe(17)
    expect(parsed.wrong).toBe(3)
    expect(parsed.unattempted).toBe(20)
    expect(parsed.totalQuestions).toBe(40)
    expect(parsed.sectionName).toBe('Reasoning')
    expect(parsed.type).toBe('sectional')
  })

  it('preserves section name and stays sectional even when text contains "mock test"', () => {
    const rawCopy = `
RRB PO 2026 Reasoning Mock Test 2
Section: Reasoning
Score: 32.5 / 40
Negative Marks: 1.25
Accuracy: 94.2%
Percentile: 91.5%
Time Spent: 00:21:40
Correct: 34
Wrong: 2
Unattempted: 4
`
    const parsed = parseRawExamSummary(rawCopy)

    expect(parsed.sectionName).toBe('Reasoning')
    expect(parsed.type).toBe('sectional')
    expect(parsed.score).toBe(32.5)
    expect(parsed.totalMarks).toBe(40)
    expect(parsed.negativeMarks).toBe(1.25)
    expect(parsed.correct).toBe(34)
    expect(parsed.wrong).toBe(2)
    expect(parsed.unattempted).toBe(4)
  })

  it('does not invent values when fields are not present in text', () => {
    const rawCopy = `
Section: Quantitative Aptitude
Score: 22 / 40
Time Taken: 20 mins
`
    const parsed = parseRawExamSummary(rawCopy)

    expect(parsed.sectionName).toBe('Quantitative Aptitude')
    expect(parsed.score).toBe(22)
    expect(parsed.totalMarks).toBe(40)
    expect(parsed.correct).toBeNull()
    expect(parsed.wrong).toBeNull()
    expect(parsed.unattempted).toBeNull()
    expect(parsed.rank).toBeNull()
    expect(parsed.percentile).toBeNull()
  })
})
