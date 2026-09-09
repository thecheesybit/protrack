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

  it('parses Adda247 single sectional test copy accurately', () => {
    const rawCopy = `
Adda247
Section: Quantitative Aptitude
Marks Scored: 24.25 / 35
Rank: 512 / 8500
Percentile: 93.97%
Accuracy: 89.28%
Time Spent: 19:45
Correct: 25
Incorrect: 3
Unattempted: 7
`
    const parsed = parseRawExamSummary(rawCopy)

    expect(parsed.detectedPortal).toBe('adda247')
    expect(parsed.sectionName).toBe('Quantitative Aptitude')
    expect(parsed.type).toBe('sectional')
    expect(parsed.score).toBe(24.25)
    expect(parsed.totalMarks).toBe(35)
    expect(parsed.rank).toBe(512)
    expect(parsed.totalCandidates).toBe(8500)
    expect(parsed.percentile).toBe(93.97)
    expect(parsed.accuracy).toBe(89.28)
    expect(parsed.timeSpentMinutes).toBe(20)
    expect(parsed.correct).toBe(25)
    expect(parsed.wrong).toBe(3)
    expect(parsed.unattempted).toBe(7)
    expect(parsed.totalQuestions).toBe(35)
  })

  it('parses Adda247 FLT test with sectional breakdown accurately', () => {
    const rawCopy = `
Adda247
SBI PO Prelims Full Mock 01
Rank: 420 / 12500
Total Score: 64.50 / 100
Percentile: 96.64%
Accuracy: 89.2%
Time Spent: 58:20

Sectional Performance:
English Language 30 25 22 3 21.25 18:40 88.0%
Quantitative Aptitude 35 28 25 3 24.25 19:50 89.2%
Reasoning Ability 35 24 20 4 19.00 19:50 83.3%
`
    const parsed = parseRawExamSummary(rawCopy)

    expect(parsed.detectedPortal).toBe('adda247')
    expect(parsed.type).toBe('flt')
    expect(parsed.sectionName).toBe('All Sections')
    expect(parsed.score).toBe(64.50)
    expect(parsed.totalMarks).toBe(100)
    expect(parsed.rank).toBe(420)
    expect(parsed.totalCandidates).toBe(12500)
    expect(parsed.percentile).toBe(96.64)
    expect(parsed.accuracy).toBe(89.2)
    expect(parsed.sections).toHaveLength(3)

    const [eng, quant, reasoning] = parsed.sections
    expect(eng.canonicalName).toBe('English Language')
    expect(eng.score).toBe(21.25)
    expect(eng.correct).toBe(22)
    expect(eng.wrong).toBe(3)
    expect(eng.unattempted).toBe(5) // 30 - 22 - 3
    expect(eng.accuracy).toBe(88.0)

    expect(quant.canonicalName).toBe('Quantitative Aptitude')
    expect(quant.score).toBe(24.25)

    expect(reasoning.canonicalName).toBe('Reasoning')
    expect(reasoning.score).toBe(19.00)
  })

  it('parses Guidely single sectional test copy accurately', () => {
    const rawCopy = `
Guidely Test Series
Section: Reasoning Ability
Score: 24.75 / 35
Cutoff: 14.5
Rank: 412 / 8900
Percentile: 95.37%
Accuracy: 92.8%
Time: 18:15
Correct: 26
Wrong: 2
Left: 7
`
    const parsed = parseRawExamSummary(rawCopy)

    expect(parsed.detectedPortal).toBe('guidely')
    expect(parsed.sectionName).toBe('Reasoning')
    expect(parsed.type).toBe('sectional')
    expect(parsed.score).toBe(24.75)
    expect(parsed.totalMarks).toBe(35)
    expect(parsed.rank).toBe(412)
    expect(parsed.totalCandidates).toBe(8900)
    expect(parsed.percentile).toBe(95.37)
    expect(parsed.accuracy).toBe(92.8)
    expect(parsed.correct).toBe(26)
    expect(parsed.wrong).toBe(2)
    expect(parsed.unattempted).toBe(7)
  })

  it('parses Guidely FLT with pipe-delimited breakdown accurately', () => {
    const rawCopy = `
Guidely - IBPS PO Prelims Live Mock 3
Score: 58.75 / 100
AIR: 1420 / 18500
Percentile: 92.32%
Accuracy: 86.4%
Time: 57:30

Section Details
English Language : Correct: 18 | Wrong: 6 | Attempted: 24 | Score: 16.5 / 30 | Accuracy: 75.0% | Time: 18:30
Quantitative Aptitude : Correct: 22 | Wrong: 2 | Attempted: 24 | Score: 21.5 / 35 | Accuracy: 91.6% | Time: 19:40
Reasoning Ability : Correct: 22 | Wrong: 3 | Attempted: 25 | Score: 20.75 / 35 | Accuracy: 88.0% | Time: 19:20
`
    const parsed = parseRawExamSummary(rawCopy)

    expect(parsed.detectedPortal).toBe('guidely')
    expect(parsed.type).toBe('flt')
    expect(parsed.score).toBe(58.75)
    expect(parsed.totalMarks).toBe(100)
    expect(parsed.rank).toBe(1420)
    expect(parsed.totalCandidates).toBe(18500)
    expect(parsed.percentile).toBe(92.32)
    expect(parsed.accuracy).toBe(86.4)
    expect(parsed.sections).toHaveLength(3)

    const [eng, quant, reasoning] = parsed.sections
    expect(eng.canonicalName).toBe('English Language')
    expect(eng.score).toBe(16.5)
    expect(eng.correct).toBe(18)
    expect(eng.wrong).toBe(6)

    expect(quant.canonicalName).toBe('Quantitative Aptitude')
    expect(quant.score).toBe(21.5)

    expect(reasoning.canonicalName).toBe('Reasoning')
    expect(reasoning.score).toBe(20.75)
  })

  it('parses Oliveboard single sectional test copy accurately', () => {
    const rawCopy = `
Oliveboard Test Analysis
Section: English Language
Score: 22.5 / 30
Rank: 840 of 14200
Percentile: 94.08%
Accuracy: 88.0%
Time: 18:45
Correct: 24
Wrong: 4
Unattempted: 2
`
    const parsed = parseRawExamSummary(rawCopy)

    expect(parsed.detectedPortal).toBe('oliveboard')
    expect(parsed.sectionName).toBe('English Language')
    expect(parsed.type).toBe('sectional')
    expect(parsed.score).toBe(22.5)
    expect(parsed.totalMarks).toBe(30)
    expect(parsed.rank).toBe(840)
    expect(parsed.totalCandidates).toBe(14200)
    expect(parsed.percentile).toBe(94.08)
    expect(parsed.accuracy).toBe(88.0)
    expect(parsed.correct).toBe(24)
    expect(parsed.wrong).toBe(4)
    expect(parsed.unattempted).toBe(2)
  })

  it('parses Oliveboard FLT with sectional summary table accurately', () => {
    const rawCopy = `
Oliveboard
SBI PO Mock 5
All India Rank: 1250 / 32000
Score: 61.25 / 100
Percentile: 96.09%
Accuracy: 88.5%
Time: 58:12

Sectional Summary
Reasoning Ability 24.50 / 35 1100 / 32000 96.5% 91.2% 19:30
Quantitative Aptitude 20.25 / 35 1850 / 32000 94.2% 87.5% 19:42
English Language 16.50 / 30 2400 / 32000 92.5% 85.0% 19:00
`
    const parsed = parseRawExamSummary(rawCopy)

    expect(parsed.detectedPortal).toBe('oliveboard')
    expect(parsed.type).toBe('flt')
    expect(parsed.sectionName).toBe('All Sections')
    expect(parsed.score).toBe(61.25)
    expect(parsed.totalMarks).toBe(100)
    expect(parsed.rank).toBe(1250)
    expect(parsed.totalCandidates).toBe(32000)
    expect(parsed.percentile).toBe(96.09)
    expect(parsed.accuracy).toBe(88.5)
    expect(parsed.sections).toHaveLength(3)

    const [reasoning, quant, eng] = parsed.sections
    expect(reasoning.canonicalName).toBe('Reasoning')
    expect(reasoning.score).toBe(24.5)
    expect(reasoning.totalMarks).toBe(35)
    expect(reasoning.percentile).toBe(96.5)
    expect(reasoning.accuracy).toBe(91.2)

    expect(quant.canonicalName).toBe('Quantitative Aptitude')
    expect(quant.score).toBe(20.25)

    expect(eng.canonicalName).toBe('English Language')
    expect(eng.score).toBe(16.5)
  })

  it('auto-computes missing accuracy and unattempted question count', () => {
    const rawCopy = `
Section: Quantitative Aptitude
Score: 28 / 35
Total Questions: 35
Correct: 28
Wrong: 2
`
    const parsed = parseRawExamSummary(rawCopy)

    expect(parsed.score).toBe(28)
    expect(parsed.correct).toBe(28)
    expect(parsed.wrong).toBe(2)
    // 28 / (28 + 2) = 93.3%
    expect(parsed.accuracy).toBe(93.3)
    // 35 - 28 - 2 = 5
    expect(parsed.unattempted).toBe(5)
  })
})
