import { describe, it, expect } from 'vitest'
import {
  parseRawExamSummary,
  parseSectionTable,
  canonicalSectionName,
  timeStringToMinutes,
} from '../scorecardParser'

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

  it('understands a SmartKeeda "Test Analysis" full-length paste and feeds it as an FLT', () => {
    const rawCopy = `Full Length
SBI PO Mock Test (Pre)
SmartKeeda
Test Analysis
User Profile
Hi Ayush Kumar
Your Rank #16396
Out of 24317 test takers

Cut Off Marks:
56.25/100
Your Marks:
33/100
Percentage:
33%
Accuracy:
75%
Percentile:
32.28%
Insights
SUMMARY
Started on: Jul 27, 2026, 6:16:30 PM
Completed on: Jul 27, 2026, 7:17:08 PM
Test Time Limit:01:00:00
Time taken:01:00:00
Rank:16396/24317
Section	No. of Ques.
Correct
Incorrect
Unattempted
Time Taken	Cut off	Score	Percentile
English Language	40
24
9
7
20 Mins	7
21.75/40 (54.00%)
67.47
Quantitative Aptitude	30
4
2
24
20 Mins	6.5
3.5/30 (12.00%)
24.70
Reasoning Aptitude	30
8
1
21
20 Mins	7
7.75/30 (26.00%)
40.10
Overall	100
36
12
52
0 Mins	56.25
33/100 (33.00%)
32.28
`
    const parsed = parseRawExamSummary(rawCopy)

    expect(parsed.type).toBe('flt')
    expect(parsed.sectionName).toBe('All Sections')
    expect(parsed.score).toBe(33)
    expect(parsed.totalMarks).toBe(100)
    expect(parsed.cutoff).toBe(56.25)
    expect(parsed.correct).toBe(36)
    expect(parsed.wrong).toBe(12)
    expect(parsed.unattempted).toBe(52)
    expect(parsed.totalQuestions).toBe(100)
    expect(parsed.percentile).toBe(32.28)
    expect(parsed.accuracy).toBe(75)
    expect(parsed.rank).toBe(16396)
    expect(parsed.totalCandidates).toBe(24317)
    expect(parsed.timeSpentMinutes).toBe(60)

    expect(parsed.sections).toHaveLength(3)
    const [eng, quant, reasoning] = parsed.sections
    expect(eng.canonicalName).toBe('English Language')
    expect(eng.correct).toBe(24)
    expect(eng.wrong).toBe(9)
    expect(eng.unattempted).toBe(7)
    expect(eng.score).toBe(21.75)
    expect(eng.totalMarks).toBe(40)
    expect(eng.timeSpentMinutes).toBe(20)
    expect(eng.percentile).toBe(67.47)
    expect(eng.accuracy).toBe(72.7) // 24 / (24 + 9)
    expect(quant.canonicalName).toBe('Quantitative Aptitude')
    expect(quant.cutoff).toBe(6.5)
    expect(reasoning.canonicalName).toBe('Reasoning')
    expect(reasoning.correct).toBe(8)
  })

  it('parseSectionTable returns null when there is no tabular breakdown', () => {
    expect(parseSectionTable('Score: 22 / 40\nCorrect: 10')).toBeNull()
  })

  it('canonicalSectionName maps portal-specific labels onto shared buckets', () => {
    expect(canonicalSectionName('Reasoning Aptitude')).toBe('Reasoning')
    expect(canonicalSectionName('Reasoning Ability')).toBe('Reasoning')
    expect(canonicalSectionName('Numerical Ability')).toBe('Quantitative Aptitude')
    expect(canonicalSectionName('English Language')).toBe('English Language')
    expect(canonicalSectionName('Data Interpretation & Analysis')).toBe('Quantitative Aptitude')
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
